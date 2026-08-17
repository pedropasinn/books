import "server-only";
import { db, books, episodes, progress, readState, readingChapters, bookHighlights } from "@/lib/db";
import { eq, and, asc, desc, sql } from "drizzle-orm";

export type Highlight = typeof bookHighlights.$inferSelect;

const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? "pedro";

/**
 * Executa uma query e, se o banco não estiver disponível (ex.: DATABASE_URL
 * ausente, Neon fora do ar, ou tabelas ainda não criadas), devolve um fallback
 * em vez de derrubar a página. Mantém o site no ar mesmo sem banco.
 */
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[queries] DB indisponível, usando fallback:", err);
    return fallback;
  }
}

export async function listBooks() {
  return safeQuery(async () => {
  const rows = await db.select().from(books).orderBy(asc(books.title));
  const counts = await db
    .select({
      bookId: episodes.bookId,
      total: sql<number>`count(*)`.as("total"),
    })
    .from(episodes)
    .groupBy(episodes.bookId);
  const totalByBook = new Map(counts.map((c) => [c.bookId, Number(c.total)]));

  const doneRows = await db
    .select({
      bookId: episodes.bookId,
      done: sql<number>`count(*)`.as("done"),
    })
    .from(progress)
    .innerJoin(episodes, eq(progress.episodeId, episodes.id))
    .where(and(eq(progress.userId, USER_ID), eq(progress.completed, true)))
    .groupBy(episodes.bookId);
  const doneByBook = new Map(doneRows.map((r) => [r.bookId, Number(r.done)]));

  const chapterCounts = await db
    .select({ bookId: readingChapters.bookId, total: sql<number>`count(*)`.as("total") })
    .from(readingChapters)
    .groupBy(readingChapters.bookId);
  const chaptersByBook = new Map(chapterCounts.map((c) => [c.bookId, Number(c.total)]));

  return rows.map((b) => ({
    ...b,
    totalEpisodes: totalByBook.get(b.id) ?? 0,
    completedEpisodes: doneByBook.get(b.id) ?? 0,
    totalChapters: chaptersByBook.get(b.id) ?? 0,
  }));
  }, []);
}

export async function getBookBySlug(slug: string) {
  return safeQuery(async () => {
    const rows = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
    return rows[0] ?? null;
  }, null);
}

export async function listEpisodesForBook(bookId: string) {
  return safeQuery(async () => {
  const eps = await db
    .select()
    .from(episodes)
    .where(eq(episodes.bookId, bookId))
    .orderBy(asc(episodes.number));

  const prog = await db
    .select()
    .from(progress)
    .where(eq(progress.userId, USER_ID));
  const progressById = new Map(prog.map((p) => [p.episodeId, p]));

  return eps.map((e) => ({
    ...e,
    progress: progressById.get(e.id) ?? null,
  }));
  }, []);
}

export async function getEpisode(bookSlug: string, number: number) {
  return safeQuery(async () => {
  const book = await getBookBySlug(bookSlug);
  if (!book) return null;
  const rows = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.bookId, book.id), eq(episodes.number, number)))
    .limit(1);
  if (!rows.length) return null;
  const prog = await db
    .select()
    .from(progress)
    .where(and(eq(progress.userId, USER_ID), eq(progress.episodeId, rows[0].id)))
    .limit(1);
  return { book, episode: rows[0], progress: prog[0] ?? null };
  }, null);
}

export async function getReadingPosition(bookId: string) {
  return safeQuery(async () => {
    const rows = await db
      .select()
      .from(readState)
      .where(and(eq(readState.userId, USER_ID), eq(readState.bookId, bookId)))
      .limit(1);
    return rows[0] ?? null;
  }, null);
}

export async function listAllProgress() {
  return safeQuery(async () => {
  const rows = await db
    .select({
      episodeId: episodes.id,
      number: episodes.number,
      title: episodes.title,
      durationSec: episodes.durationSec,
      audioUrl: episodes.audioUrl,
      status: episodes.status,
      bookSlug: books.slug,
      bookTitle: books.title,
      bookCover: books.coverUrl,
      positionSec: progress.positionSec,
      completed: progress.completed,
      lastPlayedAt: progress.lastPlayedAt,
    })
    .from(progress)
    .innerJoin(episodes, eq(progress.episodeId, episodes.id))
    .innerJoin(books, eq(episodes.bookId, books.id))
    .where(eq(progress.userId, USER_ID))
    .orderBy(desc(progress.lastPlayedAt));
  return rows;
  }, []);
}

export async function getContinueListening(limit = 6) {
  return safeQuery(async () => {
  const rows = await db
    .select({
      episodeId: episodes.id,
      number: episodes.number,
      title: episodes.title,
      durationSec: episodes.durationSec,
      audioUrl: episodes.audioUrl,
      bookId: books.id,
      bookSlug: books.slug,
      bookTitle: books.title,
      bookCover: books.coverUrl,
      positionSec: progress.positionSec,
      completed: progress.completed,
      lastPlayedAt: progress.lastPlayedAt,
    })
    .from(progress)
    .innerJoin(episodes, eq(progress.episodeId, episodes.id))
    .innerJoin(books, eq(episodes.bookId, books.id))
    .where(and(eq(progress.userId, USER_ID), eq(progress.completed, false)))
    .orderBy(desc(progress.lastPlayedAt))
    .limit(limit);
  return rows;
  }, []);
}

export async function getAdjacentEpisodes(bookId: string, number: number) {
  return safeQuery(async () => {
    const prev = await db
      .select({ number: episodes.number })
      .from(episodes)
      .where(and(eq(episodes.bookId, bookId), sql`${episodes.number} < ${number}`))
      .orderBy(desc(episodes.number))
      .limit(1);
    const next = await db
      .select({ number: episodes.number })
      .from(episodes)
      .where(and(eq(episodes.bookId, bookId), sql`${episodes.number} > ${number}`))
      .orderBy(asc(episodes.number))
      .limit(1);
    return { prev: prev[0]?.number ?? null, next: next[0]?.number ?? null };
  }, { prev: null as number | null, next: null as number | null });
}

// ── Leitura (texto do livro) ───────────────────────────────────────────────

/** Livro + contagens de cada modo (podcast / leitura) + posição de leitura. Alimenta a central. */
export async function getBookOverview(slug: string) {
  return safeQuery(async () => {
    const rows = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
    const book = rows[0];
    if (!book) return null;
    const [ep] = await db
      .select({ n: sql<number>`count(*)` })
      .from(episodes)
      .where(eq(episodes.bookId, book.id));
    const [ch] = await db
      .select({ n: sql<number>`count(*)` })
      .from(readingChapters)
      .where(eq(readingChapters.bookId, book.id));
    const [sl] = await db
      .select({ n: sql<number>`count(*)` })
      .from(readingChapters)
      .where(and(eq(readingChapters.bookId, book.id), sql`${readingChapters.presentation} is not null`));
    const rs = await db
      .select()
      .from(readState)
      .where(and(eq(readState.userId, USER_ID), eq(readState.bookId, book.id)))
      .limit(1);
    return {
      book,
      episodeCount: Number(ep?.n ?? 0),
      chapterCount: Number(ch?.n ?? 0),
      slideCount: Number(sl?.n ?? 0),
      readState: rs[0] ?? null,
    };
  }, null);
}

/** Estrutura de apresentação (slides) de um capítulo. */
export async function getPresentation(slug: string, number: number) {
  return safeQuery(async () => {
    const book = await getBookBySlug(slug);
    if (!book) return null;
    const rows = await db
      .select({
        number: readingChapters.number,
        title: readingChapters.title,
        presentation: readingChapters.presentation,
      })
      .from(readingChapters)
      .where(and(eq(readingChapters.bookId, book.id), eq(readingChapters.number, number)))
      .limit(1);
    if (!rows.length || !rows[0].presentation) return null;
    const prevNext = await db
      .select({ number: readingChapters.number })
      .from(readingChapters)
      .where(and(eq(readingChapters.bookId, book.id), sql`${readingChapters.presentation} is not null`))
      .orderBy(asc(readingChapters.number));
    const nums = prevNext.map((r) => r.number);
    const pos = nums.indexOf(number);
    return {
      book: { slug: book.slug, title: book.title },
      title: rows[0].title,
      presentation: rows[0].presentation,
      prev: pos > 0 ? nums[pos - 1] : null,
      next: pos >= 0 && pos < nums.length - 1 ? nums[pos + 1] : null,
    };
  }, null);
}

/** Índice dos capítulos de leitura (sem a coluna `text`). */
export async function listReadingChapters(bookId: string) {
  return safeQuery(
    async () =>
      db
        .select({
          id: readingChapters.id,
          number: readingChapters.number,
          slug: readingChapters.slug,
          title: readingChapters.title,
          wordCount: readingChapters.wordCount,
        })
        .from(readingChapters)
        .where(eq(readingChapters.bookId, bookId))
        .orderBy(asc(readingChapters.number)),
    [] as { id: string; number: number; slug: string; title: string; wordCount: number }[]
  );
}

/** Trechos/notas de um livro (ou de um capítulo). */
export async function listHighlights(bookId: string, chapterNumber?: number) {
  return safeQuery(async () => {
    const conds = [eq(bookHighlights.userId, USER_ID), eq(bookHighlights.bookId, bookId)];
    if (chapterNumber != null) conds.push(eq(bookHighlights.chapterNumber, chapterNumber));
    return db
      .select()
      .from(bookHighlights)
      .where(and(...conds))
      .orderBy(asc(bookHighlights.chapterNumber), asc(bookHighlights.startWordIndex));
  }, [] as Highlight[]);
}

// ── Sync do app mobile (Fragmentos) ────────────────────────────────────────

/** Catálogo enxuto p/ o app: livro + capítulos (sem `text`) + total de palavras. */
export async function listLibraryForSync() {
  return safeQuery(async () => {
    const rows = await db.select().from(books).orderBy(asc(books.title));
    const chapters = await db
      .select({
        bookId: readingChapters.bookId,
        number: readingChapters.number,
        title: readingChapters.title,
        wordCount: readingChapters.wordCount,
      })
      .from(readingChapters)
      .orderBy(asc(readingChapters.bookId), asc(readingChapters.number));

    const byBook = new Map<string, typeof chapters>();
    for (const c of chapters) {
      const list = byBook.get(c.bookId);
      if (list) list.push(c);
      else byBook.set(c.bookId, [c]);
    }

    return rows
      .map((b) => {
        const chs = byBook.get(b.id) ?? [];
        return {
          slug: b.slug,
          title: b.title,
          authors: b.authors,
          coverUrl: b.coverUrl,
          summary: b.summary,
          chapterCount: chs.length,
          wordCount: chs.reduce((sum, c) => sum + c.wordCount, 0),
          chapters: chs.map((c) => ({
            number: c.number,
            title: c.title,
            wordCount: c.wordCount,
          })),
        };
      })
      .filter((b) => b.chapterCount > 0);
  }, [] as {
    slug: string;
    title: string;
    authors: string;
    coverUrl: string | null;
    summary: string | null;
    chapterCount: number;
    wordCount: number;
    chapters: { number: number; title: string; wordCount: number }[];
  }[]);
}

/** Texto integral de um livro, para o app baixar e ler offline. */
export async function getBookTextForSync(slug: string) {
  return safeQuery(async () => {
    const book = await getBookBySlug(slug);
    if (!book) return null;
    const chapters = await db
      .select({
        number: readingChapters.number,
        title: readingChapters.title,
        text: readingChapters.text,
        wordCount: readingChapters.wordCount,
      })
      .from(readingChapters)
      .where(eq(readingChapters.bookId, book.id))
      .orderBy(asc(readingChapters.number));
    return {
      slug: book.slug,
      title: book.title,
      authors: book.authors,
      coverUrl: book.coverUrl,
      chapters,
    };
  }, null);
}

/** Um capítulo de leitura + adjacentes + posição salva. */
export async function getReadingChapter(slug: string, number: number) {
  return safeQuery(async () => {
    const book = await getBookBySlug(slug);
    if (!book) return null;
    const rows = await db
      .select({
        id: readingChapters.id,
        number: readingChapters.number,
        slug: readingChapters.slug,
        title: readingChapters.title,
        text: readingChapters.text,
      })
      .from(readingChapters)
      .where(and(eq(readingChapters.bookId, book.id), eq(readingChapters.number, number)))
      .limit(1);
    if (!rows.length) return null;
    const prev = await db
      .select({ number: readingChapters.number })
      .from(readingChapters)
      .where(and(eq(readingChapters.bookId, book.id), sql`${readingChapters.number} < ${number}`))
      .orderBy(desc(readingChapters.number))
      .limit(1);
    const next = await db
      .select({ number: readingChapters.number })
      .from(readingChapters)
      .where(and(eq(readingChapters.bookId, book.id), sql`${readingChapters.number} > ${number}`))
      .orderBy(asc(readingChapters.number))
      .limit(1);
    const rs = await db
      .select()
      .from(readState)
      .where(and(eq(readState.userId, USER_ID), eq(readState.bookId, book.id)))
      .limit(1);
    return {
      book,
      chapter: rows[0],
      prev: prev[0]?.number ?? null,
      next: next[0]?.number ?? null,
      readState: rs[0] ?? null,
    };
  }, null);
}
