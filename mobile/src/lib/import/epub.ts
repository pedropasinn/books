import { unzipSync, strFromU8 } from "fflate";
import type { ImportedBook } from "./types";
import { titleFromFilename, toChapters } from "./types";

/**
 * Import de EPUB.
 *
 * Um EPUB é um zip: `META-INF/container.xml` aponta para o OPF, o OPF traz os
 * metadados, o manifesto (arquivo → id) e o spine (a ordem de leitura). Cada
 * documento do spine vira um capítulo. Imagens, fontes e CSS são descartados
 * na descompactação — só interessa o texto.
 */

/** Tags que separam blocos de texto: viram parágrafo na extração. */
const BLOCO = new Set([
  "P", "DIV", "SECTION", "ARTICLE", "BLOCKQUOTE", "LI", "TR", "TD", "PRE",
  "H1", "H2", "H3", "H4", "H5", "H6", "FIGCAPTION", "HR",
]);
const IGNORAR = new Set(["SCRIPT", "STYLE", "HEAD", "NOSCRIPT", "SVG"]);

const TEXTO_RE = /\.(x?html?|xml|opf|ncx)$/i;

/** Junta os caminhos como o EPUB espera (relativo à pasta do OPF). */
function resolve(base: string, href: string): string {
  const alvo = decodeURIComponent(href.split("#")[0]);
  if (!base) return alvo;
  const partes = base.split("/").slice(0, -1);
  for (const p of alvo.split("/")) {
    if (p === "." || p === "") continue;
    if (p === "..") partes.pop();
    else partes.push(p);
  }
  return partes.join("/");
}

function parse(xml: string, tipo: DOMParserSupportedType): Document {
  return new DOMParser().parseFromString(xml, tipo);
}

/** Extrai o texto preservando as quebras de parágrafo da marcação. */
function htmlToText(root: Element): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue?.replace(/\s+/g, " ") ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (IGNORAR.has(tag)) return;
    if (tag === "BR") {
      out += "\n";
      return;
    }
    const bloco = BLOCO.has(tag);
    if (bloco && !out.endsWith("\n\n")) out += "\n\n";
    el.childNodes.forEach(walk);
    if (bloco && !out.endsWith("\n\n")) out += "\n\n";
  };
  walk(root);
  return out;
}

/**
 * O documento é um sumário? EPUB3 marca o `nav` no manifesto, mas EPUB2 põe o
 * índice como um capítulo comum — e ele viraria um fragmento de nomes de
 * capítulo no meio da leitura. A marca registrada é a proporção de texto que
 * está dentro de links: num índice é quase tudo, num capítulo com notas de
 * rodapé é pouco.
 */
function ehIndice(corpo: Element): boolean {
  const links = Array.from(corpo.querySelectorAll("a"));
  if (links.length < 5) return false;
  const totalLinks = links.reduce((s, a) => s + (a.textContent?.trim().length ?? 0), 0);
  const total = corpo.textContent?.replace(/\s+/g, " ").trim().length ?? 0;
  return total > 0 && totalLinks / total > 0.6;
}

/** Título do capítulo: primeiro cabeçalho do documento, senão o <title>. */
function tituloDoDoc(doc: Document): string {
  for (const tag of ["h1", "h2", "h3"]) {
    const el = doc.querySelector(tag);
    const t = el?.textContent?.replace(/\s+/g, " ").trim();
    if (t) return t.slice(0, 120);
  }
  return doc.querySelector("title")?.textContent?.trim().slice(0, 120) ?? "";
}

/**
 * Rótulos do sumário, por caminho de arquivo: `nav` (EPUB3) ou `ncx` (EPUB2).
 * Só olha os arquivos com cara de sumário — varrer todo o livro procurando um
 * `<nav>` sairia caro num EPUB de duzentos capítulos.
 */
function lerSumario(arquivos: Record<string, Uint8Array>): Map<string, string> {
  const mapa = new Map<string, string>();
  const candidatos = Object.keys(arquivos).filter((c) =>
    /(^|\/)[^/]*(nav|toc|conte[úu]do|sumario|sum[áa]rio)[^/]*\.(x?html?|ncx)$|\.ncx$/i.test(c)
  );

  for (const caminho of candidatos) {
    const ncx = /\.ncx$/i.test(caminho);
    const doc = parse(strFromU8(arquivos[caminho]), ncx ? "application/xml" : "text/html");

    const links = ncx
      ? Array.from(doc.getElementsByTagName("navPoint")).map((np) => ({
          href: np.getElementsByTagName("content")[0]?.getAttribute("src") ?? "",
          label: np.getElementsByTagName("text")[0]?.textContent ?? "",
        }))
      : Array.from(doc.querySelectorAll("nav a")).map((a) => ({
          href: a.getAttribute("href") ?? "",
          label: a.textContent ?? "",
        }));

    for (const { href, label } of links) {
      const texto = label.replace(/\s+/g, " ").trim();
      if (!href || !texto) continue;
      const destino = resolve(caminho, href);
      if (!mapa.has(destino)) mapa.set(destino, texto.slice(0, 120));
    }
    if (mapa.size) break;
  }
  return mapa;
}

export async function importEpub(file: File): Promise<ImportedBook> {
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    // Só texto: pular imagens e fontes economiza memória e tempo no celular.
    filter: (f) => TEXTO_RE.test(f.name),
  });

  const container = zip["META-INF/container.xml"];
  if (!container) throw new Error("EPUB inválido: falta META-INF/container.xml.");

  const opfPath = parse(strFromU8(container), "application/xml")
    .getElementsByTagName("rootfile")[0]
    ?.getAttribute("full-path");
  if (!opfPath || !zip[opfPath]) throw new Error("EPUB inválido: não achei o arquivo OPF.");

  const opf = parse(strFromU8(zip[opfPath]), "application/xml");

  // `getElementsByTagNameNS("*", …)` casa pelo nome local, independente do
  // prefixo — o OPF pode usar `dc:title` ou `title` conforme o gerador.
  const meta = opf.getElementsByTagName("metadata")[0] ?? opf;
  const titulo =
    meta.getElementsByTagNameNS("*", "title")[0]?.textContent?.trim() ||
    titleFromFilename(file.name);
  const autores =
    Array.from(meta.getElementsByTagNameNS("*", "creator"))
      .map((el) => el.textContent?.trim())
      .filter(Boolean)
      .join(", ") || "—";

  // manifesto: id → { caminho absoluto no zip, é o documento de navegação? }
  const manifesto = new Map<string, { path: string; nav: boolean }>();
  for (const item of Array.from(opf.getElementsByTagName("item"))) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (!id || !href) continue;
    manifesto.set(id, {
      path: resolve(opfPath, href),
      nav: (item.getAttribute("properties") ?? "").includes("nav"),
    });
  }

  const sumario = lerSumario(zip);

  const partes: { title: string; text: string }[] = [];
  for (const ref of Array.from(opf.getElementsByTagName("itemref"))) {
    const item = manifesto.get(ref.getAttribute("idref") ?? "");
    if (!item || item.nav) continue;
    const dados = zip[item.path];
    if (!dados) continue;

    const doc = parse(strFromU8(dados), "text/html");
    const corpo = doc.body;
    if (!corpo || ehIndice(corpo)) continue;
    partes.push({
      title: sumario.get(item.path) || tituloDoDoc(doc),
      text: htmlToText(corpo),
    });
  }

  const chapters = toChapters(partes, titulo);
  if (!chapters.length) throw new Error("Não consegui extrair texto deste EPUB.");
  return { title: titulo, authors: autores, chapters };
}
