import { describe, expect, it } from "vitest";
import { registrarLeitura } from "./position";
import type { BookProgress } from "./types";

const AGORA = 1_700_000_000_000;

const progresso = (
  chapterNumber: number,
  wordIndex: number,
  furthestChapter = chapterNumber,
  furthestWord = wordIndex
): BookProgress => ({
  chapterNumber,
  wordIndex,
  updatedAt: AGORA - 1000,
  furthestChapter,
  furthestWord,
});

const sequencial = (atual: BookProgress | undefined, cap: number, palavra: number) =>
  registrarLeitura(atual, { chapterNumber: cap, wordIndex: palavra }, {
    sequencial: true,
    agora: AGORA,
  });

describe("registrarLeitura · leitura sequencial", () => {
  it("primeira leitura grava posição e ponto mais distante", () => {
    const r = sequencial(undefined, 1, 0);
    expect(r.progresso).toMatchObject({
      chapterNumber: 1,
      wordIndex: 0,
      furthestChapter: 1,
      furthestWord: 0,
    });
    expect(r.contarHabito).toBe(true);
  });

  it("avançar move os dois pontos e conta hábito", () => {
    const r = sequencial(progresso(1, 100), 1, 160);
    expect(r.progresso).toMatchObject({ wordIndex: 160, furthestWord: 160 });
    expect(r.contarHabito).toBe(true);
  });

  it("voltar move só a retomada, preservando o recorde", () => {
    const r = sequencial(progresso(2, 300), 1, 50);
    expect(r.progresso).toMatchObject({
      chapterNumber: 1,
      wordIndex: 50,
      furthestChapter: 2,
      furthestWord: 300,
    });
    expect(r.contarHabito).toBe(false);
  });

  it("reler o mesmo trecho não conta de novo", () => {
    expect(sequencial(progresso(1, 100), 1, 100).contarHabito).toBe(false);
  });

  it("reler para trás e voltar ao recorde não recontra", () => {
    // A sequência que farmaria o contador se o critério fosse "mudou de cartão".
    const inicial = progresso(1, 100);
    const voltou = sequencial(inicial, 1, 50).progresso!;
    expect(voltou.furthestWord).toBe(100);
    const devolta = sequencial(voltou, 1, 100);
    expect(devolta.contarHabito).toBe(false);
    const alem = sequencial(devolta.progresso!, 1, 140);
    expect(alem.contarHabito).toBe(true);
  });

  it("capítulo seguinte conta mesmo com palavra menor", () => {
    const r = sequencial(progresso(1, 900), 2, 0);
    expect(r.contarHabito).toBe(true);
    expect(r.progresso).toMatchObject({ furthestChapter: 2, furthestWord: 0 });
  });

  it("carimba o horário informado", () => {
    expect(sequencial(progresso(1, 0), 1, 10).progresso?.updatedAt).toBe(AGORA);
  });
});

describe("registrarLeitura · modo explorar", () => {
  const explorar = (jaExplorado: boolean) =>
    registrarLeitura(progresso(5, 4000), { chapterNumber: 17, wordIndex: 900 }, {
      sequencial: false,
      jaExplorado,
      agora: AGORA,
    });

  it("NUNCA altera o progresso do livro", () => {
    // O bug que isto tranca: um trecho sorteado do capítulo 17 sobrescrevia a
    // posição de leitura, e o app reabria lá em vez de onde a pessoa parou.
    expect(explorar(false).progresso).toBeNull();
    expect(explorar(true).progresso).toBeNull();
  });

  it("conta hábito na primeira vez que vê o fragmento", () => {
    expect(explorar(false).contarHabito).toBe(true);
  });

  it("não conta de novo o fragmento já visto", () => {
    expect(explorar(true).contarHabito).toBe(false);
  });

  it("não cria progresso para um livro que nunca foi aberto", () => {
    const r = registrarLeitura(undefined, { chapterNumber: 3, wordIndex: 10 }, {
      sequencial: false,
      agora: AGORA,
    });
    expect(r.progresso).toBeNull();
  });
});
