import { NextResponse } from "next/server";

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));

  if (!process.env.SITE_PASSWORD || password !== process.env.SITE_PASSWORD) {
    const url = new URL("/login", request.url);
    url.searchParams.set("e", "1");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  }

  const res = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  res.cookies.set("fr_session", process.env.SESSION_SECRET ?? "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 dias
  });
  return res;
}
