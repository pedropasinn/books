import { Preferences } from "@capacitor/preferences";
import type {
  BookContent,
  BookMeta,
  BookProgress,
  DailyStats,
  SavedFragment,
  Settings,
  Streak,
} from "./types";

/**
 * Persistência local.
 *
 * Estado pequeno (ajustes, progresso, streak) vai em `Preferences` — no
 * Android é SharedPreferences, que sobrevive à limpeza de cache do WebView.
 * O texto dos livros é grande demais para isso, então vai em IndexedDB.
 */

const KEYS = {
  settings: "settings",
  library: "library",
  progress: "progress",
  saved: "saved",
  stats: "stats",
  streak: "streak",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  serverUrl: "",
  token: "",
  fragmentSize: 55,
  fontScale: 1,
  font: "serif",
  accent: "#2dd4bf",
  wpm: 350,
  rsvpFont: "mono",
  rsvpAutoNext: true,
  dailyGoal: 10,
  haptics: true,
  notificationsOn: false,
  reminders: [
    { hour: 9, minute: 0 },
    { hour: 13, minute: 30 },
    { hour: 21, minute: 0 },
  ],
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key });
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Grava e DIZ se conseguiu.
 *
 * Antes isto engolia o erro em silêncio. Num app pessoal, achar que o
 * progresso ou um trecho marcado foi salvo quando não foi é pior do que ver
 * um aviso: o dado perdido não volta. Quem chama decide o que fazer com o
 * `false` — o store transforma em aviso na tela.
 */
async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    await Preferences.set({ key, value: JSON.stringify(value) });
    return true;
  } catch (e) {
    console.error(`[storage] falha ao gravar "${key}"`, e);
    return false;
  }
}

// ── Ajustes ────────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<Settings> {
  const saved = await readJson<Partial<Settings>>(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

export const saveSettings = (s: Settings) => writeJson(KEYS.settings, s);

// ── Catálogo ───────────────────────────────────────────────────────────────

export const loadLibrary = () => readJson<BookMeta[]>(KEYS.library, []);
export const saveLibrary = (books: BookMeta[]) => writeJson(KEYS.library, books);

// ── Progresso ──────────────────────────────────────────────────────────────

export type ProgressMap = Record<string, BookProgress>;

/**
 * Migração das versões que guardavam `fragmentsRead` (contagem de cartões).
 * Aquela unidade era instável, então não dá para convertê-la em palavra: o
 * melhor palpite honesto é assumir que o ponto mais distante é onde a pessoa
 * parou. Perde-se, no máximo, o avanço de quem tinha relido para trás.
 */
export async function loadProgress(): Promise<ProgressMap> {
  const bruto = await readJson<Record<string, Partial<BookProgress>>>(KEYS.progress, {});
  const saida: ProgressMap = {};
  for (const [slug, p] of Object.entries(bruto)) {
    const chapterNumber = p.chapterNumber ?? 1;
    const wordIndex = p.wordIndex ?? 0;
    saida[slug] = {
      chapterNumber,
      wordIndex,
      updatedAt: p.updatedAt ?? 0,
      furthestChapter: p.furthestChapter ?? chapterNumber,
      furthestWord: p.furthestWord ?? wordIndex,
    };
  }
  return saida;
}

export const saveProgress = (p: ProgressMap) => writeJson(KEYS.progress, p);

// ── Trechos salvos ─────────────────────────────────────────────────────────

export const loadSaved = () => readJson<SavedFragment[]>(KEYS.saved, []);
export const saveSaved = (list: SavedFragment[]) => writeJson(KEYS.saved, list);

// ── Hábito (dia + streak) ──────────────────────────────────────────────────

export const loadStats = () => readJson<DailyStats[]>(KEYS.stats, []);
export const saveStats = (s: DailyStats[]) => writeJson(KEYS.stats, s);

export const loadStreak = () => readJson<Streak>(KEYS.streak, { current: 0, best: 0, lastDay: null });
export const saveStreak = (s: Streak) => writeJson(KEYS.streak, s);

// ── Texto dos livros (IndexedDB) ───────────────────────────────────────────

const DB_NAME = "fragmentos";
const DB_STORE = "books";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "slug" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(DB_STORE, mode);
        const req = run(t.objectStore(DB_STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export async function getBookContent(slug: string): Promise<BookContent | null> {
  try {
    return (await tx<BookContent | undefined>("readonly", (s) => s.get(slug))) ?? null;
  } catch {
    return null;
  }
}

export async function putBookContent(book: BookContent): Promise<boolean> {
  try {
    await tx("readwrite", (s) => s.put(book) as IDBRequest<IDBValidKey>);
    return true;
  } catch (e) {
    // Falha típica: cota do IndexedDB estourada por um livro grande. Quem
    // chama precisa saber, senão o livro "some" sem explicação.
    console.error("[storage] falha ao gravar o livro", book.slug, e);
    return false;
  }
}

export async function deleteBookContent(slug: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(slug) as unknown as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
}

export async function listDownloadedSlugs(): Promise<string[]> {
  try {
    const keys = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
    return keys.map(String);
  } catch {
    return [];
  }
}
