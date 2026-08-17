import { ABA, aba, abrir, checar, escrever, esconder, ok } from "./helpers.mjs";
import { POEMA } from "./fixtures.mjs";

/**
 * Modo foco e a garantia de que o texto nunca é cortado.
 *
 * O corpo de teste é um poema de propósito: versos não terminam em ponto, e
 * era exatamente esse caso que estourava a tela.
 */

const AUTO_ESCONDE_MS = 4000;

export default async function () {
  const { browser, page, erros } = await abrir();

  await page.click("text=Abrir a biblioteca");
  await page.locator('input[type="file"]').setInputFiles(escrever("poema.txt", POEMA));
  await page.waitForSelector(".feed", { timeout: 20_000 });
  await page.waitForTimeout(400);

  const estado = () =>
    page.evaluate(() => ({
      foco: document.querySelector(".feed")?.getAttribute("data-focus"),
      abas: document.querySelector(".tabs")?.getAttribute("data-hidden"),
      topo: getComputedStyle(document.querySelector(".feed__top")).opacity,
      acoes: getComputedStyle(document.querySelector(".feed__actions")).opacity,
    }));

  /** O cartão da vez está cortando texto? */
  const medir = () =>
    page.evaluate(() => {
      const caixa = document.querySelectorAll(".card")[1].querySelector(".card__text");
      const p = caixa.querySelector("p");
      if (!p) return null;
      return {
        excesso: p.scrollHeight - caixa.clientHeight,
        fonte: parseFloat(getComputedStyle(p).fontSize),
        palavras: p.textContent.trim().split(/\s+/).length,
      };
    });

  const inicial = await estado();
  checar(inicial.foco === "true" && inicial.abas === "true", "não abriu em modo foco");
  checar(inicial.topo === "0" && inicial.acoes === "0", "controles visíveis no modo foco");
  ok("abre em modo foco: só o texto, sem barras nem abas");

  async function varrer(rotulo, limite) {
    let menorFonte = Infinity;
    let maiorFrag = 0;
    let n = 0;
    for (let i = 0; i < limite; i++) {
      const m = await medir();
      if (!m) break; // cartão terminal
      n++;
      menorFonte = Math.min(menorFonte, m.fonte);
      maiorFrag = Math.max(maiorFrag, m.palavras);
      checar(
        m.excesso <= 1,
        `${rotulo}: fragmento ${i} vaza ${m.excesso}px (${m.palavras} palavras, ${m.fonte}px)`
      );
      await page.mouse.click(370, 430);
      await page.waitForTimeout(300);
    }
    ok(`${rotulo}: ${n} fragmentos sem vazar (maior ${maiorFrag} palavras, fonte mín. ${menorFonte}px)`);
    return { menorFonte, maiorFrag };
  }

  await varrer("padrão", 40);

  // Caso extremo: fragmento e fonte no máximo. Sem o limite por capacidade, o
  // cortador produziria um cartão que nem o auto-fit acomoda em tamanho legível.
  await aba(page, ABA.ajustes);
  await page.waitForSelector("text=Tamanho do fragmento", { timeout: 5000 });
  await page.locator('input[type="range"]').nth(0).fill("120");
  await page.locator('input[type="range"]').nth(1).fill("1.6");
  await aba(page, ABA.ler);
  await page.waitForTimeout(500);

  const extremo = await varrer("fragmento e fonte no máximo", 12);
  checar(extremo.menorFonte < 21 * 1.6, "o auto-fit não encolheu nada no caso extremo");
  checar(extremo.maiorFrag < 120, "o limite por capacidade não cortou o fragmento");
  ok("no extremo, capacidade limita o fragmento e o auto-fit ajusta a fonte");

  await aba(page, ABA.ajustes);
  await page.locator('input[type="range"]').nth(0).fill("55");
  await page.locator('input[type="range"]').nth(1).fill("1");
  await aba(page, ABA.ler);
  await page.waitForTimeout(400);

  // Volta alguns cartões: a varredura pode ter parado no fim.
  for (let i = 0; i < 4; i++) {
    await page.mouse.click(20, 430);
    await page.waitForTimeout(300);
  }

  await esconder(page);
  await page.mouse.click(196, 430);
  await page.waitForTimeout(450);
  const comControles = await estado();
  checar(
    comControles.foco === "false" && comControles.abas === "false",
    "toque no meio não trouxe os controles"
  );
  ok("toque no meio revela controles e abas");

  const m = await medir();
  checar(m && m.excesso <= 1, "vaza com os controles à vista");
  ok("com os controles à vista o texto continua inteiro");

  await page.mouse.click(196, 430);
  await page.waitForTimeout(400);
  checar((await estado()).foco === "true", "segundo toque no meio não escondeu");
  ok("segundo toque volta ao foco");

  await page.mouse.click(196, 430);
  await page.waitForTimeout(300);
  checar((await estado()).foco === "false", "controles não apareceram para o teste de espera");
  await page.waitForTimeout(AUTO_ESCONDE_MS + 700);
  checar((await estado()).foco === "true", "controles não sumiram sozinhos");
  ok("controles somem sozinhos depois de parado");

  const versos = await page.evaluate(() => {
    const p = document.querySelectorAll(".card")[1].querySelector("p");
    return {
      branco: getComputedStyle(p).whiteSpace,
      quebras: (p.textContent.match(/\n/g) ?? []).length,
    };
  });
  checar(versos.branco === "pre-wrap", "o cartão não preserva quebras de linha");
  ok(`versos preservados (${versos.quebras} quebras no cartão)`);

  await browser.close();
  return erros;
}
