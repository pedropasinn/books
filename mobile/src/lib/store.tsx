import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { findFragmentIndex, splitBook, teaser } from "./fragments";
import type { Fragment } from "./fragments";
import { bumpStreak, bumpToday, fragmentsToday } from "./habit";
import * as db from "./storage";
import { DEFAULT_SETTINGS } from "./storage";
import { fetchBook, fetchLibrary } from "./sync";
import type {
  BookContent,
  BookMeta,
  Chapter,
  DailyStats,
  SavedFragment,
  Settings,
  Streak,
} from "./types";

/** Modo do feed: seguir um livro, ou pescar trechos aleatórios da biblioteca. */
export type FeedMode = "livro" | "explorar";

type Ctx = {
  ready: boolean;
  settings: Settings;
  setPref: <K extends keyof Settings>(key: K, value: Settings[K]) => void;

  library: BookMeta[];
  downloaded: string[];
  activeSlug: string | null;
  mode: FeedMode;
  setMode: (m: FeedMode) => void;

  fragments: Fragment[];
  index: number;
  goTo: (i: number) => void;
  advance: (delta: number) => void;

  progress: db.ProgressMap;
  saved: SavedFragment[];
  toggleSaved: (f: Fragment) => void;
  isSaved: (f: Fragment) => boolean;

  stats: DailyStats[];
  streak: Streak;
  todayCount: number;

  busy: string | null;
  error: string | null;
  clearError: () => void;

  syncLibrary: () => Promise<void>;
  openBook: (slug: string) => Promise<void>;
  removeBook: (slug: string) => Promise<void>;
  addLocalBook: (title: string, authors: string, chapters: Chapter[]) => Promise<void>;
  upcomingTeasers: (n: number) => string[];
};

const AppContext = createContext<Ctx | null>(null);

/** Embaralha uma cópia (Fisher-Yates). */
function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [library, setLibrary] = useState<BookMeta[]>([]);
  const [downloaded, setDownloaded] = useState<string[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [content, setContent] = useState<BookContent | null>(null);
  const [mode, setModeState] = useState<FeedMode>("livro");
  const [explore, setExplore] = useState<Fragment[]>([]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<db.ProgressMap>({});
  const [saved, setSaved] = useState<SavedFragment[]>([]);
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [streak, setStreak] = useState<Streak>({ current: 0, best: 0, lastDay: null });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carga inicial
  useEffect(() => {
    (async () => {
      const [s, lib, prog, sav, st, stk, slugs] = await Promise.all([
        db.loadSettings(),
        db.loadLibrary(),
        db.loadProgress(),
        db.loadSaved(),
        db.loadStats(),
        db.loadStreak(),
        db.listDownloadedSlugs(),
      ]);
      setSettings(s);
      setLibrary(lib);
      setProgress(prog);
      setSaved(sav);
      setStats(st);
      setStreak(stk);
      setDownloaded(slugs);

      // Reabre no livro lido mais recentemente.
      const recent = Object.entries(prog)
        .filter(([slug]) => slugs.includes(slug))
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt)[0]?.[0];
      const first = recent ?? slugs[0] ?? null;
      if (first) {
        const c = await db.getBookContent(first);
        if (c) {
          setContent(c);
          setActiveSlug(first);
        }
      }
      setReady(true);
    })();
  }, []);

  const setPref = useCallback<Ctx["setPref"]>((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      void db.saveSettings(next);
      return next;
    });
  }, []);

  const bookFragments = useMemo(
    () => (content ? splitBook(content, settings.fragmentSize) : []),
    [content, settings.fragmentSize]
  );

  const fragments = mode === "explorar" ? explore : bookFragments;

  // Ao trocar de livro (ou de tamanho de fragmento), reposiciona pela palavra
  // salva — o índice de fragmento muda, o índice de palavra não.
  const lastPositioned = useRef<string>("");
  useEffect(() => {
    if (mode !== "livro" || !activeSlug || !bookFragments.length) return;
    const stamp = `${activeSlug}:${settings.fragmentSize}`;
    if (lastPositioned.current === stamp) return;
    lastPositioned.current = stamp;
    const p = progress[activeSlug];
    const i = p ? findFragmentIndex(bookFragments, p.chapterNumber, p.wordIndex) : 0;
    setIndex(i >= 0 ? i : 0);
  }, [mode, activeSlug, bookFragments, progress, settings.fragmentSize]);

  // Espelhos do estado que `record` precisa ler. Os updaters do useState não
  // servem: eles têm que ser puros (o StrictMode os chama duas vezes), e aqui
  // há gravação em disco e contagem de hábito — que contariam em dobro.
  const progressRef = useRef<db.ProgressMap>({});
  const statsRef = useRef<DailyStats[]>([]);
  const streakRef = useRef<Streak>({ current: 0, best: 0, lastDay: null });
  progressRef.current = progress;
  statsRef.current = stats;
  streakRef.current = streak;

  /** Marca leitura: guarda a posição e, se avançou o recorde, conta hábito. */
  const record = useCallback(
    (f: Fragment, fragIndex: number) => {
      const cur = progressRef.current[f.bookSlug];
      const reached = Math.max(cur?.fragmentsRead ?? 0, fragIndex + 1);
      const avancou = reached > (cur?.fragmentsRead ?? 0);

      const nextProgress: db.ProgressMap = {
        ...progressRef.current,
        [f.bookSlug]: {
          chapterNumber: f.chapterNumber,
          wordIndex: f.startWord,
          updatedAt: Date.now(),
          fragmentsRead: reached,
        },
      };
      progressRef.current = nextProgress;
      setProgress(nextProgress);
      void db.saveProgress(nextProgress);

      // Só conta hábito quando a leitura avança de verdade: reler para trás
      // e voltar não move o contador do dia.
      if (!avancou) return;

      const nextStats = bumpToday(statsRef.current);
      statsRef.current = nextStats;
      setStats(nextStats);
      void db.saveStats(nextStats);

      if (fragmentsToday(nextStats) === settings.dailyGoal) {
        const nextStreak = bumpStreak(streakRef.current);
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        void db.saveStreak(nextStreak);
      }
    },
    [settings.dailyGoal]
  );

  const goTo = useCallback(
    (i: number) => {
      const list = mode === "explorar" ? explore : bookFragments;
      if (!list.length) return;
      // `list.length` é posição válida: é o cartão terminal ("fim do livro").
      const next = Math.max(0, Math.min(list.length, i));
      setIndex(next);
      const f = list[next];
      if (f) record(f, mode === "explorar" ? 0 : next);
    },
    [mode, explore, bookFragments, record]
  );

  // `advance` move relativo ao índice atual. Lê a lista de um ref para não
  // precisar do índice como dependência (o updater do setState resolve isso).
  const listRef = useRef<{ list: Fragment[]; explorando: boolean }>({
    list: [],
    explorando: false,
  });
  listRef.current = { list: fragments, explorando: mode === "explorar" };

  const advance = useCallback(
    (delta: number) => {
      const { list, explorando } = listRef.current;
      if (!list.length) return;
      setIndex((cur) => {
        const next = Math.max(0, Math.min(list.length, cur + delta));
        const f = list[next];
        if (f) record(f, explorando ? 0 : next);
        return next;
      });
    },
    [record]
  );

  // ── Explorar: sorteia trechos de todos os livros baixados ────────────────

  const buildExplore = useCallback(async () => {
    const slugs = await db.listDownloadedSlugs();
    const books = (await Promise.all(slugs.map((s) => db.getBookContent(s)))).filter(
      (b): b is BookContent => !!b
    );
    const all = books.flatMap((b) => splitBook(b, settings.fragmentSize));
    setExplore(shuffle(all).slice(0, 60));
    setIndex(0);
  }, [settings.fragmentSize]);

  const setMode = useCallback(
    (m: FeedMode) => {
      setModeState(m);
      if (m === "explorar") void buildExplore();
      else lastPositioned.current = ""; // força reposicionar pelo progresso
    },
    [buildExplore]
  );

  // ── Sincronização ────────────────────────────────────────────────────────

  const syncLibrary = useCallback(async () => {
    setBusy("Buscando catálogo…");
    setError(null);
    try {
      const remote = await fetchLibrary(settings.serverUrl, settings.token);
      setLibrary((prev) => {
        const locais = prev.filter((b) => b.origin === "local");
        const merged = [...remote, ...locais];
        void db.saveLibrary(merged);
        return merged;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao sincronizar.");
    } finally {
      setBusy(null);
    }
  }, [settings.serverUrl, settings.token]);

  const openBook = useCallback(
    async (slug: string) => {
      setError(null);
      let c = await db.getBookContent(slug);
      if (!c) {
        setBusy("Baixando livro…");
        try {
          c = await fetchBook(settings.serverUrl, settings.token, slug);
          await db.putBookContent(c);
          setDownloaded(await db.listDownloadedSlugs());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha ao baixar o livro.");
          setBusy(null);
          return;
        }
        setBusy(null);
      }
      lastPositioned.current = "";
      setContent(c);
      setActiveSlug(slug);
      setModeState("livro");
    },
    [settings.serverUrl, settings.token]
  );

  const removeBook = useCallback(
    async (slug: string) => {
      await db.deleteBookContent(slug);
      setDownloaded(await db.listDownloadedSlugs());
      setLibrary((prev) => {
        const next = prev.filter((b) => b.origin !== "local" || b.slug !== slug);
        void db.saveLibrary(next);
        return next;
      });
      if (activeSlug === slug) {
        setActiveSlug(null);
        setContent(null);
      }
    },
    [activeSlug]
  );

  /**
   * Guarda um livro que veio do próprio aparelho — texto colado ou arquivo
   * importado (EPUB/PDF/TXT) — e já abre no feed.
   */
  const addLocalBook = useCallback(
    async (title: string, authors: string, chapters: Chapter[]) => {
      if (!chapters.length) throw new Error("Nada para ler neste arquivo.");
      const slug = `local-${Date.now().toString(36)}`;
      const titulo = title.trim() || "Sem título";
      const book: BookContent = {
        slug,
        title: titulo,
        authors: authors.trim() || "—",
        chapters,
        fetchedAt: Date.now(),
      };
      await db.putBookContent(book);
      setDownloaded(await db.listDownloadedSlugs());

      const meta: BookMeta = {
        slug,
        title: titulo,
        authors: book.authors,
        coverUrl: null,
        chapterCount: chapters.length,
        wordCount: chapters.reduce((s, c) => s + c.wordCount, 0),
        chapters: chapters.map((c) => ({
          number: c.number,
          title: c.title,
          wordCount: c.wordCount,
        })),
        origin: "local",
      };
      setLibrary((prev) => {
        const next = [...prev, meta];
        void db.saveLibrary(next);
        return next;
      });

      lastPositioned.current = "";
      setContent(book);
      setActiveSlug(slug);
      setModeState("livro");
    },
    []
  );

  // ── Trechos salvos ───────────────────────────────────────────────────────

  const savedId = (f: Fragment) => `${f.bookSlug}:${f.chapterNumber}:${f.startWord}`;

  const isSaved = useCallback(
    (f: Fragment) => saved.some((s) => s.id === savedId(f)),
    [saved]
  );

  const toggleSaved = useCallback(
    (f: Fragment) => {
      setSaved((prev) => {
        const id = savedId(f);
        const exists = prev.some((s) => s.id === id);
        const bookTitle =
          library.find((b) => b.slug === f.bookSlug)?.title ?? content?.title ?? "";
        const next = exists
          ? prev.filter((s) => s.id !== id)
          : [
              {
                id,
                bookSlug: f.bookSlug,
                bookTitle,
                chapterNumber: f.chapterNumber,
                chapterTitle: f.chapterTitle,
                startWord: f.startWord,
                text: f.text,
                savedAt: Date.now(),
              },
              ...prev,
            ];
        void db.saveSaved(next);
        return next;
      });
    },
    [library, content]
  );

  /** Prévias dos próximos fragmentos — viram o corpo das notificações. */
  const upcomingTeasers = useCallback(
    (n: number) => {
      const list = bookFragments.length ? bookFragments : explore;
      const out: string[] = [];
      for (let i = 1; i <= n; i++) {
        const f = list[Math.min(index + i, list.length - 1)];
        if (f) out.push(teaser(f.text));
      }
      return out;
    },
    [bookFragments, explore, index]
  );

  const value: Ctx = {
    ready,
    settings,
    setPref,
    library,
    downloaded,
    activeSlug,
    mode,
    setMode,
    fragments,
    index,
    goTo,
    advance,
    progress,
    saved,
    toggleSaved,
    isSaved,
    stats,
    streak,
    todayCount: fragmentsToday(stats),
    busy,
    error,
    clearError: () => setError(null),
    syncLibrary,
    openBook,
    removeBook,
    addLocalBook,
    upcomingTeasers,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp precisa de <AppProvider>");
  return ctx;
}
