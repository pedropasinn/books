import { describe, expect, it } from "vitest";
import {
  capacidadeEmPalavras,
  findFragmentIndex,
  splitChapter,
  teaser,
  tokenize,
} from "./fragments";
import type { Chapter } from "./types";

const cap = (text: string, number = 1): Chapter => ({
  number,
  title: `Capítulo ${number}`,
  text,
  wordCount: text.trim().split(/\s+/).filter(Boolean).length,
});

/** Prosa com frases previsíveis de 10 palavras cada. */
function prosa(frases: number): string {
  return Array.from(
    { length: frases },
    (_, i) => `Esta e a frase numero ${i + 1} com algumas palavras.`
  ).join(" ");
}

describe("tokenize", () => {
  it("colapsa espaços e mantém a pontuação colada", () => {
    expect(tokenize("  olá,   mundo!  ")).toEqual(["olá,", "mundo!"]);
  });

  it("devolve vazio para texto em branco", () => {
    expect(tokenize("   \n  ")).toEqual([]);
  });
});

describe("splitChapter", () => {
  it("cobre o capítulo inteiro, sem sobrepor nem perder palavra", () => {
    const c = cap(prosa(40));
    const frags = splitChapter("livro", c, 30);
    expect(frags.length).toBeGreaterThan(1);
    expect(frags[0].startWord).toBe(0);
    expect(frags[frags.length - 1].endWord).toBe(tokenize(c.text).length);
    frags.forEach((f, i) => {
      if (i > 0) expect(f.startWord).toBe(frags[i - 1].endWord);
      expect(f.endWord).toBeGreaterThan(f.startWord);
    });
  });

  it("fecha o fragmento em fim de frase", () => {
    for (const f of splitChapter("livro", cap(prosa(40)), 30).slice(0, -1)) {
      expect(f.text.trim().endsWith(".")).toBe(true);
    }
  });

  it("corta em quebra de linha quando não há ponto final (verso)", () => {
    // Um poema: nenhuma frase termina, então só a quebra de linha salva.
    const verso = Array.from({ length: 40 }, (_, i) => `verso numero ${i + 1} sem ponto`).join(
      "\n"
    );
    const frags = splitChapter("livro", cap(verso), 20);
    expect(frags.length).toBeGreaterThan(1);
    // Sem enxergar a quebra de linha, o corte iria até o limite duro (2x).
    for (const f of frags) expect(f.endWord - f.startWord).toBeLessThanOrEqual(30);
  });

  it("respeita o limite duro mesmo sem nenhuma pontuação", () => {
    const semFim = Array.from({ length: 300 }, (_, i) => `palavra${i}`).join(" ");
    for (const f of splitChapter("livro", cap(semFim), 30)) {
      expect(f.endWord - f.startWord).toBeLessThanOrEqual(60);
    }
  });

  it("preserva os versos no texto do fragmento", () => {
    const frags = splitChapter("livro", cap("verso um\nverso dois\n\nestrofe nova"), 200);
    expect(frags[0].text).toContain("\n");
    expect(frags[0].text).toContain("\n\n");
  });

  it("gruda uma sobra minúscula no fragmento anterior", () => {
    const frags = splitChapter("livro", cap(`${prosa(6)} Fim.`), 30);
    const ultimo = frags[frags.length - 1];
    expect(ultimo.endWord - ultimo.startWord).toBeGreaterThan(3);
  });

  it("numera os fragmentos dentro do capítulo", () => {
    const frags = splitChapter("livro", cap(prosa(40), 7), 30);
    expect(frags.map((f) => f.index)).toEqual(frags.map((_, i) => i));
    expect(new Set(frags.map((f) => f.chapterNumber))).toEqual(new Set([7]));
  });

  it("devolve vazio para capítulo sem texto", () => {
    expect(splitChapter("livro", cap("   "), 30)).toEqual([]);
  });
});

describe("findFragmentIndex", () => {
  const frags = splitChapter("livro", cap(prosa(40)), 30);

  it("acha o fragmento que contém a palavra", () => {
    const alvo = frags[2];
    const meio = Math.floor((alvo.startWord + alvo.endWord) / 2);
    expect(findFragmentIndex(frags, 1, meio)).toBe(2);
  });

  it("acha pela primeira palavra do fragmento", () => {
    expect(findFragmentIndex(frags, 1, frags[1].startWord)).toBe(1);
  });

  it("não sai do capítulo pedido", () => {
    expect(findFragmentIndex(frags, 99, 0)).toBe(-1);
  });

  it("mantém o lugar quando o tamanho do fragmento muda", () => {
    // A garantia central: o índice de cartão muda, a palavra não.
    const c = cap(prosa(60));
    const pequenos = splitChapter("livro", c, 25);
    const grandes = splitChapter("livro", c, 70);
    const palavra = pequenos[5].startWord;
    const i = findFragmentIndex(grandes, 1, palavra);
    expect(grandes[i].startWord).toBeLessThanOrEqual(palavra);
    expect(grandes[i].endWord).toBeGreaterThan(palavra);
  });
});

describe("capacidadeEmPalavras", () => {
  it("cresce com a área disponível", () => {
    const pequena = capacidadeEmPalavras(300, 400, 30, 10);
    const grande = capacidadeEmPalavras(300, 800, 30, 10);
    expect(grande).toBeGreaterThan(pequena);
  });

  it("encolhe quando a letra é mais larga", () => {
    expect(capacidadeEmPalavras(300, 600, 30, 20)).toBeLessThan(
      capacidadeEmPalavras(300, 600, 30, 10)
    );
  });

  it("nunca devolve menos que o mínimo legível", () => {
    expect(capacidadeEmPalavras(10, 10, 30, 40)).toBeGreaterThanOrEqual(12);
  });

  it("devolve infinito quando ainda não há medida", () => {
    expect(capacidadeEmPalavras(0, 0, 0, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("teaser", () => {
  it("mantém frases curtas inteiras", () => {
    expect(teaser("Um trecho curto.")).toBe("Um trecho curto.");
  });

  it("corta no espaço e marca com reticências", () => {
    const t = teaser(prosa(10), 40);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(41);
  });
});
