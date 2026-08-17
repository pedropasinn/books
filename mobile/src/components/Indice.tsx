import { useEffect, useMemo, useRef, useState } from "react";
import { IconBookmarkFilled, IconClose } from "./icons";
import { montarIndice } from "../lib/outline";
import type { CapituloDoIndice } from "../lib/outline";
import { useApp } from "../lib/store";

/**
 * Índice do livro.
 *
 * Lista os capítulos com o quanto já foi lido e quantos trechos marcados cada
 * um guarda; abrindo um capítulo, aparece a grade com os NÚMEROS dos cartões
 * — tocar num número pula direto para ele, como virar para uma página. Os
 * números com marcador ficam destacados, então dá para ir de bookmark em
 * bookmark sem sair do índice.
 *
 * A numeração vem da mesma lista de fragmentos que o feed usa, então ela
 * continua batendo quando o tamanho do fragmento muda.
 */
export function Indice({ onClose }: { onClose: () => void }) {
  const { bookFragments, saved, activeSlug, progress, index, goTo, library } = useApp();

  const doLivro = useMemo(
    () => saved.filter((s) => s.bookSlug === activeSlug),
    [saved, activeSlug]
  );

  const atual = bookFragments[index];
  const p = activeSlug ? progress[activeSlug] : undefined;

  const capitulos = useMemo(
    () =>
      montarIndice(
        bookFragments,
        doLivro,
        atual ? { chapterNumber: atual.chapterNumber, wordIndex: atual.startWord } : null,
        p ? { chapterNumber: p.furthestChapter, wordIndex: p.furthestWord } : null
      ),
    [bookFragments, doLivro, atual, p]
  );

  /**
   * Abre já no capítulo em que a leitura está. No cartão final do livro não há
   * "atual" — aí abre o último capítulo, que é o que a pessoa acabou de ler;
   * e num livro ainda intocado, o primeiro. Abrir sem nada expandido deixaria
   * a grade de números invisível justamente para quem foi buscá-la.
   */
  const [aberto, setAberto] = useState<number | null>(
    () =>
      atual?.chapterNumber ??
      bookFragments[bookFragments.length - 1]?.chapterNumber ??
      null
  );
  const [soMarcados, setSoMarcados] = useState(false);
  const atualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    atualRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const titulo = library.find((b) => b.slug === activeSlug)?.title ?? "Índice";
  const totalMarcadores = doLivro.length;

  const visiveis = soMarcados ? capitulos.filter((c) => c.marcadores > 0) : capitulos;

  const pular = (indiceGlobal: number) => {
    goTo(indiceGlobal);
    onClose();
  };

  return (
    <div className="sheet">
      <div className="sheet__bar">
        <div className="sheet__where">
          <div className="sheet__title">{titulo}</div>
          <div className="sheet__sub">
            {capitulos.length} capítulos ·{" "}
            {totalMarcadores === 0
              ? "nenhum marcador"
              : `${totalMarcadores} marcador${totalMarcadores > 1 ? "es" : ""}`}
          </div>
        </div>
        {totalMarcadores > 0 && (
          <button
            className="act"
            style={{ width: 36, height: 36 }}
            data-on={soMarcados}
            onClick={() => setSoMarcados((v) => !v)}
            aria-label="Mostrar só capítulos com marcadores"
          >
            <IconBookmarkFilled style={{ width: 17, height: 17 }} />
          </button>
        )}
        <button
          className="act"
          style={{ width: 36, height: 36 }}
          onClick={onClose}
          aria-label="Fechar índice"
        >
          <IconClose style={{ width: 18, height: 18 }} />
        </button>
      </div>

      <div className="sheet__body">
        {!visiveis.length && (
          <div className="empty">
            {soMarcados
              ? "Nenhum capítulo com trechos marcados ainda."
              : "Abra um livro para ver o índice."}
          </div>
        )}

        {visiveis.map((cap) => (
          <Capitulo
            key={cap.numero}
            cap={cap}
            aberto={aberto === cap.numero}
            atualGlobal={index}
            soMarcados={soMarcados}
            refAtual={cap.estado === "atual" ? atualRef : undefined}
            onToggle={() => setAberto(aberto === cap.numero ? null : cap.numero)}
            onPular={pular}
          />
        ))}
      </div>
    </div>
  );
}

function Capitulo({
  cap,
  aberto,
  atualGlobal,
  soMarcados,
  refAtual,
  onToggle,
  onPular,
}: {
  cap: CapituloDoIndice;
  aberto: boolean;
  atualGlobal: number;
  soMarcados: boolean;
  refAtual?: React.RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onPular: (indiceGlobal: number) => void;
}) {
  const cartoes = soMarcados ? cap.cartoes.filter((c) => c.temMarcador) : cap.cartoes;

  return (
    <div className="cap" ref={refAtual} data-estado={cap.estado}>
      <button className="cap__head" onClick={onToggle}>
        <span className="cap__num">{cap.numero}</span>
        <span className="cap__meio">
          <span className="cap__titulo">{cap.titulo}</span>
          <span className="cap__meta">
            {cap.cartoes.length} cartões
            {cap.marcadores > 0 && ` · ${cap.marcadores} marcado${cap.marcadores > 1 ? "s" : ""}`}
            {cap.progresso > 0 && ` · ${Math.round(cap.progresso * 100)}%`}
          </span>
        </span>
        {cap.marcadores > 0 && <IconBookmarkFilled className="cap__flag" />}
      </button>

      {cap.progresso > 0 && cap.progresso < 1 && (
        <div className="bar" style={{ marginTop: 0 }}>
          <div className="bar__fill" style={{ width: `${cap.progresso * 100}%` }} />
        </div>
      )}

      {aberto && (
        <div className="paginas">
          {cartoes.map((c) => (
            <button
              key={c.indiceGlobal}
              className="pagina"
              data-atual={c.indiceGlobal === atualGlobal}
              data-lido={c.lido}
              data-marcado={c.temMarcador}
              onClick={() => onPular(c.indiceGlobal)}
              aria-label={`Ir para o cartão ${c.numero} do capítulo ${cap.numero}`}
            >
              {c.numero}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
