import type { Chapter } from "../types";

/** Resultado de um import: já no formato que o app guarda. */
export type ImportedBook = {
  title: string;
  authors: string;
  chapters: Chapter[];
};

/** Callback de andamento — o import de PDF grande demora alguns segundos. */
export type OnProgress = (mensagem: string) => void;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Normaliza o texto de um capítulo: tira espaços à direita, colapsa mais de
 * duas quebras seguidas e remove hífen de fim de linha (palavra partida na
 * quebra), que é comum em PDF e em EPUB convertido de papel.
 */
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, "$1$2")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Monta os capítulos numerados, descartando os que ficaram vazios. */
export function toChapters(
  parts: { title: string; text: string }[],
  fallbackTitle: string
): Chapter[] {
  return parts
    .map((p) => ({ title: p.title.trim() || fallbackTitle, text: tidy(p.text) }))
    .filter((p) => countWords(p.text) >= 10)
    .map((p, i) => ({
      number: i + 1,
      title: p.title,
      text: p.text,
      wordCount: countWords(p.text),
    }));
}

/** Nome do arquivo sem extensão, para usar como título quando não há metadado. */
export function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Sem título";
}
