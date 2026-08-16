import { useState } from "react";
import { IconDown, IconRefresh, IconTrash } from "../components/icons";
import { useApp } from "../lib/store";

/** Biblioteca: sincroniza o catálogo do site, baixa livros e abre no feed. */
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

  const configurado = !!settings.serverUrl && !!settings.token;

  return (
    <div className="scroller">
      <h1 className="h1">Biblioteca</h1>
      <p className="sub">
        Baixe um livro uma vez e ele fica no aparelho — o feed funciona sem internet.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
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
          Configure o endereço do site e a senha em Ajustes para sincronizar seus livros.
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
              await addLocalBook(titulo, texto);
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
