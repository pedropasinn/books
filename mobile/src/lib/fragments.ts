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

/**
 * Como as palavras estavam separadas no original: espaço, quebra de linha ou
 * linha em branco. Guardar isso resolve dois problemas de uma vez — dá pontos
 * de corte em texto sem ponto final (poema, diálogo, lista) e deixa o cartão
 * remontar os versos em vez de espremer tudo num parágrafo.
 */
type Separador = " " | "\n" | "\n\n";

function tokenizeWithBreaks(text: string): { words: string[]; sep: Separador[] } {
  const words: string[] = [];
  const sep: Separador[] = [];

  const linhas = text.replace(/\r\n?/g, "\n").split("\n");
  linhas.forEach((linha, i) => {
    const palavras = linha.trim().split(/[ \t]+/).filter(Boolean);
    const vazia = palavras.length === 0;

    palavras.forEach((p, j) => {
      words.push(p);
      // Separador DEPOIS desta palavra: espaço dentro da linha; no fim da
      // linha, depende de quantas linhas em branco vêm a seguir.
      sep.push(j < palavras.length - 1 ? " " : "\n");
    });

    // Linha em branco: promove a quebra da última palavra a parágrafo.
    if (vazia && sep.length) sep[sep.length - 1] = "\n\n";
    if (i === linhas.length - 1 && sep.length) sep[sep.length - 1] = " ";
  });

  return { words, sep };
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
  const { words, sep } = tokenizeWithBreaks(chapter.text);
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
      const quebraDeLinha = sep[end] !== " ";
      end++;
      const taken = end - start;
      if (taken >= Math.round(target * 0.6) && endsClause(word)) clauseBreak = end;
      // Fim de frase OU fim de linha do original: em verso, diálogo e lista o
      // ponto final quase não aparece, e sem isso o fragmento estouraria a tela.
      if (taken >= target && (endsSentence(word) || quebraDeLinha)) break;
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

    // Remonta o trecho com os separadores originais: o verso volta a ser verso
    // e o parágrafo volta a ser parágrafo (o cartão renderiza com pre-wrap).
    let texto = "";
    for (let i = start; i < end; i++) {
      texto += words[i];
      if (i < end - 1) texto += sep[i];
    }

    out.push({
      bookSlug,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      index: out.length,
      startWord: start,
      endWord: end,
      text: texto,
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

/**
 * Quantas palavras cabem numa caixa, no tamanho de fonte dado.
 *
 * Existe porque o ajuste "tamanho do fragmento" é um pedido, não uma promessa:
 * 120 palavras com a fonte no máximo não cabem em tela de celular nenhuma, e
 * espremer a fonte até caber deixaria de ser leitura. Então o corte respeita o
 * MENOR entre o que o usuário pediu e o que a tela comporta.
 *
 * A conta é: quantas linhas cabem na altura × quantos caracteres cabem na
 * linha ÷ tamanho médio de palavra. `larguraMediaChar` vem de medição real no
 * DOM (a fonte muda tudo), não de chute.
 */
export function capacidadeEmPalavras(
  larguraCaixa: number,
  alturaCaixa: number,
  alturaLinha: number,
  larguraMediaChar: number
): number {
  if (larguraCaixa <= 0 || alturaCaixa <= 0 || alturaLinha <= 0 || larguraMediaChar <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const linhas = Math.floor(alturaCaixa / alturaLinha);
  const charsPorLinha = larguraCaixa / larguraMediaChar;
  // 0.9: a última linha de cada parágrafo sobra, e o texto não é justificado.
  const chars = linhas * charsPorLinha * 0.9;
  // ~5,2 letras por palavra em português, mais o espaço.
  return Math.max(12, Math.floor(chars / 6.2));
}

/** Prévia curta para notificação / cartão da biblioteca. */
export function teaser(text: string, max = 110): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}
