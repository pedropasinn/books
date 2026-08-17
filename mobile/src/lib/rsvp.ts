/**
 * Núcleo do RSVP (leitura dinâmica estilo Spritz).
 *
 * Portado de `site/components/rsvp-reader.tsx` — mesma regra de letra-foco
 * (ORP) e de pausa por pontuação, para a leitura no celular ter exatamente a
 * cadência do modo tela cheia do site. Mantido como módulo puro (sem React)
 * porque o app roda em outro build.
 */

const LETTER = /[\p{L}\p{N}]/u;

/** Posição da letra-foco (ORP), descontando pontuação no início da palavra. */
export function pivotIndex(word: string): number {
  let start = 0;
  while (start < word.length && !LETTER.test(word[start])) start++;
  let end = start;
  while (end < word.length && LETTER.test(word[end])) end++;
  const n = end - start; // tamanho do "miolo" alfanumérico
  let p: number;
  if (n <= 1) p = 0;
  else if (n <= 5) p = 1;
  else if (n <= 9) p = 2;
  else if (n <= 13) p = 3;
  else p = 4;
  return Math.min(Math.max(word.length - 1, 0), start + p);
}

/** Multiplicador de duração: pausas em pontuação, travessões, números, longas. */
export function delayFactor(word: string, punctMult = 1.6): number {
  let f = 1;
  if (/^[—–]$/.test(word)) return f + 0.9 * punctMult;
  if (/[.!?…]["'”’)\]]?$/.test(word)) f += 0.9 * punctMult;
  else if (/[,;:][”’"')\]]?$/.test(word)) f += 0.45 * punctMult;
  else if (/[—–)\]]$/.test(word)) f += 0.5 * punctMult;
  if (/^[—–("¿¡'"]/.test(word)) f += 0.3 * punctMult;
  if (word.replace(/[^\p{L}\p{N}]/gu, "").length > 8) f += 0.25;
  if (/\d/.test(word)) f += 0.2;
  return f;
}

/** Divide a palavra em (antes, foco, depois) para renderizar o pivô. */
export function splitPivot(word: string): [string, string, string] {
  const p = pivotIndex(word);
  return [word.slice(0, p), word.slice(p, p + 1), word.slice(p + 1)];
}
