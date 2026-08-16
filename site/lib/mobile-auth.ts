import "server-only";

/**
 * Autenticação das rotas /api/mobile/* (consumidas pelo APK "Fragmentos").
 *
 * O site inteiro é fechado por senha no `proxy.ts` via cookie `fr_session`.
 * Um WebView nativo não faz o fluxo de formulário, então as rotas do app
 * ficam fora do gate do proxy e se autenticam por header:
 *
 *   Authorization: Bearer <SITE_PASSWORD>
 *
 * Aceita também `MOBILE_SYNC_TOKEN`, para poder revogar o acesso do celular
 * sem trocar a senha do site.
 */
export function mobileAuthOk(req: Request): boolean {
  const expected = [process.env.MOBILE_SYNC_TOKEN, process.env.SITE_PASSWORD].filter(
    (v): v is string => !!v
  );
  if (!expected.length) return false;

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return false;

  return expected.some((v) => timingSafeEqual(v, token));
}

/** Comparação de tempo constante (evita vazar o tamanho/prefixo do token). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/** CORS liberado: o WebView do Capacitor tem origem `https://localhost`. */
export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, OPTIONS",
} as const;
