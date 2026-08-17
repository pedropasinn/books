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
import { fractionRead, fragmentKey, registrarLeitura } from "./position";
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

  /** Modo foco: com `false`, o feed mostra só o texto (sem barras nem botões). */
  chrome: boolean;
  setChrome: (visivel: boolean) => void;
  /** Máximo de palavras que cabem na tela — medido pelo feed. */
  setCapacidade: (palavras: number) => void;
  /** O tamanho de fragmento que está valendo (pedido, limitado pela tela). */
  fragmentSizeEfetivo: number;

  fragments: Fragment[];
  /** Fragmentos do livro em ordem — o índice usa isto, não a pilha do Explorar. */
  bookFragments: Fragment[];
  index: number;
  goTo: (i: number) => void;
  advance: (delta: number) => void;
  /** Pula para uma posição do livro, abrindo-o antes se preciso. */
  jumpTo: (slug: string, chapterNumber: number, wordIndex: number) => Promise<boolean>;

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
  /** Baixa o texto sem trocar o livro que está sendo lido. */
  downloadBook: (slug: string) => Promise<boolean>;
  /** Abre no feed. `false` = não abriu; não navegue. */
  openBook: (slug: string) => Promise<boolean>;
  removeBook: (slug: string) => Promise<void>;
  addLocalBook: (title: string, authors: string, chapters: Chapter[]) => Promise<void>;
  /** Fração lida (0–1) pelo ponto mais distante alcançado. */
  bookFraction: (slug: string) => number;
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
  // Abre em modo foco: a primeira coisa que aparece é o texto, nada mais.
  const [chrome, setChrome] = useState(false);
  const [capacidade, setCapacidade] = useState(Number.POSITIVE_INFINITY);

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

  // O ajuste do usuário é o teto desejado; a tela é o teto real. Fragmento que
  // não cabe seria cortado ou espremido — os dois piores resultados possíveis.
  const fragmentSizeEfetivo = Math.max(12, Math.min(settings.fragmentSize, capacidade));

  const bookFragments = useMemo(
    () => (content ? splitBook(content, fragmentSizeEfetivo) : []),
    [content, fragmentSizeEfetivo]
  );

  const fragments = mode === "explorar" ? explore : bookFragments;

  /**
   * Salto pedido pelo índice (ou por um trecho salvo) que ainda não pôde ser
   * atendido: abrir um livro é assíncrono, e os fragmentos só existem depois
   * que o texto carrega. Fica guardado aqui e o efeito abaixo consome.
   */
  const saltoPendente = useRef<{ slug: string; chapterNumber: number; wordIndex: number } | null>(
    null
  );

  // Ao trocar de livro (ou de tamanho de fragmento), reposiciona pela palavra
  // salva — o índice de fragmento muda, o índice de palavra não.
  const lastPositioned = useRef<string>("");
  useEffect(() => {
    if (mode !== "livro" || !activeSlug || !bookFragments.length) return;

    const salto = saltoPendente.current;
    if (salto && salto.slug === activeSlug) {
      saltoPendente.current = null;
      lastPositioned.current = `${activeSlug}:${fragmentSizeEfetivo}`;
      const i = findFragmentIndex(bookFragments, salto.chapterNumber, salto.wordIndex);
      setIndex(i >= 0 ? i : 0);
      return;
    }

    const stamp = `${activeSlug}:${fragmentSizeEfetivo}`;
    if (lastPositioned.current === stamp) return;
    lastPositioned.current = stamp;
    const p = progress[activeSlug];
    const i = p ? findFragmentIndex(bookFragments, p.chapterNumber, p.wordIndex) : 0;
    setIndex(i >= 0 ? i : 0);
  }, [mode, activeSlug, bookFragments, progress, fragmentSizeEfetivo]);

  // Espelhos do estado que `record` precisa ler. Os updaters do useState não
  // servem: eles têm que ser puros (o StrictMode os chama duas vezes), e aqui
  // há gravação em disco e contagem de hábito — que contariam em dobro.
  const progressRef = useRef<db.ProgressMap>({});
  const statsRef = useRef<DailyStats[]>([]);
  const streakRef = useRef<Streak>({ current: 0, best: 0, lastDay: null });
  progressRef.current = progress;
  statsRef.current = stats;
  streakRef.current = streak;

  /** Conta um fragmento no hábito do dia (e fecha o streak ao bater a meta). */
  const contarHabito = useCallback(async () => {
    const nextStats = bumpToday(statsRef.current);
    statsRef.current = nextStats;
    setStats(nextStats);
    const okStats = await db.saveStats(nextStats);

    let okStreak = true;
    if (fragmentsToday(nextStats) === settings.dailyGoal) {
      const nextStreak = bumpStreak(streakRef.current);
      streakRef.current = nextStreak;
      setStreak(nextStreak);
      okStreak = await db.saveStreak(nextStreak);
    }
    if (!okStats || !okStreak) setError("Não consegui salvar o progresso do dia.");
  }, [settings.dailyGoal]);

  /**
   * Fragmentos já contados no modo Explorar, nesta sessão. Sem isso, ficar
   * indo e voltando na pilha sorteada inflaria o contador do dia.
   */
  const exploradosRef = useRef<Set<string>>(new Set());

  /**
   * Registra a leitura de um fragmento.
   *
   * `sequencial` separa as duas origens, e a separação é o ponto: no modo
   * Explorar os trechos vêm sorteados de qualquer capítulo de qualquer livro.
   * Se eles mexessem na posição do livro, cair num trecho do capítulo 17
   * apagaria o lugar onde você estava lendo — e o app reabriria lá. Então
   * Explorar conta hábito e mais nada.
   */
  const record = useCallback(
    (f: Fragment, sequencial: boolean) => {
      const pos = { chapterNumber: f.chapterNumber, wordIndex: f.startWord };
      const chave = fragmentKey(f.bookSlug, pos);

      const { progresso, contarHabito: conta } = registrarLeitura(
        progressRef.current[f.bookSlug],
        pos,
        {
          sequencial,
          jaExplorado: exploradosRef.current.has(chave),
          agora: Date.now(),
        }
      );

      if (!sequencial) exploradosRef.current.add(chave);

      if (progresso) {
        const next: db.ProgressMap = { ...progressRef.current, [f.bookSlug]: progresso };
        progressRef.current = next;
        setProgress(next);
        void db.saveProgress(next).then((ok) => {
          if (!ok) setError("Não consegui salvar onde você parou.");
        });
      }

      if (conta) void contarHabito();
    },
    [contarHabito]
  );

  const goTo = useCallback(
    (i: number) => {
      const list = mode === "explorar" ? explore : bookFragments;
      if (!list.length) return;
      // `list.length` é posição válida: é o cartão terminal ("fim do livro").
      const next = Math.max(0, Math.min(list.length, i));
      setIndex(next);
      const f = list[next];
      if (f) record(f, mode !== "explorar");
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
        if (f) record(f, !explorando);
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
    const all = books.flatMap((b) => splitBook(b, fragmentSizeEfetivo));
    setExplore(shuffle(all).slice(0, 60));
    setIndex(0);
  }, [fragmentSizeEfetivo]);

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
        void db.saveLibrary(merged).then((ok) => {
          if (!ok) setError("Não consegui guardar o catálogo no aparelho.");
        });
        return merged;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao sincronizar.");
    } finally {
      setBusy(null);
    }
  }, [settings.serverUrl, settings.token]);

  /**
   * Traz o texto do livro para o aparelho, sem mexer no que está sendo lido.
   * Baixar é uma operação de biblioteca; trocar o livro ativo é outra coisa, e
   * juntar as duas fazia "Baixar" sequestrar a leitura em curso.
   */
  const downloadBook = useCallback(
    async (slug: string): Promise<boolean> => {
      setError(null);
      if (await db.getBookContent(slug)) return true;

      setBusy("Baixando livro…");
      try {
        const c = await fetchBook(settings.serverUrl, settings.token, slug);
        const gravou = await db.putBookContent(c);
        setDownloaded(await db.listDownloadedSlugs());
        if (!gravou) {
          setError("Baixei o livro, mas não coube no armazenamento do aparelho.");
          return false;
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao baixar o livro.");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [settings.serverUrl, settings.token]
  );

  /**
   * Abre o livro no feed. Devolve `false` quando não deu — quem chama usa isso
   * para NÃO navegar, senão a tela pularia para o feed exibindo o livro
   * anterior, dando a impressão de que deu certo.
   */
  const openBook = useCallback(
    async (slug: string): Promise<boolean> => {
      if (!(await downloadBook(slug))) return false;
      const c = await db.getBookContent(slug);
      if (!c) {
        setError("O livro não está disponível no aparelho.");
        return false;
      }
      lastPositioned.current = "";
      setContent(c);
      setActiveSlug(slug);
      setModeState("livro");
      return true;
    },
    [downloadBook]
  );

  /**
   * Pula para uma posição — do índice de capítulos, de um número de cartão ou
   * de um trecho salvo. Se o livro alvo não é o que está aberto, abre antes e
   * deixa o salto pendente: os fragmentos só existem depois do texto carregar.
   */
  const jumpTo = useCallback(
    async (slug: string, chapterNumber: number, wordIndex: number): Promise<boolean> => {
      setModeState("livro");

      if (slug !== activeSlug) {
        saltoPendente.current = { slug, chapterNumber, wordIndex };
        const abriu = await openBook(slug);
        if (!abriu) saltoPendente.current = null;
        return abriu;
      }

      const i = findFragmentIndex(bookFragments, chapterNumber, wordIndex);
      if (i < 0) return false;
      setIndex(i);
      const f = bookFragments[i];
      if (f) record(f, true);
      return true;
    },
    [activeSlug, bookFragments, openBook, record]
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
      const gravou = await db.putBookContent(book);
      setDownloaded(await db.listDownloadedSlugs());
      if (!gravou) {
        setError("Não consegui guardar este livro no aparelho (sem espaço?).");
        return;
      }

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
        void db.saveLibrary(next).then((ok) => {
          if (!ok) setError("Não consegui guardar o catálogo no aparelho.");
        });
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
        void db.saveSaved(next).then((ok) => {
          if (!ok) setError("Não consegui salvar este trecho.");
        });
        return next;
      });
    },
    [library, content]
  );

  /**
   * Fração lida do livro, pelo ponto mais distante — não por contagem de
   * cartões, que muda de significado quando o tamanho do fragmento muda.
   */
  const bookFraction = useCallback(
    (slug: string) => {
      const p = progress[slug];
      const meta = library.find((b) => b.slug === slug);
      if (!p || !meta) return 0;
      return fractionRead(meta.chapters, {
        chapterNumber: p.furthestChapter,
        wordIndex: p.furthestWord,
      });
    },
    [progress, library]
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
    chrome,
    setChrome,
    setCapacidade,
    fragmentSizeEfetivo,
    fragments,
    bookFragments,
    index,
    goTo,
    advance,
    jumpTo,
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
    downloadBook,
    openBook,
    bookFraction,
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
