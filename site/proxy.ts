import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Gate de senha (Next 16: "middleware" virou "proxy").
// Protege todo o app; libera /login, /api/login e os assets do Next.
export function proxy(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  const token = request.cookies.get("fr_session")?.value;
  if (secret && token && token === secret) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/login).*)"],
};
