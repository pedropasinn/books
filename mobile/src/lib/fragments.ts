import type { BookContent, Chapter } from "./types";

/**
 * Motor de fragmentos.
 *
 * Um capítulo vira uma sequência de cartões curtos. O corte respeita fim de
 * frase: acumula palavras até passar do alvo e só fecha o cartão quando cai
 * numa fronteira de sentença — assim nenhum fragmento termina no meio de uma
 * oração. Frases gigantes têm um limite duro (2x o alvo) para não estourar a
 * tela.
 *
 * A posição é sempre guardada em índice de PALAVRA dentro do capítulo, não em
 * índice de fragmento: mudar o tamanho do fragmento nos ajustes não perde o
 * lugar de leitura, e é a mesma unidade que o site usa em `read_state`.
 */

export type Fragment = {
  bookSlug: string;
  chapterNumber: number;
  chapterTitle: string;
  /** Índice do fragmento dentro do capítulo. */
  index: number;
  /** Índice da primeira palavra do fragmento dentro do capítulo. */
  startWord: number;
  /** Índice (exclusivo) da última palavra. */
  endWord: number;
  text: string;
};

/** Quebra o texto em palavras preservando a pontuação colada. */
export function tokenize(text: string): string[] {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

/** A palavra encerra uma frase? (considera aspas/parênteses de fechamento) */
function endsSentence(word: string): boolean {
  if (/^\d+\.$/.test(word)) return false; // "1." de lista/numeração
  if (/\b(sr|sra|dr|dra|prof|etc|cf|op|vol|ed|pág|fig|séc)\.$/i.test(word)) return false;
  return /[.!?…][")\]»”’]?$/.test(word);
}

/** Quebra secundária: vírgula forte, ponto-e-vírgula, dois-pontos. */
function endsClause(word: string): boolean {
  return /[;:][")\]»”’]?$/.test(word);
}

export function splitChapter(
  bookSlug: string,
  chapter: Chapter,
  targetWords: number
): Fragment[] {
  const words = tokenize(chapter.text);
  if (!words.length) return [];

  const target = Math.max(12, Math.round(targetWords));
  const hardMax = Math.round(target * 2);
  const out: Fragment[] = [];

  let start = 0;
  while (start < words.length) {
    let end = start;
    let clauseBreak = -1;

    while (end < words.length) {
      const word = words[end];
      end++;
      const taken = end - start;
      if (taken >= Math.round(target * 0.6) && endsClause(word)) clauseBreak = end;
      if (taken >= target && endsSentence(word)) break;
      if (taken >= hardMax) {
        // Frase longa demais: corta na última pausa forte, senão na palavra.
        if (clauseBreak > start) end = clauseBreak;
        break;
      }
    }

    // Sobra minúscula no fim do capítulo: gruda no fragmento anterior.
    if (words.length - end > 0 && words.length - end < Math.round(target * 0.35)) {
      end = words.length;
    }

    out.push({
      bookSlug,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      index: out.length,
      startWord: start,
      endWord: end,
      text: words.slice(start, end).join(" "),
    });
    start = end;
  }

  return out;
}

/** Todos os fragmentos de um livro, na ordem dos capítulos. */
export function splitBook(book: BookContent, targetWords: number): Fragment[] {
  return book.chapters.flatMap((c) => splitChapter(book.slug, c, targetWords));
}

/** Índice do fragmento que contém (capítulo, palavra). -1 se não achar. */
export function findFragmentIndex(
  fragments: Fragment[],
  chapterNumber: number,
  wordIndex: number
): number {
  let fallback = -1;
  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    if (f.chapterNumber !== chapterNumber) continue;
    fallback = i;
    if (wordIndex >= f.startWord && wordIndex < f.endWord) return i;
  }
  return fallback;
}

/** Prévia curta para notificação / cartão da biblioteca. */
export function teaser(text: string, max = 110): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}
