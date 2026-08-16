import type { BookContent, BookMeta, Chapter } from "./types";

/**
 * Sincronização com o site (rotas `/api/mobile/*`).
 *
 * O site é fechado por senha; aqui a autenticação é por Bearer token — a
 * mesma `SITE_PASSWORD`, ou um `MOBILE_SYNC_TOKEN` dedicado (revogável sem
 * mexer na senha do site).
 */

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function apiGet<T>(serverUrl: string, token: string, path: string): Promise<T> {
  const base = normalizeUrl(serverUrl);
  if (!base) throw new Error("Endereço do servidor não configurado.");

  const res = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (res.status === 401) throw new Error("Senha/token recusado pelo servidor.");
  if (!res.ok) throw new Error(`Servidor respondeu ${res.status}.`);
  return (await res.json()) as T;
}

type LibraryResponse = {
  books: Omit<BookMeta, "origin">[];
};

/** Busca o catálogo (livros + índice de capítulos, sem texto). */
export async function fetchLibrary(serverUrl: string, token: string): Promise<BookMeta[]> {
  const data = await apiGet<LibraryResponse>(serverUrl, token, "/api/mobile/library");
  return (data.books ?? []).map((b) => ({ ...b, origin: "sync" as const }));
}

type BookResponse = {
  slug: string;
  title: string;
  authors: string;
  chapters: Chapter[];
};

/** Baixa o texto integral de um livro para leitura offline. */
export async function fetchBook(
  serverUrl: string,
  token: string,
  slug: string
): Promise<BookContent> {
  const data = await apiGet<BookResponse>(
    serverUrl,
    token,
    `/api/mobile/book/${encodeURIComponent(slug)}`
  );
  return {
    slug: data.slug,
    title: data.title,
    authors: data.authors,
    chapters: (data.chapters ?? []).filter((c) => c.text?.trim()),
    fetchedAt: Date.now(),
  };
}

/** Testa endereço + token antes de salvar nos ajustes. */
export async function testConnection(serverUrl: string, token: string): Promise<number> {
  const books = await fetchLibrary(serverUrl, token);
  return books.length;
}
