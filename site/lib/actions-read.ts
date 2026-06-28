"use server";

import { db, readState, bookHighlights } from "@/lib/db";
import { and, eq } from "drizzle-orm";

const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? "pedro";

/** Salva a posição de leitura do livro (capítulo + palavra), upsert por (user, book). */
export async function saveReadingProgress(input: {
  bookId: string;
  chapterNumber: number;
  wordIndex: number;
}) {
  const existing = await db
    .select()
    .from(readState)
    .where(and(eq(readState.userId, USER_ID), eq(readState.bookId, input.bookId)))
    .limit(1);
  const now = new Date();
  const chapterNumber = Math.max(1, Math.floor(input.chapterNumber));
  const wordIndex = Math.max(0, Math.floor(input.wordIndex));
  if (existing.length) {
    await db
      .update(readState)
      .set({ chapterNumber, wordIndex, lastReadAt: now })
      .where(and(eq(readState.userId, USER_ID), eq(readState.bookId, input.bookId)));
  } else {
    await db
      .insert(readState)
      .values({ userId: USER_ID, bookId: input.bookId, chapterNumber, wordIndex, lastReadAt: now });
  }
}

/** Salva um trecho (highlight), opcionalmente com nota. Retorna o id. */
export async function saveHighlight(input: {
  bookId: string;
  chapterNumber: number;
  startWordIndex: number;
  endWordIndex: number;
  snippet: string;
  color?: string;
  note?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(bookHighlights).values({
    id,
    userId: USER_ID,
    bookId: input.bookId,
    chapterNumber: input.chapterNumber,
    startWordIndex: input.startWordIndex,
    endWordIndex: input.endWordIndex,
    snippet: input.snippet.slice(0, 2000),
    color: input.color ?? "brand",
    note: input.note?.trim() ? input.note.trim() : null,
  });
  return id;
}

export async function updateHighlight(id: string, patch: { note?: string; color?: string }) {
  await db
    .update(bookHighlights)
    .set({
      ...(patch.note !== undefined ? { note: patch.note.trim() || null } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
    })
    .where(and(eq(bookHighlights.userId, USER_ID), eq(bookHighlights.id, id)));
}

export async function deleteHighlight(id: string) {
  await db
    .delete(bookHighlights)
    .where(and(eq(bookHighlights.userId, USER_ID), eq(bookHighlights.id, id)));
}
