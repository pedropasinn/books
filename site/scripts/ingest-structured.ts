/**
 * Ingere conteúdo ESTRUTURADO (formato Reale/HPE: data/<obra>/metadata.json +
 * capitulos/*.json) como um livro de leitura no books. Cada capítulo JSON vira
 * um reading_chapter (texto montado de hero + seções). É como graphs/filosofia/HPE
 * entram na plataforma sem re-extrair PDF — o texto já foi curado lá.
 *
 * Uso: tsx scripts/ingest-structured.ts <obraDir> [slugOverride] [source]
 *   <obraDir>: pasta com metadata.json e capitulos/  (abs ou relativo a site/)
 *   Ex.: tsx scripts/ingest-structured.ts ../../HPE/data/hpe-insper hpe hpe
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createId } from "./id";
import { db, books, readingChapters } from "../lib/db";
import { eq } from "drizzle-orm";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(s: unknown): string {
  return decodeEntities(String(s ?? "").replace(/<[^>]+>/g, "")).trim();
}

function wordCount(s: string): number {
  return s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

type Cap = Record<string, any>;

function chapterText(cap: Cap): string {
  const parts: string[] = [];
  const hero = cap.hero ?? {};
  if (hero.subtitulo) parts.push(stripHtml(hero.subtitulo));
  const epi = hero.epigrafe;
  if (epi?.texto) parts.push(`“${stripHtml(epi.texto)}”${epi.autor ? ` — ${stripHtml(epi.autor)}` : ""}`);

  for (const sec of cap.secoes ?? []) {
    if (sec.titulo) parts.push(stripHtml(sec.titulo));
    if (sec.subtitulo) parts.push(stripHtml(sec.subtitulo));
    if (sec.lead) parts.push(stripHtml(sec.lead));
    const corpo = Array.isArray(sec.corpo) ? sec.corpo : sec.corpo ? [sec.corpo] : [];
    for (const p of corpo) parts.push(stripHtml(p));
    for (const kp of sec.key_points ?? []) {
      const t = typeof kp === "string" ? kp : kp?.texto ?? "";
      if (t) parts.push("• " + stripHtml(t));
    }
  }
  if (cap.pullquote) {
    const pq = typeof cap.pullquote === "string" ? cap.pullquote : cap.pullquote?.texto ?? "";
    if (pq) parts.push("“" + stripHtml(pq) + "”");
  }
  return parts.map((p) => p.trim()).filter(Boolean).join("\n\n");
}

async function main() {
  const obraArg = process.argv[2];
  const slugOverride = process.argv[3];
  const source = process.argv[4] ?? "import";
  if (!obraArg) {
    console.error("Uso: tsx scripts/ingest-structured.ts <obraDir> [slug] [source]");
    process.exit(1);
  }
  const obraDir = resolve(process.cwd(), obraArg);
  const metaPath = join(obraDir, "metadata.json");
  const capsDir = join(obraDir, "capitulos");
  if (!existsSync(metaPath) || !existsSync(capsDir)) {
    console.error(`Esperado metadata.json e capitulos/ em ${obraDir}`);
    process.exit(1);
  }

  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const slug = slugOverride ?? meta.slug;
  const title: string = meta.titulo ?? meta.title ?? slug;
  const authors: string =
    meta.autor ?? (Array.isArray(meta.autores) ? meta.autores.join(", ") : meta.author) ?? "—";
  const summary: string | null = stripHtml(meta.sinopse ?? meta.subtitulo ?? "") || null;

  // Lê e ordena os capítulos; dedup por slug.
  const files = readdirSync(capsDir).filter((f) => f.endsWith(".json"));
  const bySlug = new Map<string, Cap>();
  for (const f of files) {
    const cap = JSON.parse(readFileSync(join(capsDir, f), "utf8")) as Cap;
    bySlug.set(cap.slug ?? f, cap);
  }
  const caps = [...bySlug.values()].sort(
    (a, b) => (a.ordem ?? a.numero ?? 0) - (b.ordem ?? b.numero ?? 0)
  );

  // Upsert do livro.
  const existing = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  let bookId: string;
  if (existing.length) {
    bookId = existing[0].id;
    await db.update(books).set({ title, authors, summary }).where(eq(books.id, bookId));
  } else {
    bookId = createId();
    await db.insert(books).values({ id: bookId, slug, title, authors, summary, language: "pt-BR" });
  }

  // Substitui os capítulos de leitura.
  const rows = caps
    .map((cap, i) => {
      const text = chapterText(cap);
      if (!text) return null;
      const chTitle = stripHtml(cap.hero?.titulo ?? cap.titulo ?? cap.slug) || `Capítulo ${i + 1}`;
      return {
        id: createId(),
        bookId,
        number: i + 1,
        slug: String(cap.slug ?? `cap-${i + 1}`),
        title: chTitle,
        text,
        wordCount: wordCount(text),
        charCount: text.length,
        contentKind: "book" as const,
        source,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  await db.delete(readingChapters).where(eq(readingChapters.bookId, bookId));
  if (rows.length) await db.insert(readingChapters).values(rows);

  const totalWords = rows.reduce((a, r) => a + r.wordCount, 0);
  console.log(
    `${slug} — "${title}": ${rows.length} capítulos, ${totalWords.toLocaleString("pt-BR")} palavras [source=${source}]`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
