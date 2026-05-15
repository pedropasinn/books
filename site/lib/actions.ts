"use server";

import { db, progress } from "@/lib/db";
import { and, eq } from "drizzle-orm";

const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? "pedro";

export async function saveProgress(input: {
  episodeId: string;
  positionSec: number;
  completed?: boolean;
}) {
  const existing = await db
    .select()
    .from(progress)
    .where(and(eq(progress.userId, USER_ID), eq(progress.episodeId, input.episodeId)))
    .limit(1);

  const now = new Date();
  if (existing.length) {
    await db
      .update(progress)
      .set({
        positionSec: Math.floor(input.positionSec),
        completed: input.completed ?? existing[0].completed,
        lastPlayedAt: now,
      })
      .where(
        and(eq(progress.userId, USER_ID), eq(progress.episodeId, input.episodeId))
      );
  } else {
    await db.insert(progress).values({
      userId: USER_ID,
      episodeId: input.episodeId,
      positionSec: Math.floor(input.positionSec),
      completed: input.completed ?? false,
      lastPlayedAt: now,
    });
  }
}

export async function markCompleted(episodeId: string, completed: boolean) {
  await saveProgress({ episodeId, positionSec: 0, completed });
}
