export type ChapterMeta = {
  number: number;
  title: string;
  wordCount: number;
};

export type Chapter = ChapterMeta & {
  text: string;
};

/** Livro no catálogo (sem texto) — o que a tela de biblioteca mostra. */
export type BookMeta = {
  slug: string;
  title: string;
  authors: string;
  coverUrl: string | null;
  summary?: string | null;
  chapterCount: number;
  wordCount: number;
  chapters: ChapterMeta[];
  /** `local` = livro criado colando texto no próprio celular. */
  origin: "sync" | "local";
};

/** Livro com o texto baixado, guardado offline. */
export type BookContent = {
  slug: string;
  title: string;
  authors: string;
  chapters: Chapter[];
  fetchedAt: number;
};

/**
 * Progresso por livro. Guarda DOIS pontos, que não são a mesma coisa:
 * onde você parou (para retomar) e o mais longe que já chegou (para o
 * progresso e o hábito). Ambos em (capítulo, palavra) — ver `position.ts`.
 */
export type BookProgress = {
  /** Onde retomar a leitura. */
  chapterNumber: number;
  wordIndex: number;
  updatedAt: number;
  /** Ponto mais distante já lido. */
  furthestChapter: number;
  furthestWord: number;
  /** Legado: contagem de fragmentos das versões antigas, só para migração. */
  fragmentsRead?: number;
};

export type SavedFragment = {
  id: string;
  bookSlug: string;
  bookTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  startWord: number;
  text: string;
  savedAt: number;
};

export type ReminderTime = {
  /** 0–23 */
  hour: number;
  /** 0–59 */
  minute: number;
};

export type Settings = {
  serverUrl: string;
  token: string;
  /** Palavras-alvo por fragmento. */
  fragmentSize: number;
  fontScale: number;
  font: "serif" | "sans" | "mono";
  accent: string;
  /** Velocidade do RSVP em palavras por minuto. */
  wpm: number;
  rsvpFont: "serif" | "sans" | "mono";
  /** Ao terminar o RSVP de um fragmento, já emenda no próximo. */
  rsvpAutoNext: boolean;
  /** Meta de fragmentos por dia. */
  dailyGoal: number;
  haptics: boolean;
  notificationsOn: boolean;
  reminders: ReminderTime[];
};

export type DailyStats = {
  /** Data local no formato YYYY-MM-DD. */
  day: string;
  fragments: number;
};

export type Streak = {
  current: number;
  best: number;
  lastDay: string | null;
};
