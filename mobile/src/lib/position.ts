import type { BookProgress, ChapterMeta } from "./types";

/**
 * Posição de leitura.
 *
 * A unidade é (capítulo, palavra) — nunca "fragmento N". Índice de fragmento
 * não é estável: muda com o tamanho escolhido nos ajustes, com o tamanho da
 * tela (que limita a capacidade) e com a fonte. "Fragmento 100" hoje não é o
 * mesmo trecho de amanhã, então guardar isso apodrece o histórico. Palavra é
 * uma propriedade do texto, não da renderização.
 *
 * São dois conceitos distintos, de propósito:
 *   • `resume`   — onde você parou, para onde o app volta;
 *   • `furthest` — o ponto mais distante que você já leu de fato.
 * Reler para trás move o primeiro e não o segundo, e é o segundo que manda no
 * hábito e na barra de progresso.
 */
export type Position = {
  chapterNumber: number;
  wordIndex: number;
};

/** Deslocamento absoluto da palavra dentro do livro inteiro. */
export function absoluteWord(chapters: ChapterMeta[], pos: Position): number {
  let total = 0;
  for (const c of chapters) {
    if (c.number >= pos.chapterNumber) break;
    total += c.wordCount;
  }
  return total + Math.max(0, pos.wordIndex);
}

/** `a` está adiante de `b`? Compara capítulo e, empatando, palavra. */
export function isBeyond(a: Position, b: Position | null | undefined): boolean {
  if (!b) return true;
  if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber > b.chapterNumber;
  return a.wordIndex > b.wordIndex;
}

/** Fração lida (0–1), pelo ponto mais distante alcançado. */
export function fractionRead(chapters: ChapterMeta[], furthest: Position | null): number {
  if (!furthest || !chapters.length) return 0;
  const total = chapters.reduce((s, c) => s + c.wordCount, 0);
  if (total <= 0) return 0;
  return Math.min(1, absoluteWord(chapters, furthest) / total);
}

/** Identidade estável de um fragmento, para deduplicar o que já foi contado. */
export function fragmentKey(bookSlug: string, pos: Position): string {
  return `${bookSlug}:${pos.chapterNumber}:${pos.wordIndex}`;
}

export type Registro = {
  /** Novo progresso do livro, ou `null` para não mexer em nada. */
  progresso: BookProgress | null;
  /** Este fragmento conta para a meta do dia? */
  contarHabito: boolean;
};

/**
 * Decide o que uma leitura muda. Função pura, separada do React de propósito:
 * é a regra mais fácil de quebrar sem ninguém perceber, e a mais cara quando
 * quebra (mexe no histórico de leitura).
 *
 * As duas origens são tratadas de forma diferente:
 *
 * • sequencial — leitura do livro. Move a posição de retomada sempre; move o
 *   ponto mais distante e conta hábito só quando avança de fato (reler para
 *   trás não infla nada).
 *
 * • explorar — trechos sorteados de qualquer capítulo de qualquer livro. NÃO
 *   toca no progresso: se tocasse, cair num trecho do capítulo 17 apagaria o
 *   lugar onde a leitura estava, e o app reabriria lá. Conta hábito uma vez
 *   por fragmento (ler é ler), com dedupe de quem chama.
 */
export function registrarLeitura(
  atual: BookProgress | undefined,
  pos: Position,
  opts: { sequencial: boolean; jaExplorado?: boolean; agora: number }
): Registro {
  if (!opts.sequencial) {
    return { progresso: null, contarHabito: !opts.jaExplorado };
  }

  const anterior = atual
    ? { chapterNumber: atual.furthestChapter, wordIndex: atual.furthestWord }
    : null;
  const avancou = isBeyond(pos, anterior);

  return {
    progresso: {
      chapterNumber: pos.chapterNumber,
      wordIndex: pos.wordIndex,
      updatedAt: opts.agora,
      furthestChapter: avancou ? pos.chapterNumber : (atual?.furthestChapter ?? pos.chapterNumber),
      furthestWord: avancou ? pos.wordIndex : (atual?.furthestWord ?? pos.wordIndex),
    },
    contarHabito: avancou,
  };
}
