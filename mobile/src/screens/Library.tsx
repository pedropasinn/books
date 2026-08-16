import { useRef, useState } from "react";
import { IconDown, IconFile, IconRefresh, IconTrash } from "../components/icons";
import { ACCEPT_ATTR, importarArquivo } from "../lib/import";
import { countWords } from "../lib/import/types";
import { useApp } from "../lib/store";

/**
 * Biblioteca: sincroniza o catálogo do site, importa arquivos do aparelho
 * (EPUB, PDF, TXT/MD), baixa livros e abre no feed.
 */
export function Library({ onOpened }: { onOpened: () => void }) {
  const {
    library,
    downloaded,
    progress,
    activeSlug,
    openBook,
    removeBook,
    syncLibrary,
    addLocalBook,
    settings,
    busy,
  } = useApp();

  const [colando, setColando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [andamento, setAndamento] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const configurado = !!settings.serverUrl && !!settings.token;

  const importar = async (file: File) => {
    setFalha(null);
    setAndamento("Lendo o arquivo…");
    try {
      // Um quadro de folga antes de trabalhar: o parse é síncrono em partes e
      // travaria a tela antes de o aviso de andamento aparecer.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const livro = await importarArquivo(file, setAndamento);
      await addLocalBook(livro.title, livro.authors, livro.chapters);
      setAndamento(null);
      onOpened();
    } catch (e) {
      setAndamento(null);
      setFalha(e instanceof Error ? e.message : "Não consegui ler este arquivo.");
    }
  };

  return (
    <div className="scroller">
      <h1 className="h1">Biblioteca</h1>
      <p className="sub">
        Baixe um livro uma vez e ele fica no aparelho — o feed funciona sem internet.
      </p>

      <button
        className="btn btn--wide"
        onClick={() => arquivoRef.current?.click()}
        disabled={!!andamento}
      >
        <IconFile style={{ width: 17, height: 17 }} />
        {andamento ?? "Importar EPUB, PDF ou TXT"}
      </button>
      <input
        ref={arquivoRef}
        type="file"
        accept={ACCEPT_ATTR}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // permite reimportar o mesmo arquivo
          if (f) void importar(f);
        }}
      />

      {falha && (
        <p className="row__hint" style={{ marginTop: 12, color: "#fca5a5" }}>
          {falha}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => syncLibrary()}
          disabled={!configurado || !!busy}
        >
          <IconRefresh style={{ width: 16, height: 16 }} />
          Sincronizar
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => setColando((v) => !v)}>
          Colar texto
        </button>
      </div>

      {!configurado && (
        <p className="row__hint" style={{ marginTop: 12 }}>
          O import funciona sozinho. Para trazer os livros do site, configure o endereço e a
          senha em Ajustes.
        </p>
      )}

      {colando && (
        <div className="section">
          <div className="field">
            <label className="field__label">Título</label>
            <input
              className="input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Anotações do Sêneca"
            />
          </div>
          <div className="field">
            <label className="field__label">Texto</label>
            <textarea
              className="textarea"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Cole aqui o trecho ou capítulo…"
            />
          </div>
          <button
            className="btn btn--wide"
            disabled={!texto.trim()}
            onClick={async () => {
              const nome = titulo.trim() || "Texto colado";
              await addLocalBook(nome, "—", [
                { number: 1, title: nome, text: texto, wordCount: countWords(texto) },
              ]);
              setTitulo("");
              setTexto("");
              setColando(false);
              onOpened();
            }}
          >
            Criar e ler
          </button>
        </div>
      )}

      <div className="section">
        <div className="section__title">
          {library.length ? `${library.length} livro${library.length > 1 ? "s" : ""}` : "Vazio"}
        </div>

        {!library.length && (
          <div className="empty">
            Nada aqui ainda.
            <br />
            Sincronize com o site ou cole um texto para começar.
          </div>
        )}

        {library.map((b) => {
          const baixado = downloaded.includes(b.slug);
          const p = progress[b.slug];
          const estimado = Math.max(1, Math.round(b.wordCount / settings.fragmentSize));
          const pct = p ? Math.min(100, Math.round((p.fragmentsRead / estimado) * 100)) : 0;
          return (
            <div key={b.slug} className="tile">
              <button
                style={{ display: "block", width: "100%", textAlign: "left" }}
                onClick={async () => {
                  await openBook(b.slug);
                  onOpened();
                }}
              >
                <div className="tile__top">
                  <span className="tile__title">{b.title}</span>
                  <span className="tile__meta">
                    {baixado ? `${estimado} frag.` : `${Math.round(b.wordCount / 1000)}k pal.`}
                  </span>
                </div>
                <div className="tile__sub">
                  {b.authors}
                  {activeSlug === b.slug ? " · lendo agora" : ""}
                </div>
                {pct > 0 && (
                  <div className="bar">
                    <div className="bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </button>

              <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                {!baixado ? (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => openBook(b.slug)}
                    disabled={!!busy}
                  >
                    <IconDown style={{ width: 15, height: 15 }} />
                    Baixar
                  </button>
                ) : (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => removeBook(b.slug)}
                    aria-label="Remover do aparelho"
                  >
                    <IconTrash style={{ width: 15, height: 15 }} />
                    Remover
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
