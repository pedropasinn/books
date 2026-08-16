import type { ImportedBook } from "./types";
import { titleFromFilename, toChapters } from "./types";

/**
 * Import de .txt / .md.
 *
 * Arquivo de texto não tem estrutura, então os capítulos saem de heurística:
 * form feed (\f), se houver, senão linhas de cabeçalho ("Capítulo 3", "# Título",
 * "CAPÍTULO IV"). Só divide se achar pelo menos três — com menos que isso, o
 * mais provável é falso positivo, e o livro vira um capítulo só. Isso quase não
 * afeta a leitura (o feed é contínuo); muda o rótulo e a régua de progresso.
 */

/** "Capítulo 3", "CAPÍTULO IV", "Chapter 12", "Parte 2", "# Qualquer coisa". */
const HEADING =
  /^(?:#{1,3}\s+\S.*|(?:cap[íi]tulo|chapter|parte|part|livro|book)\s+(?:\d{1,3}|[ivxlcdm]{1,7})\b.*)$/i;

function decode(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  // Muitos caracteres de substituição = o arquivo não era UTF-8. O palpite
  // seguinte é windows-1252, que cobre praticamente todo .txt em português.
  const ruins = (utf8.match(/�/g) ?? []).length;
  if (ruins > 0 && ruins > utf8.length / 2000) {
    try {
      return new TextDecoder("windows-1252").decode(buffer);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

export async function importText(file: File): Promise<ImportedBook> {
  const raw = decode(await file.arrayBuffer());
  const title = titleFromFilename(file.name);

  const porFormFeed = raw.split("\f").filter((p) => p.trim());
  if (porFormFeed.length >= 2) {
    return {
      title,
      authors: "—",
      chapters: toChapters(
        porFormFeed.map((text, i) => ({ title: `Parte ${i + 1}`, text })),
        title
      ),
    };
  }

  const linhas = raw.replace(/\r\n?/g, "\n").split("\n");
  const cortes: number[] = [];
  linhas.forEach((linha, i) => {
    const l = linha.trim();
    if (l.length > 0 && l.length <= 90 && HEADING.test(l)) cortes.push(i);
  });

  if (cortes.length < 3) {
    return { title, authors: "—", chapters: toChapters([{ title, text: raw }], title) };
  }

  const partes: { title: string; text: string }[] = [];
  if (cortes[0] > 0) partes.push({ title: "Início", text: linhas.slice(0, cortes[0]).join("\n") });
  cortes.forEach((inicio, i) => {
    const fim = cortes[i + 1] ?? linhas.length;
    partes.push({
      title: linhas[inicio].replace(/^#{1,3}\s+/, "").trim(),
      text: linhas.slice(inicio + 1, fim).join("\n"),
    });
  });

  return { title, authors: "—", chapters: toChapters(partes, title) };
}
