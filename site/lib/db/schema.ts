import { pgTable, text, integer, boolean, timestamp, primaryKey, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/** Estrutura de apresentação (slides) de um capítulo, vinda do JSON-fonte Reale/HPE. */
export type Presentation = {
  hero?: Record<string, unknown>;
  secoes?: Record<string, unknown>[];
  diagrama?: Record<string, unknown>;
  quiz?: Record<string, unknown>;
  pullquote?: unknown;
};

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

// Texto integral do livro, em capítulos de leitura (distinto de `episodes`, que é
// o roteiro narrado do podcast-resumo). Alimenta o leitor e o modo RSVP.
export const readingChapters = pgTable(
  "reading_chapters",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    text: text("text").notNull(),
    wordCount: integer("word_count").notNull().default(0),
    charCount: integer("char_count").notNull().default(0),
    contentKind: text("content_kind").notNull().default("book"),
    source: text("source"),
    // Estrutura de slides (apresentação) — preenchida para conteúdo estruturado.
    presentation: jsonb("presentation").$type<Presentation>(),
  },
  (t) => ({ uniq: uniqueIndex("reading_chapters_book_number").on(t.bookId, t.number) })
);

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

// Posição de leitura por livro: capítulo + palavra. `cfi` é legado do EPUB
// removido — mantido (órfão, nullable) para a migração ser aditiva; pode ser
// dropado depois com confirmação.
export const readState = pgTable(
  "read_state",
  {
    userId: text("user_id").notNull(),
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull().default(1),
    wordIndex: integer("word_index").notNull().default(0),
    cfi: text("cfi"),
    lastReadAt: timestamp("last_read_at", { mode: "date" }).$defaultFn(() => new Date()),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.bookId] }) })
);

// Trechos salvos + notas (por capítulo de leitura). Nota = highlight com `note`.
export const bookHighlights = pgTable("book_highlights", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(),
  startWordIndex: integer("start_word_index").notNull(),
  endWordIndex: integer("end_word_index").notNull(),
  snippet: text("snippet").notNull(),
  color: text("color").notNull().default("brand"),
  note: text("note"),
  createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()),
});

export const booksRelations = relations(books, ({ many }) => ({
  episodes: many(episodes),
  readingChapters: many(readingChapters),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  book: one(books, { fields: [episodes.bookId], references: [books.id] }),
}));

export const readingChaptersRelations = relations(readingChapters, ({ one }) => ({
  book: one(books, { fields: [readingChapters.bookId], references: [books.id] }),
}));
