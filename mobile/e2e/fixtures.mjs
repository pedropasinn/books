import { zipSync, strToU8 } from "fflate";

/**
 * Fixtures geradas em código, não arquivos binários no repositório.
 *
 * A suíte precisa de um EPUB e um PDF de verdade para exercitar os parsers,
 * mas commitar um livro do Gutenberg e um PDF de 2 MB engorda o repositório e
 * amarra o teste a um download. Gerar aqui deixa a suíte determinística e
 * offline — e obriga o gerador a produzir arquivos válidos de fato.
 */

const PARAGRAFO =
  "Este parágrafo existe para dar corpo ao capítulo e passar do mínimo de palavras " +
  "exigido pelo importador, com frases de tamanho normal e pontuação de verdade. " +
  "A segunda frase é um pouco mais longa, com vírgulas, e fecha o bloco.";

/** Poema: versos sem ponto final — o caso que estourava a tela. */
export const POEMA = `Pushkin, O Profeta

Num ermo, eu de ansia sedento,
Já me arrastava e, frente a mim,
Surgiu com seis asas ao vento,
Na encruzilhada, um serafim;
Ele me abriu, com dedos vagos
Qual sono, os olhos que, pressagos,
Tudo abarcaram com presteza
Que nem olhar de águia surpresa;
Ele tocou-me cada ouvido
E ambos se encheram de alarido:
Ouvi mover-se o firmamento,
Anjos cruzando o céu, rasteiras
Criaturas sob o mar e o lento
Crescer, no vale, das videiras.

E a mim colou-se sobre a boca
E arrancou-me a língua louca,
Fútil e cheia de malícia,
E a fala astuta da serpente
Na minha boca entorpecida
Pôs com sua mão ensanguentada.

${PARAGRAFO} ${PARAGRAFO}`;

/** TXT com três cabeçalhos, para a heurística de capítulos. */
export const TXT_CAPITULOS = [1, 2, 3]
  .map((n) => `Capítulo ${n}\n\n${PARAGRAFO}`)
  .join("\n\n");

const xhtml = (titulo, corpo) =>
  `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${titulo}</title></head>
<body><h1>${titulo}</h1>${corpo}</body></html>`;

/**
 * EPUB 3 mínimo, porém legítimo: container → OPF (metadados, manifesto,
 * spine) → documentos XHTML, mais um `nav` que também serve de índice — é o
 * documento que o importador tem que PULAR, e por isso está aqui.
 */
export function epubMinimo() {
  const capitulos = [
    { id: "c1", arquivo: "cap1.xhtml", titulo: "O Começo" },
    { id: "c2", arquivo: "cap2.xhtml", titulo: "O Meio" },
    { id: "c3", arquivo: "cap3.xhtml", titulo: "O Fim" },
  ];

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">urn:uuid:teste</dc:identifier>
    <dc:title>Um Livro de Teste</dc:title>
    <dc:creator>Autora Fictícia</dc:creator>
    <dc:language>pt-BR</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${capitulos
      .map(
        (c) =>
          `<item id="${c.id}" href="${c.arquivo}" media-type="application/xhtml+xml"/>`
      )
      .join("\n    ")}
    <item id="capa" href="capa.jpg" media-type="image/jpeg"/>
  </manifest>
  <spine>
    ${capitulos.map((c) => `<itemref idref="${c.id}"/>`).join("\n    ")}
  </spine>
</package>`;

  const nav = xhtml(
    "Sumário",
    `<nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol>${capitulos
      .map((c) => `<li><a href="${c.arquivo}">${c.titulo}</a></li>`)
      .join("")}</ol></nav>`
  );

  const arquivos = {
    // O `mimetype` tem que entrar sem compressão (level 0) e em primeiro
    // lugar: é o que manda a especificação do EPUB. O importador daqui não
    // depende disso, mas uma fixture que não é um EPUB legítimo testaria pouco.
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(
      `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/livro.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
    ),
    "OEBPS/livro.opf": strToU8(opf),
    "OEBPS/nav.xhtml": strToU8(nav),
    // Uma imagem falsa: o importador tem que descartá-la na descompactação.
    "OEBPS/capa.jpg": new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  };
  for (const c of capitulos) {
    // Vários parágrafos por capítulo: sem isso cada capítulo caberia num
    // cartão só, e a grade de números do índice não teria o que mostrar.
    arquivos[`OEBPS/${c.arquivo}`] = strToU8(
      xhtml(c.titulo, Array.from({ length: 8 }, () => `<p>${PARAGRAFO}</p>`).join(""))
    );
  }

  return zipSync(arquivos);
}

/**
 * PDF mínimo com texto extraível. Escrito à mão porque é pequeno: catálogo,
 * páginas, uma fonte base-14 e um fluxo de conteúdo por página. As linhas
 * saem largas de propósito, para o remontador de parágrafos ter o que fazer.
 */
export function pdfMinimo(paginas = 3) {
  const linhas = [
    "Este e o texto de uma pagina do PDF de teste, escrito em linhas",
    "largas o bastante para que o remontador de paragrafos as emende",
    "como uma frase unica em vez de tratar cada linha como paragrafo.",
    "Curta.",
    "E aqui comeca outro bloco de texto, tambem com linhas cheias que",
    "seguem ate a margem direita da pagina, como em qualquer livro.",
  ];

  const objetos = [];
  const idsPaginas = [];
  // 1 = catálogo, 2 = árvore de páginas, 3 = fonte; daí em diante, os pares
  // (página, conteúdo) de cada folha.
  let proximo = 4;
  const conteudos = [];

  for (let i = 0; i < paginas; i++) {
    const idPagina = proximo++;
    const idConteudo = proximo++;
    idsPaginas.push(idPagina);
    const texto =
      `BT /F1 11 Tf 72 720 Td 16 TL\n` +
      [`Pagina ${i + 1}`, ...linhas].map((l) => `(${l}) Tj T*`).join("\n") +
      `\nET`;
    objetos[idPagina] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${idConteudo} 0 R >>`;
    conteudos[idConteudo] = texto;
  }

  objetos[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objetos[2] = `<< /Type /Pages /Kids [${idsPaginas
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${paginas} >>`;
  objetos[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  // Monta o arquivo acompanhando os deslocamentos: a tabela xref precisa da
  // posição exata em bytes de cada objeto, senão o PDF não abre.
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  const total = proximo - 1;

  for (let id = 1; id <= total; id++) {
    offsets[id] = pdf.length;
    if (conteudos[id] !== undefined) {
      const fluxo = conteudos[id];
      pdf += `${id} 0 obj\n<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream\nendobj\n`;
    } else {
      pdf += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
    }
  }

  const inicioXref = pdf.length;
  pdf += `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= total; id++) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}
