import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { RsvpOverlay } from "../components/RsvpOverlay";
import {
  IconArrowDown,
  IconBolt,
  IconBookmark,
  IconBookmarkFilled,
  IconShuffle,
} from "../components/icons";
import { capacidadeEmPalavras } from "../lib/fragments";
import type { Fragment } from "../lib/fragments";
import { useApp } from "../lib/store";

/**
 * O feed.
 *
 * Um cartão por fragmento, ocupando a tela inteira. Abre em MODO FOCO: só o
 * texto, sem barras nem botões. O toque divide a tela em três faixas:
 *
 *   |  anterior  |   mostra/esconde os controles   |  próximo  |
 *
 * Arrastar funciona em qualquer lugar e nos dois eixos (cima/lado = próximo,
 * o contrário = anterior). Com os controles à vista, eles somem sozinhos
 * depois de alguns segundos parados — a tela volta a ser só o texto.
 *
 * O deck é de 3 cartões (anterior / atual / próximo) posicionados fora da
 * tela e movidos por transform, então o arrasto acompanha o dedo em tempo
 * real e a troca de índice acontece só depois da animação terminar.
 */

/** Fração da tela que fecha a virada. */
const COMMIT = 0.22;
/** Velocidade (px/ms) que fecha a virada mesmo sem chegar no limiar. */
const FLICK = 0.45;
const ANIM_MS = 240;
/** Faixa lateral que avança/volta no toque; o miolo liga os controles. */
const ZONA_LATERAL = 0.28;
/** Silêncio até os controles sumirem de novo. */
const AUTO_ESCONDE_MS = 4000;
/** Tem que bater com o `line-height` de `.card__text p` no CSS. */
const ALTURA_LINHA = 1.52;
/** Amostra de prosa em português para medir a largura média de caractere. */
const AMOSTRA = "a sombra da noite caiu sobre o vale e ninguém disse mais nada por ora";

type Axis = "x" | "y";

export function Feed({ onGoToLibrary }: { onGoToLibrary: () => void }) {
  const {
    fragments,
    index,
    advance,
    goTo,
    settings,
    isSaved,
    toggleSaved,
    todayCount,
    mode,
    setMode,
    library,
    activeSlug,
    chrome,
    setChrome,
    setCapacidade,
  } = useApp();

  const [fitTick, setFitTick] = useState(0);
  const [offset, setOffset] = useState(0);
  const [axis, setAxis] = useState<Axis>("y");
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [noAnim, setNoAnim] = useState(false);
  const [rsvp, setRsvp] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<Axis>("y");
  const gesture = useRef({
    id: -1,
    x0: 0,
    y0: 0,
    t0: 0,
    decided: false,
    moved: false,
  });
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current: Fragment | undefined = fragments[index];
  const atEnd = index >= fragments.length;

  const buzz = useCallback(() => {
    if (!settings.haptics) return;
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  }, [settings.haptics]);

  const size = () =>
    axisRef.current === "y"
      ? stageRef.current?.clientHeight || window.innerHeight
      : stageRef.current?.clientWidth || window.innerWidth;

  /** Anima de volta para o lugar (gesto curto demais, ou fim da lista). */
  const settle = useCallback(() => {
    setOffset(0);
    setAnimating(true);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => setAnimating(false), ANIM_MS);
  }, []);

  /** Anima até o cartão vizinho e só então troca o índice (sem pulo). */
  const commit = useCallback(
    (dir: 1 | -1) => {
      if ((dir === -1 && index === 0) || (dir === 1 && index >= fragments.length)) {
        settle();
        return;
      }
      buzz();
      setAnimating(true);
      setOffset(-dir * size());
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => {
        // Troca o índice e zera o deslocamento no mesmo commit — com a
        // transição desligada, senão o cartão "voltaria" deslizando. Sem
        // transição o resultado é idêntico ao que já está na tela: o vizinho
        // virou o atual e está exatamente na mesma posição.
        setNoAnim(true);
        setAnimating(false);
        setOffset(0);
        advance(dir);
        requestAnimationFrame(() => requestAnimationFrame(() => setNoAnim(false)));
      }, ANIM_MS);
    },
    [advance, buzz, index, fragments.length, settle]
  );

  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    },
    []
  );

  // Girar a tela muda a altura disponível: os cartões precisam remedir o texto.
  useEffect(() => {
    const aoRedimensionar = () => setFitTick((t) => t + 1);
    window.addEventListener("resize", aoRedimensionar);
    if (document.fonts?.ready) document.fonts.ready.then(aoRedimensionar).catch(() => {});
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  /**
   * Mede quanto texto cabe de fato num cartão e avisa o store, que usa isso
   * como teto do tamanho de fragmento. Sem essa medição, "120 palavras" com a
   * fonte grande gera um cartão que nem o auto-fit consegue acomodar em
   * tamanho legível. A largura média de caractere sai de uma amostra real
   * renderizada na fonte escolhida — estimar no olho erra feio entre serif,
   * sans e mono.
   */
  const probeRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const probe = probeRef.current;
    const caixa = stageRef.current?.querySelectorAll<HTMLElement>(".card__text")[1];
    if (!probe || !caixa || !caixa.clientHeight) return;

    const base = BASE_PX * settings.fontScale * (settings.font === "mono" ? 0.86 : 1);
    probe.style.fontSize = `${base}px`;
    const larguraMediaChar = probe.offsetWidth / AMOSTRA.length;

    setCapacidade(
      capacidadeEmPalavras(
        caixa.clientWidth,
        caixa.clientHeight,
        base * ALTURA_LINHA,
        larguraMediaChar
      )
    );
  }, [settings.font, settings.fontScale, fitTick, setCapacidade]);

  // Controles à vista somem sozinhos depois de um tempo parado. Qualquer
  // interação (virar de cartão, tocar num botão) reinicia a contagem.
  const escondeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adiarEsconder = useCallback(() => {
    if (escondeTimer.current) clearTimeout(escondeTimer.current);
    escondeTimer.current = setTimeout(() => setChrome(false), AUTO_ESCONDE_MS);
  }, [setChrome]);

  useEffect(() => {
    if (!chrome) {
      if (escondeTimer.current) clearTimeout(escondeTimer.current);
      return;
    }
    adiarEsconder();
    return () => {
      if (escondeTimer.current) clearTimeout(escondeTimer.current);
    };
  }, [chrome, index, adiarEsconder]);

  // Zera o arrasto quando o feed muda por fora (trocar de livro, explorar…).
  useEffect(() => {
    setOffset(0);
    setAnimating(false);
  }, [mode, activeSlug]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (animating) return;
    gesture.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      t0: performance.now(),
      decided: false,
      moved: false,
    };
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!dragging || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;

    if (!g.decided) {
      if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
      g.decided = true;
      g.moved = true;
      // Eixo vai no ref também: `setAxis` só vale no próximo render, e o
      // primeiro frame do arrasto já precisa do eixo certo.
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      setAxis(axisRef.current);
    }

    const raw = axisRef.current === "y" ? dy : dx;
    // Resistência elástica nas pontas.
    const blocked = (raw > 0 && index === 0) || (raw < 0 && index >= fragments.length);
    setOffset(blocked ? raw * 0.28 : raw);
  };

  const endGesture = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (g.id !== e.pointerId) return;
    setDragging(false);
    gesture.current = { ...g, id: -1 };

    if (!g.moved) {
      // Toque simples, por faixa: laterais viram o cartão, o miolo liga e
      // desliga os controles (é o que devolve a tela cheia ao texto).
      const w = stageRef.current?.clientWidth || window.innerWidth;
      const x = e.clientX;
      if (x < w * ZONA_LATERAL) commit(-1);
      else if (x > w * (1 - ZONA_LATERAL)) commit(1);
      else setChrome(!chrome);
      return;
    }

    const dist = Math.abs(offset);
    const speed = dist / Math.max(1, performance.now() - g.t0);
    if (dist > size() * COMMIT || speed > FLICK) {
      commit(offset < 0 ? 1 : -1);
    } else {
      settle();
    }
  };

  const transform = (slot: -1 | 0 | 1) => {
    const pct = slot * 100;
    return axis === "y"
      ? `translate3d(0, calc(${pct}% + ${offset}px), 0)`
      : `translate3d(calc(${pct}% + ${offset}px), 0, 0)`;
  };

  const cardStyle = (slot: -1 | 0 | 1): React.CSSProperties =>
    ({
      transform: transform(slot),
      transition:
        dragging || noAnim ? "none" : `transform ${ANIM_MS}ms cubic-bezier(0.22, 0.7, 0.28, 1)`,
      "--fs": settings.fontScale,
    }) as React.CSSProperties;

  const explorando = mode === "explorar";
  const bookTitle = library.find((b) => b.slug === current?.bookSlug)?.title ?? "";
  // No modo explorar os fragmentos vêm embaralhados de livros diferentes, então
  // a régua é a própria pilha sorteada, não o capítulo.
  const posInScope = explorando ? index + 1 : (current?.index ?? 0) + 1;
  const scopeTotal = explorando
    ? fragments.length
    : current
      ? chapterFragments(fragments, current)
      : 1;
  const chapterPct = Math.round((Math.min(posInScope, scopeTotal) / Math.max(1, scopeTotal)) * 100);

  if (!fragments.length) {
    return (
      <div className="scroller">
        <div className="empty">
          Nenhum livro carregado ainda.
          <br />
          <button className="btn btn--sm" style={{ marginTop: 16 }} onClick={onGoToLibrary}>
            Abrir a biblioteca
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="feed" data-focus={!chrome}>
      <div className="feed__bar" style={{ width: `${chapterPct}%` }} />

      <div className="feed__top" onPointerDown={adiarEsconder}>
        <div className="feed__where">
          <div className="feed__book">
            {explorando ? "Explorar" : bookTitle || current?.chapterTitle || "Fragmentos"}
          </div>
          <div className="feed__chapter">
            {current
              ? explorando
                ? `${bookTitle} · ${posInScope}/${scopeTotal}`
                : `${current.chapterTitle} · ${posInScope}/${scopeTotal}`
              : "fim"}
          </div>
        </div>
        <button
          className="act"
          style={{ width: 34, height: 34 }}
          data-on={mode === "explorar"}
          onClick={() => setMode(mode === "explorar" ? "livro" : "explorar")}
          aria-label="Explorar trechos aleatórios"
        >
          <IconShuffle />
        </button>
        <GoalRing done={todayCount} goal={settings.dailyGoal} />
      </div>

      <span
        ref={probeRef}
        className="probe"
        style={{ fontFamily: `var(--${settings.font})` }}
        aria-hidden
      >
        {AMOSTRA}
      </span>

      <div
        ref={stageRef}
        className="feed__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        {([-1, 0, 1] as const).map((slot) => (
          <Card
            key={slot}
            fragment={fragments[index + slot]}
            slot={slot}
            style={cardStyle(slot)}
            font={settings.font}
            fontScale={settings.fontScale}
            fitTick={fitTick}
          />
        ))}
      </div>

      {index === 0 && !atEnd && (
        <div className="feed__hint">deslize ↑ para o próximo · toque no meio para os controles</div>
      )}

      <div className="feed__actions" onPointerDown={adiarEsconder}>
        <button
          className="act"
          disabled={!current}
          data-on={current ? isSaved(current) : false}
          onClick={() => current && toggleSaved(current)}
          aria-label="Salvar trecho"
        >
          {current && isSaved(current) ? (
            <IconBookmarkFilled />
          ) : (
            <IconBookmark />
          )}
        </button>

        <button
          className="act act--next"
          onClick={() => (atEnd ? goTo(0) : commit(1))}
          aria-label="Próximo fragmento"
        >
          <IconArrowDown />
        </button>

        <button
          className="act"
          disabled={!current}
          onClick={() => current && setRsvp(true)}
          aria-label="Leitura dinâmica"
        >
          <IconBolt />
        </button>
      </div>

      {rsvp && current && (
        <RsvpOverlay
          text={current.text}
          label={`${bookTitle} · ${current.chapterTitle}`}
          onClose={() => setRsvp(false)}
          onFinish={() => {
            if (settings.rsvpAutoNext) advance(1);
            else setRsvp(false);
          }}
        />
      )}
    </div>
  );
}

/** Quantos fragmentos tem o capítulo do fragmento dado (para o "3/12"). */
function chapterFragments(list: Fragment[], f: Fragment): number {
  let n = 0;
  for (const item of list) {
    if (item.bookSlug === f.bookSlug && item.chapterNumber === f.chapterNumber) n++;
  }
  return Math.max(1, n);
}

/** Tamanho-base do texto do cartão, antes do ajuste do usuário e do auto-fit. */
const BASE_PX = 21;
/** O auto-fit não encolhe além disto — abaixo daqui não é mais leitura. */
const MIN_FATOR = 0.62;

function Card({
  fragment,
  slot,
  style,
  font,
  fontScale,
  fitTick,
}: {
  fragment: Fragment | undefined;
  slot: -1 | 0 | 1;
  style: React.CSSProperties;
  font: "serif" | "sans" | "mono";
  fontScale: number;
  /** Muda quando a janela muda de tamanho (girar a tela) — força remedir. */
  fitTick: number;
}) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const textoRef = useRef<HTMLParagraphElement>(null);

  /**
   * Auto-fit: o cartão é uma tela, e o texto tem que caber nela inteiro —
   * cortar em cima e embaixo (que é o que `overflow: hidden` fazia) é pior do
   * que ler um ponto menor. Começa no tamanho escolhido e vai baixando até
   * caber. Roda em `useLayoutEffect`, antes do paint, então não se vê o texto
   * grande "pular" para o tamanho certo — e roda nos três cartões, para o
   * vizinho já entrar ajustado durante o arrasto.
   */
  useLayoutEffect(() => {
    const caixa = caixaRef.current;
    const texto = textoRef.current;
    if (!caixa || !texto) return;

    const base = BASE_PX * fontScale * (font === "mono" ? 0.86 : 1);
    const minimo = base * MIN_FATOR;
    let tamanho = base;
    texto.style.fontSize = `${tamanho}px`;

    let guarda = 0;
    while (texto.scrollHeight > caixa.clientHeight && tamanho > minimo && guarda++ < 30) {
      tamanho = Math.max(minimo, tamanho - Math.max(0.5, tamanho * 0.05));
      texto.style.fontSize = `${tamanho}px`;
    }
  }, [fragment?.text, fontScale, font, fitTick]);

  return (
    <div className={`card card--${font}`} style={style} aria-hidden={slot !== 0}>
      <div className="card__text" ref={caixaRef}>
        {fragment ? (
          <p ref={textoRef}>{fragment.text}</p>
        ) : (
          <div className="card__end" style={{ width: "100%" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>✦</div>
            Você chegou ao fim.
            <br />
            Toque no botão para recomeçar do início.
          </div>
        )}
      </div>
    </div>
  );
}

/** Anel da meta diária no canto do feed. */
function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal > 0 ? done / goal : 0);
  const complete = pct >= 1;
  return (
    <div className={`ring${complete ? " ring--done" : ""}`}>
      <svg width="34" height="34" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.6" />
        <circle
          cx="17"
          cy="17"
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="ring__label">{complete ? "✓" : done}</div>
    </div>
  );
}
