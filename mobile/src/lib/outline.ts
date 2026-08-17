import type { Fragment } from "./fragments";
import type { SavedFragment } from "./types";
import { isBeyond } from "./position";
import type { Position } from "./position";

/**
 * O índice do livro: capítulos, quantos "cartões" cada um tem, quais deles
 * guardam trechos marcados e até onde a leitura chegou.
 *
 * Tudo é derivado da lista de fragmentos já cortada, não recalculado por fora
 * — assim os números que o índice mostra são exatamente os que o feed usa, e
 * continuam batendo quando o tamanho do fragmento muda.
 */

export type EstadoCapitulo = "lido" | "atual" | "novo";

export type CartaoDoIndice = {
  /** Número visível para o leitor: 1-based dentro do capítulo. */
  numero: number;
  /** Índice na lista completa do livro — é para onde o feed vai. */
  indiceGlobal: number;
  startWord: number;
  temMarcador: boolean;
  lido: boolean;
};

export type CapituloDoIndice = {
  numero: number;
  titulo: string;
  cartoes: CartaoDoIndice[];
  marcadores: number;
  estado: EstadoCapitulo;
  /** Fração lida do capítulo (0–1), pelo ponto mais distante. */
  progresso: number;
};

/**
 * Monta o índice.
 *
 * `atual` é onde a leitura está agora (para destacar o capítulo aberto) e
 * `furthest`, o ponto mais distante já lido (para marcar o que ficou para
 * trás). São diferentes de propósito: relendo um trecho antigo, o capítulo
 * atual muda e o que já foi lido continua lido.
 */
export function montarIndice(
  fragments: Fragment[],
  saved: SavedFragment[],
  atual: Position | null,
  furthest: Position | null
): CapituloDoIndice[] {
  if (!fragments.length) return [];

  const marcados = new Set(saved.map((s) => `${s.chapterNumber}:${s.startWord}`));
  const capitulos = new Map<number, CapituloDoIndice>();

  fragments.forEach((f, indiceGlobal) => {
    let cap = capitulos.get(f.chapterNumber);
    if (!cap) {
      cap = {
        numero: f.chapterNumber,
        titulo: f.chapterTitle,
        cartoes: [],
        marcadores: 0,
        estado: "novo",
        progresso: 0,
      };
      capitulos.set(f.chapterNumber, cap);
    }

    const temMarcador = marcados.has(`${f.chapterNumber}:${f.startWord}`);
    if (temMarcador) cap.marcadores++;

    cap.cartoes.push({
      numero: cap.cartoes.length + 1,
      indiceGlobal,
      startWord: f.startWord,
      temMarcador,
      // "Lido" = o ponto mais distante já passou do FIM deste cartão.
      lido: furthest
        ? isBeyond(furthest, { chapterNumber: f.chapterNumber, wordIndex: f.endWord - 1 })
        : false,
    });
  });

  for (const cap of capitulos.values()) {
    const lidos = cap.cartoes.filter((c) => c.lido).length;
    cap.progresso = cap.cartoes.length ? lidos / cap.cartoes.length : 0;
    if (atual?.chapterNumber === cap.numero) cap.estado = "atual";
    else if (lidos === cap.cartoes.length && lidos > 0) cap.estado = "lido";
    else cap.estado = lidos > 0 ? "atual" : "novo";
  }

  return [...capitulos.values()].sort((a, b) => a.numero - b.numero);
}

/** Índice global do cartão que contém a posição, ou -1. */
export function indiceGlobalDe(
  capitulos: CapituloDoIndice[],
  chapterNumber: number,
  wordIndex: number
): number {
  const cap = capitulos.find((c) => c.numero === chapterNumber);
  if (!cap) return -1;
  // O último cartão que começa em ou antes da palavra procurada.
  let achado = -1;
  for (const c of cap.cartoes) {
    if (c.startWord <= wordIndex) achado = c.indiceGlobal;
    else break;
  }
  return achado >= 0 ? achado : (cap.cartoes[0]?.indiceGlobal ?? -1);
}
