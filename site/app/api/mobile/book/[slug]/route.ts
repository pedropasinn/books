import { CORS_HEADERS, denied, mobileAuth } from "@/lib/mobile-auth";
import { getBookTextForSync } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Texto integral de um livro — o app baixa uma vez e lê offline. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = mobileAuth(req);
  if (auth !== "ok") return denied(auth);
  const { slug } = await params;
  const book = await getBookTextForSync(slug);
  if (!book) return Response.json({ error: "not found" }, { status: 404, headers: CORS_HEADERS });
  return Response.json(book, { headers: CORS_HEADERS });
}
