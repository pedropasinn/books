import { ABA, aba, abrir, checar, escrever, ok } from "./helpers.mjs";
import { TXT_CAPITULOS, epubMinimo, pdfMinimo } from "./fixtures.mjs";

/** Import de arquivo: TXT, EPUB e PDF, do seletor até o feed. */

/** Lê os livros direto do IndexedDB — é o resultado real, sem intermediários. */
const livrosGuardados = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("fragmentos", 1);
        req.onsuccess = () => {
          const todos = req.result.transaction("books", "readonly").objectStore("books").getAll();
          todos.onsuccess = () =>
            resolve(
              todos.result.map((b) => ({
                title: b.title,
                authors: b.authors,
                capitulos: b.chapters.length,
                titulos: b.chapters.map((c) => c.title),
                palavras: b.chapters.reduce((s, c) => s + c.wordCount, 0),
                amostra: b.chapters[0].text.slice(0, 120),
              }))
            );
        };
        req.onerror = () => resolve([]);
      })
  );

export default async function () {
  const { browser, page, erros } = await abrir({ width: 390, height: 844 });
  await page.click("text=Abrir a biblioteca");

  async function importar(caminho, rotulo) {
    await page.locator('input[type="file"]').setInputFiles(caminho);
    await page.waitForSelector(".feed", { timeout: 120_000 });
    const trecho = (await page.locator(".card").nth(1).innerText()).trim();
    checar(trecho.length > 40, `${rotulo}: fragmento curto demais`);
    checar(!/[<>]|&[a-z]+;/.test(trecho), `${rotulo}: sobrou marcação no texto`);
    await aba(page, ABA.livros);
    return trecho;
  }

  await importar(escrever("capitulos.txt", TXT_CAPITULOS), "TXT");
  await importar(escrever("livro.epub", epubMinimo()), "EPUB");
  await importar(escrever("artigo.pdf", pdfMinimo(3)), "PDF");

  const [txt, epub, pdf] = await livrosGuardados(page);

  checar(txt.capitulos === 3, `TXT: esperava 3 capítulos, veio ${txt.capitulos}`);
  checar(txt.titulos[0] === "Capítulo 1", `TXT: título errado (${txt.titulos[0]})`);
  ok(`TXT: ${txt.capitulos} capítulos pelos cabeçalhos`);

  checar(epub.title === "Um Livro de Teste", `EPUB: título ${epub.title}`);
  checar(epub.authors === "Autora Fictícia", `EPUB: autor ${epub.authors}`);
  checar(epub.capitulos === 3, `EPUB: esperava 3 capítulos, veio ${epub.capitulos}`);
  // O `nav` é o sumário: tem que ficar de fora, senão vira um cartão de links.
  checar(
    !epub.titulos.some((t) => /sum[áa]rio/i.test(t)),
    `EPUB: o índice entrou como capítulo (${epub.titulos.join(", ")})`
  );
  checar(
    epub.titulos.join(",") === "O Começo,O Meio,O Fim",
    `EPUB: títulos do sumário não usados (${epub.titulos.join(", ")})`
  );
  ok(`EPUB: metadados, ${epub.capitulos} capítulos do spine, índice descartado`);

  checar(pdf.capitulos >= 1, "PDF: nenhum capítulo");
  checar(pdf.palavras > 50, `PDF: pouco texto extraído (${pdf.palavras} palavras)`);
  // O remontador tem que emendar as linhas cheias numa frase só.
  checar(
    /linhas largas o bastante/.test(pdf.amostra.replace(/\s+/g, " ")),
    `PDF: linhas não foram emendadas (${JSON.stringify(pdf.amostra)})`
  );
  ok(`PDF: ${pdf.palavras} palavras com parágrafos remontados`);

  await page.reload({ waitUntil: "networkidle" });
  await aba(page, ABA.livros);
  await page.waitForSelector(".tile", { timeout: 5000 });
  const total = await page.locator(".tile").count();
  checar(total === 3, `esperava 3 livros após recarregar, achei ${total}`);
  ok("os três livros sobrevivem ao reload");

  await page.locator('input[type="file"]').setInputFiles(escrever("x.bin", new Uint8Array([0, 1, 2])));
  await page.waitForTimeout(1200);
  const aviso = await page.locator(".row__hint").first().innerText();
  checar(/formato|reconhecid/i.test(aviso), `erro de formato não apareceu (${aviso})`);
  ok("arquivo não suportado dá mensagem clara");

  await browser.close();
  return erros;
}
