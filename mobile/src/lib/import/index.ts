import type { ImportedBook, OnProgress } from "./types";

/**
 * Porta de entrada dos imports. Cada formato mora no seu módulo e é carregado
 * sob demanda (`import()` dinâmico): quem só lê txt nunca baixa o pdf.js.
 */

export const EXTENSOES_ACEITAS = ".epub,.pdf,.txt,.md,.markdown";

/**
 * `accept` do input de arquivo. Vai extensão E mime porque o Android converte
 * a lista em `EXTRA_MIME_TYPES` do seletor, e daí em diante quem manda é o
 * mime que o provedor do arquivo declara — Drive e Downloads costumam devolver
 * `application/octet-stream` para EPUB, e o arquivo simplesmente sumiria da
 * lista. Por isso ele entra também: é melhor o seletor mostrar demais do que
 * esconder o livro que a pessoa quer. O formato é conferido depois, aqui.
 */
export const ACCEPT_ATTR = [
  EXTENSOES_ACEITAS,
  "application/epub+zip",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/octet-stream",
].join(",");

export type Formato = "epub" | "pdf" | "texto";

export function detectarFormato(file: File): Formato | null {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".epub") || file.type === "application/epub+zip") return "epub";
  if (nome.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (/\.(txt|md|markdown|text)$/.test(nome) || file.type.startsWith("text/")) return "texto";
  return null;
}

export async function importarArquivo(
  file: File,
  onProgress: OnProgress = () => {}
): Promise<ImportedBook> {
  const formato = detectarFormato(file);
  if (!formato) {
    throw new Error("Formato não reconhecido. Use EPUB, PDF, TXT ou MD.");
  }

  onProgress("Lendo o arquivo…");
  switch (formato) {
    case "epub": {
      const { importEpub } = await import("./epub");
      return importEpub(file);
    }
    case "pdf": {
      const { importPdf } = await import("./pdf");
      return importPdf(file, onProgress);
    }
    case "texto": {
      const { importText } = await import("./text");
      return importText(file);
    }
  }
}

export type { ImportedBook, OnProgress };
