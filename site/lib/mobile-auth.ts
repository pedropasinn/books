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
export type MobileAuth = "ok" | "sem-token-configurado" | "recusado";

/**
 * Aceita SOMENTE `MOBILE_SYNC_TOKEN` — a `SITE_PASSWORD` não serve aqui, de
 * propósito. O token fica guardado no aparelho (e entra no backup do Android),
 * então ele tem que ser descartável: se o celular sumir, troca-se a variável
 * de ambiente e o acesso morre, sem mexer na senha que abre o site inteiro.
 */
export function mobileAuth(req: Request): MobileAuth {
  const expected = process.env.MOBILE_SYNC_TOKEN;
  if (!expected) return "sem-token-configurado";

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token || !timingSafeEqual(expected, token)) return "recusado";
  return "ok";
}

/** Comparação de tempo constante (evita vazar o tamanho/prefixo do token). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Resposta para quem não passou. Distingue "token errado" de "servidor sem
 * token configurado" — o segundo caso é erro de configuração do dono, e ficar
 * devolvendo 401 mandaria ele procurar o problema no lugar errado.
 */
export function denied(motivo: Exclude<MobileAuth, "ok">): Response {
  if (motivo === "sem-token-configurado") {
    return Response.json(
      {
        error: "sync_desativada",
        detail:
          "Defina MOBILE_SYNC_TOKEN nas variáveis de ambiente do site para liberar o app.",
      },
      { status: 503, headers: CORS_HEADERS }
    );
  }
  return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
}

/** CORS liberado: o WebView do Capacitor tem origem `https://localhost`. */
export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, OPTIONS",
} as const;
