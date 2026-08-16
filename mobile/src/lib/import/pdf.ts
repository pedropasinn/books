import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
// `TextItem` não é reexportado pelo bundle legacy; o tipo mora nos types do pacote.
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { ImportedBook, OnProgress } from "./types";
import { titleFromFilename, toChapters } from "./types";

/**
 * Import de PDF (extração de texto via pdf.js).
 *
 * PDF não guarda parágrafos — guarda pedaços de texto com coordenadas. A
 * reconstrução aqui é: pdf.js marca fim de linha (`hasEOL`); as linhas viram
 * parágrafo quando a anterior é visivelmente curta e fecha frase (fim de
 * parágrafo de verdade), senão são emendadas com espaço. Cabeçalhos/rodapés
 * que se repetem em muitas páginas e números de página soltos são descartados.
 *
 * Os capítulos saem do sumário embutido (os "marcadores" do PDF) quando existe;
 * sem ele, o livro é fatiado em blocos de páginas.
 */

/** Páginas por capítulo quando o PDF não tem sumário. */
const PAGINAS_POR_BLOCO = 12;

type Linha = { texto: string; pagina: number };

/** Carrega o pdf.js sob demanda — são centenas de KB que o feed não precisa. */
async function carregarPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

/** Junta os pedaços de uma página em linhas, usando as marcas de fim de linha. */
function linhasDaPagina(itens: { str: string; hasEOL: boolean }[], pagina: number): Linha[] {
  const linhas: Linha[] = [];
  let atual = "";
  for (const item of itens) {
    atual += item.str;
    if (item.hasEOL) {
      linhas.push({ texto: atual.replace(/\s+/g, " ").trim(), pagina });
      atual = "";
    }
  }
  if (atual.trim()) linhas.push({ texto: atual.replace(/\s+/g, " ").trim(), pagina });
  return linhas;
}

/**
 * Descarta cabeçalho/rodapé: a primeira e a última linha de cada página que
 * se repetem em pelo menos um terço das páginas (e não são texto corrido).
 */
function removerRepetidos(porPagina: Linha[][]): void {
  const contar = (pegar: (l: Linha[]) => Linha | undefined) => {
    const contagem = new Map<string, number>();
    for (const pagina of porPagina) {
      const linha = pegar(pagina);
      const chave = linha?.texto.replace(/\d+/g, "#").trim();
      if (chave && chave.length < 90) contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    return contagem;
  };

  const limite = Math.max(3, Math.floor(porPagina.length / 3));
  const topos = contar((p) => p[0]);
  const pes = contar((p) => p[p.length - 1]);

  for (const pagina of porPagina) {
    const chave = (l?: Linha) => l?.texto.replace(/\d+/g, "#").trim() ?? "";
    if (pagina.length && (topos.get(chave(pagina[0])) ?? 0) >= limite) pagina.shift();
    if (pagina.length && (pes.get(chave(pagina[pagina.length - 1])) ?? 0) >= limite) pagina.pop();
  }
}

/** Linhas → parágrafos. */
function montarParagrafos(linhas: Linha[]): string {
  const uteis = linhas.filter((l) => l.texto && !/^[\divxlcm]{1,6}$/i.test(l.texto));
  if (!uteis.length) return "";

  const comprimentos = uteis.map((l) => l.texto.length).sort((a, b) => a - b);
  const mediana = comprimentos[Math.floor(comprimentos.length / 2)] || 60;

  let out = "";
  uteis.forEach((linha, i) => {
    out += linha.texto;
    if (i === uteis.length - 1) return;
    // Em texto corrido, toda linha vai até a margem — só a ÚLTIMA de cada
    // parágrafo (e os títulos de seção) fica curta. Então linha curta = quebra
    // de parágrafo; linha cheia = a mesma frase seguindo na linha de baixo, e
    // vai emendada com espaço.
    out += linha.texto.length < mediana * 0.75 ? "\n\n" : " ";
  });
  return out;
}

/** Página inicial de cada item do sumário embutido (marcadores do PDF). */
async function capitulosDoSumario(
  doc: PDFDocumentProxy
): Promise<{ title: string; pagina: number }[]> {
  try {
    const outline = await doc.getOutline();
    if (!outline?.length) return [];

    const saida: { title: string; pagina: number }[] = [];
    for (const item of outline) {
      const dest =
        typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
      const ref = dest?.[0];
      if (!ref || typeof ref !== "object") continue;
      const indice = await doc.getPageIndex(ref as Parameters<typeof doc.getPageIndex>[0]);
      const titulo = item.title?.replace(/\s+/g, " ").trim();
      if (titulo) saida.push({ title: titulo.slice(0, 120), pagina: indice });
    }
    // Só serve se estiver em ordem e cobrir o livro de forma razoável.
    return saida.every((c, i) => i === 0 || c.pagina >= saida[i - 1].pagina) ? saida : [];
  } catch {
    return [];
  }
}

export async function importPdf(file: File, onProgress: OnProgress): Promise<ImportedBook> {
  onProgress("Abrindo o PDF…");
  const pdfjs = await carregarPdfjs();
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await tarefa.promise;

  const porPagina: Linha[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    onProgress(`Lendo página ${n} de ${doc.numPages}…`);
    const page = await doc.getPage(n);
    const conteudo = await page.getTextContent();
    // `items` mistura texto e marcações de conteúdo; só o texto tem `str`.
    const itens = conteudo.items
      .filter((i): i is TextItem => "str" in i)
      .map((i) => ({ str: i.str, hasEOL: i.hasEOL }));
    porPagina.push(linhasDaPagina(itens, n - 1));
    page.cleanup();
  }

  removerRepetidos(porPagina);
  onProgress("Montando os capítulos…");

  let titulo = titleFromFilename(file.name);
  let autores = "—";
  try {
    const meta = await doc.getMetadata();
    const info = meta.info as { Title?: string; Author?: string } | undefined;
    if (info?.Title?.trim()) titulo = info.Title.trim();
    if (info?.Author?.trim()) autores = info.Author.trim();
  } catch {
    /* PDF sem metadados — fica o nome do arquivo */
  }

  const sumario = await capitulosDoSumario(doc);
  const partes: { title: string; text: string }[] = [];

  if (sumario.length >= 2) {
    sumario.forEach((cap, i) => {
      const fim = sumario[i + 1]?.pagina ?? porPagina.length;
      partes.push({
        title: cap.title,
        text: montarParagrafos(porPagina.slice(cap.pagina, fim).flat()),
      });
    });
    // Texto antes do primeiro marcador (rosto, prefácio) não some.
    if (sumario[0].pagina > 0) {
      partes.unshift({
        title: "Início",
        text: montarParagrafos(porPagina.slice(0, sumario[0].pagina).flat()),
      });
    }
  } else {
    for (let i = 0; i < porPagina.length; i += PAGINAS_POR_BLOCO) {
      const fim = Math.min(i + PAGINAS_POR_BLOCO, porPagina.length);
      partes.push({
        title: `Páginas ${i + 1}–${fim}`,
        text: montarParagrafos(porPagina.slice(i, fim).flat()),
      });
    }
  }

  // Libera o worker do pdf.js (o `destroy` mora na tarefa de carregamento).
  await tarefa.destroy();

  const chapters = toChapters(partes, titulo);
  if (!chapters.length) {
    throw new Error("Este PDF não tem texto extraível (provavelmente é digitalizado).");
  }
  return { title: titulo, authors: autores, chapters };
}
