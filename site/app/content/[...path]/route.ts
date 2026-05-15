import { NextRequest } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, extname } from "node:path";

const CONTENT_DIR = resolve(process.cwd(), process.env.CONTENT_DIR ?? "../content");

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".epub": "application/epub+zip",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const rel = path.join("/");
  const full = resolve(join(CONTENT_DIR, rel));
  if (!full.startsWith(CONTENT_DIR + "/") && full !== CONTENT_DIR) {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const st = await stat(full);
    if (!st.isFile()) return new Response("not found", { status: 404 });
    const buf = await readFile(full);
    const type = MIME[extname(full).toLowerCase()] ?? "application/octet-stream";
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": type,
        "content-length": String(buf.byteLength),
        "cache-control": "public, max-age=3600",
        "accept-ranges": "bytes",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
