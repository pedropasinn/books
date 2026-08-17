import { ABA, aba, abrir, cartaoAtual, checar, escrever, ok, revelar } from "./helpers.mjs";
import { epubMinimo } from "./fixtures.mjs";

/** Índice: capítulos, marcadores e salto pelos números dos cartões. */

export default async function () {
  const { browser, page, erros } = await abrir({ width: 390, height: 844 });

  await page.click("text=Abrir a biblioteca");
  await page.locator('input[type="file"]').setInputFiles(escrever("livro.epub", epubMinimo()));
  await page.waitForSelector(".feed", { timeout: 30_000 });

  // Marca o cartão atual, para o índice ter o que apontar.
  await revelar(page);
  await page.click('button[aria-label="Salvar trecho"]');
  await page.waitForTimeout(250);
  const marcado = (await cartaoAtual(page)).trim();

  // Anda alguns cartões, para sair de onde o marcador ficou.
  for (let i = 0; i < 2; i++) {
    await page.mouse.click(360, 400);
    await page.waitForTimeout(300);
  }
  const antesDoSalto = (await cartaoAtual(page)).trim();
  checar(antesDoSalto !== marcado, "não saiu do cartão marcado");

  await revelar(page);
  await page.click('button[aria-label="Índice do livro"]');
  await page.waitForSelector(".sheet", { timeout: 5000 });

  const capitulos = await page.locator(".cap").count();
  checar(capitulos === 3, `esperava 3 capítulos no índice, achei ${capitulos}`);
  ok(`índice lista os ${capitulos} capítulos do livro`);

  const comMarcador = await page.locator(".cap__flag").count();
  checar(comMarcador === 1, `esperava 1 capítulo sinalizado, achei ${comMarcador}`);
  ok("capítulo com trecho salvo aparece sinalizado");

  // O capítulo da leitura já abre expandido, com a grade de números.
  const numeros = await page.locator(".paginas .pagina").count();
  checar(numeros > 1, `grade de números não apareceu (${numeros})`);
  const atual = await page.locator('.pagina[data-atual="true"]').count();
  checar(atual === 1, `esperava 1 número destacado como atual, achei ${atual}`);
  ok(`grade com ${numeros} números, com o cartão atual destacado`);

  const numeroMarcado = page.locator('.pagina[data-marcado="true"]');
  checar((await numeroMarcado.count()) === 1, "o número com marcador não foi destacado");
  const rotulo = (await numeroMarcado.first().innerText()).trim();
  ok(`número ${rotulo} marcado na grade`);

  // Filtro: só capítulos com marcadores.
  await page.click('button[aria-label="Mostrar só capítulos com marcadores"]');
  await page.waitForTimeout(300);
  checar(
    (await page.locator(".cap").count()) === 1,
    "o filtro de marcadores não reduziu a lista"
  );
  ok("filtro mostra só os capítulos com marcadores");
  await page.click('button[aria-label="Mostrar só capítulos com marcadores"]');
  await page.waitForTimeout(300);

  // Tocar no número volta para aquele cartão e fecha o índice.
  await numeroMarcado.first().click();
  await page.waitForTimeout(500);
  checar((await page.locator(".sheet").count()) === 0, "o índice não fechou depois do salto");
  checar(
    (await cartaoAtual(page)).trim() === marcado,
    "o salto pelo número não caiu no cartão certo"
  );
  ok("tocar no número pula para o cartão");

  // Salto entre capítulos: abre outro capítulo e vai no primeiro número.
  await revelar(page);
  await page.click('button[aria-label="Índice do livro"]');
  await page.waitForSelector(".sheet", { timeout: 5000 });
  await page.locator(".cap").nth(2).locator(".cap__head").click();
  await page.waitForTimeout(300);
  await page.locator(".cap").nth(2).locator(".pagina").first().click();
  await page.waitForTimeout(500);
  const noTerceiro = await page.locator(".feed__chapter").innerText();
  checar(/O Fim/.test(noTerceiro), `não pulou para o terceiro capítulo (${noTerceiro})`);
  ok("índice pula entre capítulos");

  // "Voltar ao contexto" a partir do trecho salvo, na aba Hábito.
  await aba(page, ABA.habito);
  await page.waitForSelector("text=Trechos salvos", { timeout: 5000 });
  await page.locator(".tile__quote").first().click();
  await page.waitForTimeout(600);
  await page.waitForSelector(".feed", { timeout: 5000 });
  checar(
    (await cartaoAtual(page)).trim() === marcado,
    "o trecho salvo não levou de volta ao contexto"
  );
  ok("trecho salvo volta ao ponto exato do livro");

  await browser.close();
  return erros;
}
