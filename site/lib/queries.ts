import "server-only";
import { db, books, episodes, progress, readState } from "@/lib/db";
import { eq, and, asc, desc, sql } from "drizzle-orm";

const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? "pedro";

export async function listBooks() {
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

  return rows.map((b) => ({
    ...b,
    totalEpisodes: totalByBook.get(b.id) ?? 0,
    completedEpisodes: doneByBook.get(b.id) ?? 0,
  }));
}

export async function getBookBySlug(slug: string) {
  const rows = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function listEpisodesForBook(bookId: string) {
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
}

export async function getEpisode(bookSlug: string, number: number) {
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
}

export async function getReadingPosition(bookId: string) {
  const rows = await db
    .select()
    .from(readState)
    .where(and(eq(readState.userId, USER_ID), eq(readState.bookId, bookId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAllProgress() {
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
}

export async function getContinueListening(limit = 6) {
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
}

export async function getAdjacentEpisodes(bookId: string, number: number) {
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
}
