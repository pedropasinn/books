import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { createId } from "./id";
import { db, books, episodes } from "../lib/db";
import { eq, and } from "drizzle-orm";

const CONTENT_DIR = resolve(process.cwd(), process.env.CONTENT_DIR ?? "../content");

type BookYaml = {
  slug: string;
  title: string;
  authors: string;
  language?: string;
  summary?: string;
  cover?: string;
  epub?: string;
};

type AudioManifestEntry = {
  id: string;
  title?: string;
  duration_min?: number;
  duration_sec?: number;
};

function extractTitle(scriptText: string, fallback: string): string {
  const firstLine = scriptText.split("\n").find((l) => l.trim().length > 0) ?? "";
  // "Episódio um. Prólogo: o livro que pede pra você pensar de novo."
  const m = firstLine.match(/Epis[oó]dio\s+[^.]+\.\s*(.+?)\.?\s*$/i);
  if (m) {
    const t = m[1].trim();
    return t.length > 80 ? t.slice(0, 80) + "…" : t;
  }
  return fallback;
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function ingestBook(bookDir: string) {
  const ymlPath = join(bookDir, "book.yml");
  if (!existsSync(ymlPath)) {
    console.log(`  skip ${bookDir} (no book.yml)`);
    return;
  }
  const meta = parseYaml(readFileSync(ymlPath, "utf8")) as BookYaml;
  console.log(`\nIngesting ${meta.slug} — ${meta.title}`);

  const existing = await db.select().from(books).where(eq(books.slug, meta.slug)).limit(1);
  let bookId: string;
  if (existing.length) {
    bookId = existing[0].id;
    await db.update(books).set({
      title: meta.title,
      authors: meta.authors,
      summary: meta.summary ?? null,
      language: meta.language ?? "pt-BR",
      coverUrl: meta.cover ? `/content/${meta.slug}/${meta.cover}` : null,
      epubUrl: meta.epub ? `/content/${meta.slug}/${meta.epub}` : null,
    }).where(eq(books.id, bookId));
    console.log(`  updated book ${bookId}`);
  } else {
    bookId = createId();
    await db.insert(books).values({
      id: bookId,
      slug: meta.slug,
      title: meta.title,
      authors: meta.authors,
      summary: meta.summary ?? null,
      language: meta.language ?? "pt-BR",
      coverUrl: meta.cover ? `/content/${meta.slug}/${meta.cover}` : null,
      epubUrl: meta.epub ? `/content/${meta.slug}/${meta.epub}` : null,
    });
    console.log(`  created book ${bookId}`);
  }

  const scriptsDir = join(bookDir, "scripts");
  const audioDir = join(bookDir, "audio");
  const alignDir = join(bookDir, "alignment");
  const audioManifestPath = join(bookDir, "audio_manifest.json");

  let audioManifest = new Map<string, AudioManifestEntry>();
  if (existsSync(audioManifestPath)) {
    try {
      const arr = JSON.parse(readFileSync(audioManifestPath, "utf8")) as AudioManifestEntry[];
      for (const entry of arr) audioManifest.set(entry.id, entry);
      console.log(`  audio manifest: ${arr.length} entries`);
    } catch (e) {
      console.warn(`  audio_manifest.json parse error: ${e}`);
    }
  }

  if (!existsSync(scriptsDir)) {
    console.log(`  no scripts/ — skipping episodes`);
    return;
  }

  const files = readdirSync(scriptsDir)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  for (const file of files) {
    const m = file.match(/^(\d+)_(.+)\.txt$/);
    if (!m) continue;
    const number = parseInt(m[1], 10);
    const slugPart = m[2];
    const epId = `${m[1]}_${slugPart}`;
    const scriptText = readFileSync(join(scriptsDir, file), "utf8");
    const manifestEntry = audioManifest.get(epId);
    const title =
      manifestEntry?.title?.trim() || extractTitle(scriptText, slugToTitle(slugPart));

    const audioFile = `${epId}.mp3`;
    const alignFile = `${epId}.json`;
    const hasAudio = existsSync(join(audioDir, audioFile));
    const hasAlign = existsSync(join(alignDir, alignFile));

    const status: "draft" | "audio_pending" | "aligned" | "ready" =
      !hasAudio ? "audio_pending" : hasAlign ? "ready" : "aligned";

    const audioUrl = hasAudio ? `/content/${meta.slug}/audio/${audioFile}` : null;
    const alignmentUrl = hasAlign ? `/content/${meta.slug}/alignment/${alignFile}` : null;

    let durationSec: number | null = null;
    if (manifestEntry?.duration_sec != null) durationSec = Math.round(manifestEntry.duration_sec);
    else if (manifestEntry?.duration_min != null) durationSec = Math.round(manifestEntry.duration_min * 60);

    const ex = await db.select().from(episodes).where(
      and(eq(episodes.bookId, bookId), eq(episodes.number, number))
    ).limit(1);

    if (ex.length) {
      await db.update(episodes).set({
        title,
        scriptText,
        audioUrl,
        alignmentUrl,
        status,
        durationSec,
      }).where(eq(episodes.id, ex[0].id));
      console.log(`  ep ${number.toString().padStart(2, "0")} ${title}  [${status}]${durationSec ? `  ${Math.round(durationSec/60)}min` : ""}  (updated)`);
    } else {
      await db.insert(episodes).values({
        id: createId(),
        bookId,
        number,
        title,
        scriptText,
        audioUrl,
        alignmentUrl,
        status,
        durationSec,
      });
      console.log(`  ep ${number.toString().padStart(2, "0")} ${title}  [${status}]${durationSec ? `  ${Math.round(durationSec/60)}min` : ""}  (new)`);
    }
  }
}

async function main() {
  if (!existsSync(CONTENT_DIR)) {
    console.error(`Content dir not found: ${CONTENT_DIR}`);
    process.exit(1);
  }
  console.log(`Content dir: ${CONTENT_DIR}`);
  const dirs = readdirSync(CONTENT_DIR).filter((d) => {
    const p = join(CONTENT_DIR, d);
    return statSync(p).isDirectory();
  });
  for (const d of dirs) {
    await ingestBook(join(CONTENT_DIR, d));
  }
  console.log("\nDone.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
