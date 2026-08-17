import { describe, expect, it } from "vitest";
import { absoluteWord, fractionRead, fragmentKey, isBeyond } from "./position";
import type { ChapterMeta } from "./types";

const capitulos: ChapterMeta[] = [
  { number: 1, title: "Um", wordCount: 100 },
  { number: 2, title: "Dois", wordCount: 200 },
  { number: 3, title: "Três", wordCount: 300 },
];

describe("absoluteWord", () => {
  it("soma os capítulos anteriores", () => {
    expect(absoluteWord(capitulos, { chapterNumber: 3, wordIndex: 50 })).toBe(350);
  });

  it("no primeiro capítulo é a própria palavra", () => {
    expect(absoluteWord(capitulos, { chapterNumber: 1, wordIndex: 42 })).toBe(42);
  });

  it("ignora índice negativo", () => {
    expect(absoluteWord(capitulos, { chapterNumber: 2, wordIndex: -5 })).toBe(100);
  });
});

describe("isBeyond", () => {
  it("capítulo maior está adiante", () => {
    expect(isBeyond({ chapterNumber: 3, wordIndex: 0 }, { chapterNumber: 2, wordIndex: 999 })).toBe(
      true
    );
  });

  it("no mesmo capítulo compara a palavra", () => {
    expect(isBeyond({ chapterNumber: 2, wordIndex: 10 }, { chapterNumber: 2, wordIndex: 9 })).toBe(
      true
    );
    expect(isBeyond({ chapterNumber: 2, wordIndex: 9 }, { chapterNumber: 2, wordIndex: 10 })).toBe(
      false
    );
  });

  it("a mesma posição não é avanço (reler não conta)", () => {
    const p = { chapterNumber: 2, wordIndex: 10 };
    expect(isBeyond(p, p)).toBe(false);
  });

  it("qualquer posição está adiante de 'nunca leu'", () => {
    expect(isBeyond({ chapterNumber: 1, wordIndex: 0 }, null)).toBe(true);
  });
});

describe("fractionRead", () => {
  it("mede pelo total de palavras do livro", () => {
    // 350 de 600 palavras
    expect(fractionRead(capitulos, { chapterNumber: 3, wordIndex: 50 })).toBeCloseTo(350 / 600);
  });

  it("é zero sem progresso", () => {
    expect(fractionRead(capitulos, null)).toBe(0);
  });

  it("nunca passa de 1", () => {
    expect(fractionRead(capitulos, { chapterNumber: 3, wordIndex: 99999 })).toBe(1);
  });

  it("não quebra com livro vazio", () => {
    expect(fractionRead([], { chapterNumber: 1, wordIndex: 0 })).toBe(0);
  });

  it("não muda quando o tamanho do fragmento muda", () => {
    // O ponto de trocar contagem de cartões por palavras: a fração é uma
    // propriedade do texto, não da renderização.
    const pos = { chapterNumber: 2, wordIndex: 100 };
    expect(fractionRead(capitulos, pos)).toBe(fractionRead(capitulos, pos));
    expect(fractionRead(capitulos, pos)).toBeCloseTo(200 / 600);
  });
});

describe("fragmentKey", () => {
  it("distingue livro, capítulo e palavra", () => {
    expect(fragmentKey("a", { chapterNumber: 1, wordIndex: 2 })).toBe("a:1:2");
    expect(fragmentKey("a", { chapterNumber: 1, wordIndex: 2 })).not.toBe(
      fragmentKey("b", { chapterNumber: 1, wordIndex: 2 })
    );
  });
});
