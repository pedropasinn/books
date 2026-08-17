import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { delayFactor, splitPivot } from "../lib/rsvp";
import { tokenize } from "../lib/fragments";
import { useApp } from "../lib/store";
import { IconClose, IconPause, IconPlay } from "./icons";

/**
 * Leitura dinâmica (RSVP) em tela cheia, do jeito que o site faz: a letra-foco
 * fica sempre na MESMA posição horizontal. O deslocamento é medido no layout
 * (offsetLeft do span do pivô), então funciona com qualquer fonte.
 */

const WPM_STEPS = [250, 300, 350, 400, 500, 600];
const FONTS: Record<string, string> = {
  mono: "var(--mono)",
  sans: "var(--sans)",
  serif: "var(--serif)",
};

type Props = {
  text: string;
  /** Rótulo discreto no topo (livro · capítulo). */
  label?: string;
  onClose: () => void;
  /** Chamado quando a última palavra termina. */
  onFinish: () => void;
};

export function RsvpOverlay({ text, label, onClose, onFinish }: Props) {
  const { settings, setPref } = useApp();
  const words = useMemo(() => tokenize(text), [text]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [shift, setShift] = useState(0);
  const [tick, setTick] = useState(0);
  const pivotRef = useRef<HTMLSpanElement>(null);
  const finishedRef = useRef(false);
  // `onFinish` muda de identidade a cada render do pai; guardar num ref evita
  // que o relógio abaixo seja recriado no meio da palavra e perca a cadência.
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const word = words[idx] ?? "";
  const [before, pivot, after] = splitPivot(word);

  // Recomeça quando o fragmento muda.
  useEffect(() => {
    setIdx(0);
    setPlaying(true);
    finishedRef.current = false;
  }, [text]);

  // Ancora o centro real da letra-foco no reticle (medido antes do paint).
  useLayoutEffect(() => {
    const pv = pivotRef.current;
    if (pv) setShift(-(pv.offsetLeft + pv.offsetWidth / 2));
  }, [idx, word, settings.rsvpFont, settings.fontScale, tick]);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("resize", bump);
    if (document.fonts?.ready) document.fonts.ready.then(bump).catch(() => {});
    return () => window.removeEventListener("resize", bump);
  }, []);

  // Relógio: cada palavra tem sua própria duração.
  useEffect(() => {
    if (!playing || !words.length) return;
    const base = 60000 / settings.wpm;

    if (idx >= words.length - 1) {
      const t = setTimeout(() => {
        setPlaying(false);
        if (!finishedRef.current) {
          finishedRef.current = true;
          finishRef.current();
        }
      }, base * 1.6);
      return () => clearTimeout(t);
    }

    const dur = base * delayFactor(words[idx] ?? "");
    const t = setTimeout(() => setIdx((i) => i + 1), dur);
    return () => clearTimeout(t);
  }, [playing, idx, words, settings.wpm]);

  const cycleSpeed = useCallback(() => {
    const next = WPM_STEPS.find((w) => w > settings.wpm) ?? WPM_STEPS[0];
    setPref("wpm", next);
  }, [settings.wpm, setPref]);

  const left = words.length - idx - 1;
  const secs = settings.wpm > 0 ? Math.ceil((left / settings.wpm) * 60) : 0;

  return (
    <div className="rsvp" style={{ "--rs": settings.fontScale } as React.CSSProperties}>
      <button className="rsvp__close" onClick={onClose} aria-label="Fechar">
        <IconClose />
      </button>

      {label && (
        <div
          style={{
            position: "absolute",
            top: "calc(var(--safe-top) + 22px)",
            left: 20,
            right: 62,
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--muted-dim)",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
      )}

      {/* Toque em qualquer lugar da área central pausa/retoma. */}
      <div className="rsvp__stage" onPointerUp={() => setPlaying((p) => !p)}>
        <div className="rsvp__tick" />
        <div
          className="rsvp__line"
          style={{ fontFamily: FONTS[settings.rsvpFont] ?? FONTS.mono }}
        >
          <span className="rsvp__word" style={{ transform: `translateX(${shift}px)` }}>
            <span>{before}</span>
            <span className="rsvp__pivot" ref={pivotRef}>
              {pivot}
            </span>
            <span>{after}</span>
          </span>
        </div>
        <div className="rsvp__tick" />
      </div>

      <div className="rsvp__foot">
        <button
          className="act act--next"
          style={{ width: 54, height: 54 }}
          onClick={() => {
            if (idx >= words.length - 1) setIdx(0);
            setPlaying((p) => (idx >= words.length - 1 ? true : !p));
          }}
          aria-label={playing ? "Pausar" : "Continuar"}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            className="range"
            type="range"
            min={0}
            max={Math.max(0, words.length - 1)}
            value={idx}
            onChange={(e) => {
              setPlaying(false);
              setIdx(Number(e.target.value));
            }}
            aria-label="Posição"
          />
          <div className="rsvp__meta">
            <span>
              {Math.min(idx + 1, words.length)}/{words.length}
            </span>
            <span>{left > 0 ? `${secs}s` : "fim"}</span>
          </div>
        </div>

        <button className="rsvp__speed" onClick={cycleSpeed} aria-label="Velocidade">
          {settings.wpm}
        </button>
      </div>
    </div>
  );
}
