import { describe, expect, it } from "vitest";
import { splitChapter } from "./fragments";
import type { Fragment } from "./fragments";
import { indiceGlobalDe, montarIndice } from "./outline";
import type { Chapter, SavedFragment } from "./types";

const frase = (n: number) => `Esta e a frase numero ${n} do capitulo com algumas palavras.`;

const capitulo = (numero: number, frases = 12): Chapter => {
  const text = Array.from({ length: frases }, (_, i) => frase(i + 1)).join(" ");
  return {
    number: numero,
    title: `Capítulo ${numero}`,
    text,
    wordCount: text.split(/\s+/).length,
  };
};

/** Livro de três capítulos, já cortado como o feed corta. */
function livro(): Fragment[] {
  return [1, 2, 3].flatMap((n) => splitChapter("livro", capitulo(n), 20));
}

const marcador = (chapterNumber: number, startWord: number): SavedFragment => ({
  id: `livro:${chapterNumber}:${startWord}`,
  bookSlug: "livro",
  bookTitle: "Livro",
  chapterNumber,
  chapterTitle: `Capítulo ${chapterNumber}`,
  startWord,
  text: "trecho",
  savedAt: 0,
});

describe("montarIndice", () => {
  const frags = livro();

  it("agrupa por capítulo, em ordem", () => {
    const idx = montarIndice(frags, [], null, null);
    expect(idx.map((c) => c.numero)).toEqual([1, 2, 3]);
    expect(idx.map((c) => c.titulo)).toEqual(["Capítulo 1", "Capítulo 2", "Capítulo 3"]);
  });

  it("numera os cartões de 1 dentro de cada capítulo", () => {
    for (const cap of montarIndice(frags, [], null, null)) {
      expect(cap.cartoes.map((c) => c.numero)).toEqual(cap.cartoes.map((_, i) => i + 1));
    }
  });

  it("guarda o índice global, que é para onde o feed pula", () => {
    const idx = montarIndice(frags, [], null, null);
    const todos = idx.flatMap((c) => c.cartoes.map((x) => x.indiceGlobal));
    expect(todos).toEqual(frags.map((_, i) => i));
  });

  it("conta e marca os cartões com trecho salvo", () => {
    const alvo = frags.find((f) => f.chapterNumber === 2)!;
    const idx = montarIndice(frags, [marcador(2, alvo.startWord)], null, null);

    const cap2 = idx.find((c) => c.numero === 2)!;
    expect(cap2.marcadores).toBe(1);
    expect(cap2.cartoes.filter((c) => c.temMarcador)).toHaveLength(1);
    expect(cap2.cartoes.find((c) => c.temMarcador)?.startWord).toBe(alvo.startWord);

    // Marcador do capítulo 2 não pode aparecer nos outros.
    expect(idx.find((c) => c.numero === 1)?.marcadores).toBe(0);
    expect(idx.find((c) => c.numero === 3)?.marcadores).toBe(0);
  });

  it("marca como lido o que ficou atrás do ponto mais distante", () => {
    const cap2 = frags.filter((f) => f.chapterNumber === 2);
    const furthest = { chapterNumber: 2, wordIndex: cap2[1].startWord };
    const idx = montarIndice(frags, [], null, furthest);

    // Capítulo 1 inteiro ficou para trás.
    expect(idx[0].cartoes.every((c) => c.lido)).toBe(true);
    expect(idx[0].progresso).toBe(1);
    // Capítulo 3 ainda não foi tocado.
    expect(idx[2].cartoes.some((c) => c.lido)).toBe(false);
    expect(idx[2].progresso).toBe(0);
    // No capítulo 2, só o primeiro cartão terminou.
    expect(idx[1].cartoes[0].lido).toBe(true);
    expect(idx[1].cartoes[1].lido).toBe(false);
  });

  it("classifica os capítulos em lido, atual e novo", () => {
    const atual = { chapterNumber: 2, wordIndex: 0 };
    const furthest = { chapterNumber: 2, wordIndex: 5 };
    const idx = montarIndice(frags, [], atual, furthest);
    expect(idx.map((c) => c.estado)).toEqual(["lido", "atual", "novo"]);
  });

  it("relendo um capítulo antigo, o já lido continua lido", () => {
    // Volta ao capítulo 1 tendo chegado ao 3: o 1 vira "atual" sem que o
    // progresso do 3 desapareça.
    const idx = montarIndice(
      frags,
      [],
      { chapterNumber: 1, wordIndex: 0 },
      { chapterNumber: 3, wordIndex: 9999 }
    );
    expect(idx[0].estado).toBe("atual");
    expect(idx[2].progresso).toBe(1);
  });

  it("devolve vazio sem fragmentos", () => {
    expect(montarIndice([], [], null, null)).toEqual([]);
  });
});

describe("indiceGlobalDe", () => {
  const frags = livro();
  const idx = montarIndice(frags, [], null, null);

  it("acha o cartão que contém a palavra", () => {
    const alvo = frags.findIndex((f) => f.chapterNumber === 3);
    const f = frags[alvo];
    const meio = Math.floor((f.startWord + f.endWord) / 2);
    expect(indiceGlobalDe(idx, 3, meio)).toBe(alvo);
  });

  it("cai no primeiro cartão do capítulo quando a palavra é anterior", () => {
    const primeiro = frags.findIndex((f) => f.chapterNumber === 2);
    expect(indiceGlobalDe(idx, 2, 0)).toBe(primeiro);
  });

  it("devolve -1 para capítulo inexistente", () => {
    expect(indiceGlobalDe(idx, 99, 0)).toBe(-1);
  });
});
