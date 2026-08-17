import { chromium } from "playwright";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const URL_APP = process.env.E2E_URL ?? "http://127.0.0.1:5299/";

/**
 * O Chromium do Playwright pode estar num caminho fixo (imagem de CI) ou vir
 * da instalação normal do pacote. `E2E_CHROMIUM` cobre o primeiro caso.
 */
const EXECUTABLE = process.env.E2E_CHROMIUM;

export const TMP = mkdtempSync(join(tmpdir(), "fragmentos-e2e-"));

export function escrever(nome, dados) {
  const caminho = join(TMP, nome);
  writeFileSync(caminho, typeof dados === "string" ? dados : Buffer.from(dados));
  return caminho;
}

/** Abre um navegador em formato de celular, coletando erros de console. */
export async function abrir({ width = 393, height = 851 } = {}) {
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  const page = await browser.newPage({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });

  const erros = [];
  page.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("favicon")) erros.push(`console: ${m.text()}`);
  });

  await page.goto(URL_APP, { waitUntil: "networkidle" });
  return { browser, page, erros };
}

const MEIO_X = 196;
const MEIO_Y = 430;

/**
 * O feed abre em modo foco e os controles ficam inertes (`pointer-events`
 * desligado). Qualquer passo que clique em aba ou botão precisa revelar antes
 * — é o mesmo que o usuário faz: toque no meio da tela.
 */
export async function revelar(page) {
  const foco = await page.getAttribute(".feed", "data-focus").catch(() => null);
  if (foco === "true") {
    await page.mouse.click(MEIO_X, MEIO_Y);
    await page.waitForTimeout(400);
  }
}

/** Garante o modo foco antes de um passo que dependa dele. */
export async function esconder(page) {
  if ((await page.getAttribute(".feed", "data-focus")) === "false") {
    await page.mouse.click(MEIO_X, MEIO_Y);
    await page.waitForTimeout(400);
  }
}

export async function aba(page, indice) {
  await revelar(page);
  await page.locator(".tabs__item").nth(indice).click();
  await page.waitForTimeout(250);
}

export const ABA = { ler: 0, livros: 1, habito: 2, ajustes: 3 };

/** Texto do cartão que está na tela (o do meio do deck de três). */
export const cartaoAtual = (page) => page.locator(".card").nth(1).innerText();

export function checar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

export function ok(mensagem) {
  console.log(`  ✓ ${mensagem}`);
}
