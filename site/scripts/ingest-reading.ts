/**
 * Ingestão do TEXTO de leitura de um livro (distinto dos roteiros de podcast do
 * ingest.ts). Extrai o PDF com pdftotext, divide em capítulos e popula a tabela
 * readingChapters. O texto canônico vive no banco; o PDF/_raw.txt são insumos.
 *
 * Uso: tsx scripts/ingest-reading.ts <slug>
 *   Lê content/<slug>/reading_manifest.json. Dois modos:
 *   - mode "chapters": ranges de linha curados [{number,slug,title,lineStart,lineEnd}]
 *   - mode "pages" (default): divide por páginas (form-feed), pagesPerChapter,
 *     startPage/endPage opcionais (1-indexed) para recortar rosto/notas.
 *   Sem manifest: assume mode "pages" com pagesPerChapter=30.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { createId } from "./id";
import { db, books, readingChapters } from "../lib/db";
import { eq } from "drizzle-orm";

const CONTENT_DIR = resolve(process.cwd(), process.env.CONTENT_DIR ?? "../content");

type ManifestChapter = { number: number; slug: string; title: string; lineStart: number; lineEnd: number };
type Manifest = {
  pdf?: string;
  source?: string;
  mode?: "chapters" | "pages";
  pagesPerChapter?: number;
  startPage?: number;
  endPage?: number;
  chapters?: ManifestChapter[];
};

type Chapter = { number: number; slug: string; title: string; text: string };

function wordCount(s: string): number {
  return s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

/** Une linhas de um parágrafo num fluxo legível; mantém \n\n entre parágrafos. */
function cleanBlock(s: string): string {
  return s
    .replace(/­/g, "") // soft hyphen
    .replace(/-\n(?=\p{Ll})/gu, "") // hifenização de fim de linha (minúscula seguinte)
    .split(/\n[ \t]*\n+/) // parágrafos = linhas em branco
    .map((p) => p.replace(/\s*\n\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim())
    .filter((p) => p.length > 0)
    .join("\n\n");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "capitulo";
}

function buildFromManifestChapters(rawLines: string[], chapters: ManifestChapter[]): Chapter[] {
  return chapters.map((c) => ({
    number: c.number,
    slug: c.slug,
    title: c.title,
    text: cleanBlock(rawLines.slice(c.lineStart - 1, c.lineEnd).join("\n")),
  }));
}

function buildFromPages(raw: string, m: Manifest): Chapter[] {
  const pages = raw.split("\f");
  const start = (m.startPage ?? 1) - 1;
  const end = m.endPage ?? pages.length;
  const body = pages.slice(start, end);
  const per = m.pagesPerChapter ?? 30;
  const out: Chapter[] = [];
  for (let i = 0; i < body.length; i += per) {
    const number = out.length + 1;
    const text = cleanBlock(body.slice(i, i + per).join("\n\n"));
    if (!text) continue;
    out.push({ number, slug: `parte-${number}`, title: `Parte ${number}`, text });
  }
  return out;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Uso: tsx scripts/ingest-reading.ts <slug>");
    process.exit(1);
  }
  const bookDir = join(CONTENT_DIR, slug);
  if (!existsSync(bookDir)) {
    console.error(`Pasta não encontrada: ${bookDir}`);
    process.exit(1);
  }

  const manifestPath = join(bookDir, "reading_manifest.json");
  const manifest: Manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest)
    : {};

  const pdfPath = join(bookDir, manifest.pdf ?? "book.pdf");
  if (!existsSync(pdfPath)) {
    console.error(`PDF não encontrado: ${pdfPath}`);
    process.exit(1);
  }

  // Extrai texto (modo de fluxo, melhor p/ prosa). Regenera sempre (idempotente).
  const readingDir = join(bookDir, "reading");
  mkdirSync(readingDir, { recursive: true });
  const rawPath = join(readingDir, "_raw.txt");
  console.log(`Extraindo ${pdfPath} → ${rawPath}`);
  execFileSync("pdftotext", ["-enc", "UTF-8", pdfPath, rawPath]);
  const raw = readFileSync(rawPath, "utf8");

  const mode = manifest.mode ?? (manifest.chapters?.length ? "chapters" : "pages");
  const chapters =
    mode === "chapters" && manifest.chapters?.length
      ? buildFromManifestChapters(raw.split("\n"), manifest.chapters)
      : buildFromPages(raw, manifest);

  if (!chapters.length) {
    console.error("Nenhum capítulo gerado (PDF vazio?).");
    process.exit(1);
  }

  // Grava capítulos divididos p/ inspeção.
  for (const c of chapters) {
    writeFileSync(
      join(readingDir, `${c.number.toString().padStart(2, "0")}_${slugify(c.slug)}.txt`),
      c.text
    );
  }

  // Resolve o livro (criado por `pnpm ingest` via book.yml).
  const book = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  if (!book.length) {
    console.error(`Livro "${slug}" não está no banco. Rode "pnpm ingest" primeiro (precisa de book.yml).`);
    process.exit(1);
  }
  const bookId = book[0].id;

  // Idempotente: substitui os capítulos de leitura do livro.
  await db.delete(readingChapters).where(eq(readingChapters.bookId, bookId));
  await db.insert(readingChapters).values(
    chapters.map((c) => ({
      id: createId(),
      bookId,
      number: c.number,
      slug: c.slug,
      title: c.title,
      text: c.text,
      wordCount: wordCount(c.text),
      charCount: c.text.length,
      contentKind: "book" as const,
      source: manifest.source ?? "pdf",
    }))
  );

  const totalWords = chapters.reduce((a, c) => a + wordCount(c.text), 0);
  console.log(`\n${slug}: ${chapters.length} capítulos, ${totalWords.toLocaleString("pt-BR")} palavras (modo ${mode}).`);
  chapters.forEach((c) =>
    console.log(`  ${c.number.toString().padStart(2, "0")} ${c.title}  (${wordCount(c.text).toLocaleString("pt-BR")} palavras)`)
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
