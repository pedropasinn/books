import { describe, expect, it } from "vitest";
import { bumpStreak, bumpToday, dayKey, displayStreak, fragmentsToday, lastDays } from "./habit";

const hoje = dayKey();
const dias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

describe("dayKey", () => {
  it("usa o dia local, não UTC", () => {
    // 23h de 31/12 em fuso negativo ainda é 31/12 para quem está lendo.
    const d = new Date(2025, 11, 31, 23, 30);
    expect(dayKey(d)).toBe("2025-12-31");
  });

  it("preenche mês e dia com zero", () => {
    expect(dayKey(new Date(2025, 0, 5))).toBe("2025-01-05");
  });
});

describe("bumpToday", () => {
  it("cria o dia quando ainda não existe", () => {
    expect(fragmentsToday(bumpToday([]))).toBe(1);
  });

  it("soma no dia de hoje sem tocar nos outros", () => {
    const antes = [
      { day: dias(-1), fragments: 7 },
      { day: hoje, fragments: 2 },
    ];
    const depois = bumpToday(antes);
    expect(fragmentsToday(depois)).toBe(3);
    expect(depois.find((d) => d.day === dias(-1))?.fragments).toBe(7);
  });

  it("não muda o array original", () => {
    const antes = [{ day: hoje, fragments: 1 }];
    bumpToday(antes);
    expect(antes[0].fragments).toBe(1);
  });

  it("guarda no máximo 120 dias", () => {
    const muitos = Array.from({ length: 200 }, (_, i) => ({ day: `2020-01-${i}`, fragments: 1 }));
    expect(bumpToday(muitos).length).toBeLessThanOrEqual(120);
  });
});

describe("bumpStreak", () => {
  it("começa em 1", () => {
    expect(bumpStreak({ current: 0, best: 0, lastDay: null })).toMatchObject({
      current: 1,
      best: 1,
      lastDay: hoje,
    });
  });

  it("dia seguido soma", () => {
    expect(bumpStreak({ current: 4, best: 9, lastDay: dias(-1) })).toMatchObject({
      current: 5,
      best: 9,
    });
  });

  it("buraco recomeça em 1 e preserva o recorde", () => {
    expect(bumpStreak({ current: 30, best: 30, lastDay: dias(-3) })).toMatchObject({
      current: 1,
      best: 30,
    });
  });

  it("bater a meta de novo no mesmo dia não conta duas vezes", () => {
    const s = { current: 3, best: 5, lastDay: hoje };
    expect(bumpStreak(s)).toBe(s);
  });

  it("atualiza o recorde ao ultrapassá-lo", () => {
    expect(bumpStreak({ current: 9, best: 9, lastDay: dias(-1) }).best).toBe(10);
  });
});

describe("displayStreak", () => {
  it("vale hoje e ontem", () => {
    expect(displayStreak({ current: 6, best: 6, lastDay: hoje })).toBe(6);
    expect(displayStreak({ current: 6, best: 6, lastDay: dias(-1) })).toBe(6);
  });

  it("expira a partir de dois dias", () => {
    expect(displayStreak({ current: 6, best: 6, lastDay: dias(-2) })).toBe(0);
  });

  it("é zero sem histórico", () => {
    expect(displayStreak({ current: 0, best: 0, lastDay: null })).toBe(0);
  });
});

describe("lastDays", () => {
  it("devolve a janela pedida terminando em hoje", () => {
    const janela = lastDays([{ day: hoje, fragments: 4 }], 7);
    expect(janela).toHaveLength(7);
    expect(janela[6]).toEqual({ day: hoje, fragments: 4 });
  });

  it("preenche com zero os dias sem leitura", () => {
    expect(lastDays([], 3).every((d) => d.fragments === 0)).toBe(true);
  });
});
