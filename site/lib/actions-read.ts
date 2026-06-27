"use server";

import { db, readState } from "@/lib/db";
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
