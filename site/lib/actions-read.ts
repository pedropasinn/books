"use server";

import { db, readState } from "@/lib/db";
import { and, eq } from "drizzle-orm";

const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? "pedro";

export async function saveReadingPosition(bookId: string, cfi: string) {
  const existing = await db
    .select()
    .from(readState)
    .where(and(eq(readState.userId, USER_ID), eq(readState.bookId, bookId)))
    .limit(1);
  const now = new Date();
  if (existing.length) {
    await db
      .update(readState)
      .set({ cfi, lastReadAt: now })
      .where(and(eq(readState.userId, USER_ID), eq(readState.bookId, bookId)));
  } else {
    await db.insert(readState).values({ userId: USER_ID, bookId, cfi, lastReadAt: now });
  }
}
