import { describe, expect, it } from "vitest";
import { delayFactor, pivotIndex, splitPivot } from "./rsvp";

describe("pivotIndex", () => {
  it("fica no começo em palavras de uma letra", () => {
    expect(pivotIndex("a")).toBe(0);
  });

  it("anda para a direita conforme a palavra cresce", () => {
    expect(pivotIndex("casa")).toBe(1);
    expect(pivotIndex("caminhos")).toBe(2);
    expect(pivotIndex("extraordinário")).toBeGreaterThanOrEqual(3);
  });

  it("pula a pontuação inicial", () => {
    // Em «palavra», o foco tem que cair na letra, não na aspa.
    expect(pivotIndex("«casa")).toBe(2);
  });

  it("nunca aponta para fora da palavra", () => {
    for (const w of ["a", "—", "ab", "…", "x.", "«»"]) {
      expect(pivotIndex(w)).toBeGreaterThanOrEqual(0);
      expect(pivotIndex(w)).toBeLessThan(Math.max(1, w.length));
    }
  });
});

describe("splitPivot", () => {
  it("remonta exatamente a palavra original", () => {
    for (const w of ["casa", "«extraordinário»", "fim.", "1234", "—"]) {
      expect(splitPivot(w).join("")).toBe(w);
    }
  });

  it("a letra-foco tem um caractere", () => {
    expect(splitPivot("palavra")[1]).toHaveLength(1);
  });
});

describe("delayFactor", () => {
  it("palavra comum é a duração base", () => {
    expect(delayFactor("casa")).toBe(1);
  });

  it("fim de frase pausa mais que vírgula", () => {
    expect(delayFactor("fim.")).toBeGreaterThan(delayFactor("meio,"));
    expect(delayFactor("meio,")).toBeGreaterThan(delayFactor("casa"));
  });

  it("pontuação com aspas de fechamento ainda conta", () => {
    expect(delayFactor('fim."')).toBeGreaterThan(1);
  });

  it("palavra longa e número atrasam um pouco", () => {
    expect(delayFactor("extraordinariamente")).toBeGreaterThan(1);
    expect(delayFactor("1917")).toBeGreaterThan(1);
  });

  it("o multiplicador de pontuação escala a pausa", () => {
    expect(delayFactor("fim.", 3)).toBeGreaterThan(delayFactor("fim.", 1));
  });

  it("travessão isolado é uma pausa longa", () => {
    expect(delayFactor("—")).toBeGreaterThan(delayFactor("casa"));
  });
});
