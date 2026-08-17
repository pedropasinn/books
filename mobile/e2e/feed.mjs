import { ABA, aba, abrir, cartaoAtual, checar, ok, revelar } from "./helpers.mjs";

/**
 * O feed: as três formas de avançar, o RSVP, o hábito e a persistência.
 * Usa "colar texto" em vez de import para isolar o feed dos parsers.
 */

const texto = Array.from(
  { length: 12 },
  (_, i) =>
    `Este é o parágrafo número ${i + 1} do texto de teste. Ele tem algumas frases para o ` +
    `motor de fragmentos ter onde cortar. A segunda é um pouco mais longa, com vírgulas, ` +
    `travessões — e outras pontuações, para exercitar as pausas do RSVP. E a terceira fecha.`
).join("\n\n");

export default async function () {
  const { browser, page, erros } = await abrir({ width: 390, height: 844 });

  await page.waitForSelector("text=Nenhum livro carregado", { timeout: 5000 });
  ok("abre no estado vazio com as abas acessíveis");

  await page.click("text=Abrir a biblioteca");
  await page.click("text=Colar texto");
  await page.fill('input[placeholder^="Ex.:"]', "Livro de teste");
  await page.fill("textarea", texto);
  await page.click("text=Criar e ler");
  await page.waitForSelector(".feed", { timeout: 5000 });

  const primeiro = (await cartaoAtual(page)).trim();
  checar(primeiro.startsWith("Este é o parágrafo número 1"), "fragmento inicial errado");
  ok("texto colado vira livro e abre no feed");

  await revelar(page);
  await page.click('button[aria-label="Próximo fragmento"]');
  await page.waitForTimeout(450);
  const segundo = (await cartaoAtual(page)).trim();
  checar(segundo !== primeiro, "o botão não avançou");
  ok("botão do rodapé avança");

  await page.mouse.click(360, 400);
  await page.waitForTimeout(450);
  checar((await cartaoAtual(page)).trim() !== segundo, "toque à direita não avançou");
  ok("toque na faixa direita avança");

  await page.mouse.click(30, 400);
  await page.waitForTimeout(450);
  checar((await cartaoAtual(page)).trim() === segundo, "toque à esquerda não voltou");
  ok("toque na faixa esquerda volta");

  // Arrasto vertical
  await page.mouse.move(200, 600);
  await page.mouse.down();
  for (let y = 600; y >= 250; y -= 35) {
    await page.mouse.move(200, y);
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(450);
  const aposVertical = (await cartaoAtual(page)).trim();
  checar(aposVertical !== segundo, "arrasto vertical não avançou");
  ok("arrasto para cima avança");

  // Arrasto lateral
  await page.mouse.move(320, 400);
  await page.mouse.down();
  for (let x = 320; x >= 40; x -= 28) {
    await page.mouse.move(x, 400);
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(450);
  const aposLateral = (await cartaoAtual(page)).trim();
  checar(aposLateral !== aposVertical, "arrasto lateral não avançou");
  ok("arrasto para o lado avança");

  await revelar(page);
  await page.click('button[aria-label="Salvar trecho"]');
  await page.waitForTimeout(200);
  ok("salva o trecho");

  await revelar(page);
  await page.click('button[aria-label="Leitura dinâmica"]');
  await page.waitForSelector(".rsvp", { timeout: 3000 });
  const palavra1 = await page.locator(".rsvp__word").innerText();
  await page.waitForTimeout(900);
  const palavra2 = await page.locator(".rsvp__word").innerText();
  checar(palavra1 !== palavra2, "o RSVP não avançou as palavras");
  const shift = await page.locator(".rsvp__word").evaluate((el) => el.style.transform);
  checar(/translateX\(-\d/.test(shift), "o pivô do RSVP não foi ancorado");
  ok(`RSVP roda e ancora o pivô (${shift})`);
  await page.click('button[aria-label="Fechar"]');

  await aba(page, ABA.habito);
  await page.waitForSelector("text=Trechos salvos", { timeout: 3000 });
  const total = await page.locator(".stat").nth(2).locator(".stat__value").innerText();
  // Cinco viradas, mas uma foi para trás e outra reocupou posição já lida: o
  // contador só anda no recorde, então o esperado é exatamente 3.
  checar(Number(total) === 3, `contador de leitura errado: ${total} (esperado 3)`);
  const salvos = await page.locator(".section__title", { hasText: "Trechos salvos" }).innerText();
  checar(salvos.includes("1"), "o trecho salvo não apareceu");
  ok(`hábito conta só o avanço real (${total}) e guarda o trecho`);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".feed", { timeout: 5000 });
  checar((await cartaoAtual(page)).trim() === aposLateral, "não retomou a posição salva");
  ok("retoma no mesmo ponto depois de recarregar");

  await aba(page, ABA.ajustes);
  await page.waitForSelector("text=Tamanho do fragmento", { timeout: 3000 });
  await page.locator('input[type="range"]').first().fill("100");
  await aba(page, ABA.ler);
  await page.waitForTimeout(300);
  const aposResize = (await cartaoAtual(page)).trim();
  // Com fragmentos maiores o cartão começa antes — o certo é que a palavra
  // onde a leitura parou continue na tela, não que o texto comece igual.
  checar(
    aposResize.includes(aposLateral.slice(0, 40)),
    "mudar o tamanho do fragmento perdeu a posição"
  );
  ok("mudar o tamanho do fragmento não perde o lugar");

  await browser.close();
  return erros;
}
