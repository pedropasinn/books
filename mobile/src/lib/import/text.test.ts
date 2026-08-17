import { describe, expect, it } from "vitest";
import { importText } from "./text";
import { countWords, tidy, titleFromFilename, toChapters } from "./types";

const arquivo = (conteudo: string | Uint8Array, nome = "livro.txt") =>
  new File([conteudo as BlobPart], nome, { type: "text/plain" });

/** Parágrafo com palavras suficientes para passar do mínimo de 10. */
const paragrafo = (n: number) =>
  `Este é o corpo do capítulo ${n}, com frases longas o bastante para valer como capítulo de verdade.`;

describe("titleFromFilename", () => {
  it("tira a extensão e troca separadores por espaço", () => {
    expect(titleFromFilename("guerra_e_paz.epub")).toBe("guerra e paz");
  });

  it("tem um fallback para nome vazio", () => {
    expect(titleFromFilename(".txt")).toBe("Sem título");
  });
});

describe("tidy", () => {
  it("junta palavra partida no fim da linha", () => {
    expect(tidy("aconte-\ncimento")).toBe("acontecimento");
  });

  it("não junta quando a linha seguinte começa em maiúscula", () => {
    // "Bem-\nVindo" é hífen de composição, não quebra de sílaba.
    expect(tidy("Bem-\nVindo")).toContain("-");
  });

  it("reduz três ou mais quebras a uma linha em branco", () => {
    expect(tidy("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("normaliza CRLF", () => {
    expect(tidy("a\r\nb")).toBe("a\nb");
  });
});

describe("toChapters", () => {
  it("descarta capítulos curtos demais e renumera", () => {
    const caps = toChapters(
      [
        { title: "Bom", text: paragrafo(1) },
        { title: "Curto", text: "duas palavras" },
        { title: "Outro", text: paragrafo(2) },
      ],
      "fallback"
    );
    expect(caps.map((c) => c.title)).toEqual(["Bom", "Outro"]);
    expect(caps.map((c) => c.number)).toEqual([1, 2]);
  });

  it("conta as palavras de cada capítulo", () => {
    const [c] = toChapters([{ title: "T", text: paragrafo(1) }], "f");
    expect(c.wordCount).toBe(countWords(c.text));
  });

  it("usa o fallback quando o título vem vazio", () => {
    expect(toChapters([{ title: "  ", text: paragrafo(1) }], "Meu livro")[0].title).toBe(
      "Meu livro"
    );
  });
});

describe("importText", () => {
  it("divide por cabeçalhos quando há pelo menos três", async () => {
    const texto = [1, 2, 3]
      .map((n) => `Capítulo ${n}\n\n${paragrafo(n)}`)
      .join("\n\n");
    const livro = await importText(arquivo(texto));
    expect(livro.chapters.map((c) => c.title)).toEqual([
      "Capítulo 1",
      "Capítulo 2",
      "Capítulo 3",
    ]);
  });

  it("não divide com menos de três cabeçalhos (evita falso positivo)", async () => {
    const texto = `Capítulo 1\n\n${paragrafo(1)}\n\nCapítulo 2\n\n${paragrafo(2)}`;
    const livro = await importText(arquivo(texto));
    expect(livro.chapters).toHaveLength(1);
  });

  it("aceita cabeçalho markdown", async () => {
    const texto = [1, 2, 3].map((n) => `# Parte ${n}\n\n${paragrafo(n)}`).join("\n\n");
    const livro = await importText(arquivo(texto, "notas.md"));
    expect(livro.chapters.map((c) => c.title)).toEqual(["Parte 1", "Parte 2", "Parte 3"]);
  });

  it("divide por form feed quando existe", async () => {
    const texto = [paragrafo(1), paragrafo(2)].join("\f");
    const livro = await importText(arquivo(texto));
    expect(livro.chapters).toHaveLength(2);
    expect(livro.chapters[0].title).toBe("Parte 1");
  });

  it("guarda o texto anterior ao primeiro cabeçalho", async () => {
    const texto = `${paragrafo(0)}\n\n` + [1, 2, 3].map((n) => `Capítulo ${n}\n\n${paragrafo(n)}`).join("\n\n");
    const livro = await importText(arquivo(texto));
    expect(livro.chapters[0].title).toBe("Início");
  });

  it("tira o título do nome do arquivo", async () => {
    const livro = await importText(arquivo(paragrafo(1), "O Idiota.txt"));
    expect(livro.title).toBe("O Idiota");
  });

  it("lê arquivo em windows-1252 sem estragar os acentos", async () => {
    // "coração" em cp1252: ç = 0xE7, ã = 0xE3
    const bytes = new Uint8Array([
      ...new TextEncoder().encode("O cora"),
      0xe7,
      0xe3,
      ...new TextEncoder().encode("o tem raz"),
      0xe3,
      ...new TextEncoder().encode("o que a pr"),
      0xf3,
      ...new TextEncoder().encode("pria raz"),
      0xe3,
      ...new TextEncoder().encode("o desconhece completamente."),
    ]);
    const livro = await importText(arquivo(bytes));
    expect(livro.chapters[0].text).toContain("coração");
    expect(livro.chapters[0].text).not.toContain("�");
  });
});
