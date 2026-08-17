import { spawn } from "node:child_process";
import { setTimeout as espera } from "node:timers/promises";
import { URL_APP } from "./helpers.mjs";

/**
 * Roda as suítes de ponta a ponta contra o BUILD DE PRODUÇÃO — é o que vai
 * dentro do APK, e é lá que aparecem os problemas de layout e de bundle que
 * o servidor de desenvolvimento esconde.
 *
 *   npm run build && npm run e2e
 *
 * Variáveis: E2E_URL (usar um servidor já no ar) e E2E_CHROMIUM (caminho do
 * navegador, quando o Playwright não acha sozinho).
 */

const SUITES = [
  ["feed", () => import("./feed.mjs")],
  ["foco", () => import("./foco.mjs")],
  ["import", () => import("./import.mjs")],
];

const porta = new URL(URL_APP).port || "5299";
const externo = !!process.env.E2E_URL;

async function noAr() {
  try {
    const r = await fetch(URL_APP, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

async function subirPreview() {
  const proc = spawn("npx", ["vite", "preview", "--port", porta, "--host", "127.0.0.1"], {
    stdio: "ignore",
    detached: false,
  });
  for (let i = 0; i < 40; i++) {
    if (await noAr()) return proc;
    await espera(250);
  }
  proc.kill();
  throw new Error("o servidor de preview não subiu — rode `npm run build` antes");
}

let servidor = null;
let falhou = false;

if (!externo && !(await noAr())) servidor = await subirPreview();

for (const [nome, carregar] of SUITES) {
  console.log(`\n▸ ${nome}`);
  try {
    const { default: rodar } = await carregar();
    const erros = await rodar();
    if (erros.length) {
      falhou = true;
      console.log(`  ✗ erros no console do navegador:`);
      for (const e of erros) console.log(`      ${e}`);
    }
  } catch (e) {
    falhou = true;
    console.log(`  ✗ ${e.message}`);
  }
}

servidor?.kill();
console.log(falhou ? "\nE2E falhou." : "\nE2E passou.");
process.exit(falhou ? 1 : 0);
