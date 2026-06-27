import { pgTable, text, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const books = pgTable("books", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  authors: text("authors").notNull(),
  coverUrl: text("cover_url"),
  epubUrl: text("epub_url"),
  summary: text("summary"),
  language: text("language").default("pt-BR"),
  createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()),
});

export const episodes = pgTable("episodes", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  scriptText: text("script_text").notNull(),
  audioUrl: text("audio_url"),
  alignmentUrl: text("alignment_url"),
  durationSec: integer("duration_sec"),
  status: text("status", { enum: ["draft", "audio_pending", "aligned", "ready"] })
    .notNull()
    .default("draft"),
});

export const progress = pgTable(
  "progress",
  {
    userId: text("user_id").notNull(),
    episodeId: text("episode_id").notNull().references(() => episodes.id, { onDelete: "cascade" }),
    positionSec: integer("position_sec").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    lastPlayedAt: timestamp("last_played_at", { mode: "date" }).$defaultFn(() => new Date()),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.episodeId] }) })
);

export const readState = pgTable(
  "read_state",
  {
    userId: text("user_id").notNull(),
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    cfi: text("cfi"),
    lastReadAt: timestamp("last_read_at", { mode: "date" }).$defaultFn(() => new Date()),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.bookId] }) })
);

export const booksRelations = relations(books, ({ many }) => ({
  episodes: many(episodes),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  book: one(books, { fields: [episodes.bookId], references: [books.id] }),
}));
