import { CORS_HEADERS, mobileAuthOk, unauthorized } from "@/lib/mobile-auth";
import { listLibraryForSync } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Catálogo para o app Fragmentos: livros + índice de capítulos (sem texto). */
export async function GET(req: Request) {
  if (!mobileAuthOk(req)) return unauthorized();
  const library = await listLibraryForSync();
  return Response.json({ books: library }, { headers: CORS_HEADERS });
}
