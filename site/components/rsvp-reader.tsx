"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Play, Pause, X as XIcon, Maximize2, Minimize2, SlidersHorizontal } from "lucide-react";
import { usePrefs } from "@/lib/preferences";
import { AccentPicker } from "@/components/accent-picker";
import { cn } from "@/lib/utils";

/**
 * Leitura dinâmica estilo Spritz (RSVP). Abre sempre em modo foco imersivo
 * (tela cheia escura, só a palavra). A letra-foco (ORP) fica SEMPRE na mesma
 * posição horizontal: a palavra é deslocada por translateX de modo que o
 * CENTRO real da letra-foco (medido no layout) caia no reticle. Por ser
 * medido, funciona com qualquer fonte (mono/sans/serif). A troca de palavra
 * é instantânea (sem fade — evita o efeito de piscar).
 */

const WPM_PRESETS = [250, 300, 350, 400, 500, 600];
const MIN_WPM = 100;
const MAX_WPM = 900;

/** Tamanho-base da palavra (escalado por prefs.rsvpFontScale). Fixo entre
 *  palavras de propósito — variar fazia a fonte "pular" em palavras longas. */
const WORD_FONT_SIZE = "clamp(2rem, 7.5vw, 4.25rem)";

const FONT_STACK: Record<"mono" | "sans" | "serif", string> = {
  mono: "var(--font-roboto-mono), ui-monospace, SFMono-Regular, monospace",
  sans: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', serif",
};

const FONT_LABELS: { v: "mono" | "sans" | "serif"; label: string }[] = [
  { v: "mono", label: "Mono" },
  { v: "sans", label: "Sans" },
  { v: "serif", label: "Serif" },
];

/** Tokeniza o texto em palavras, preservando pontuação anexada. */
export function tokenize(text: string): string[] {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

const LETTER = /[\p{L}\p{N}]/u;

/** Posição da letra-foco (ORP), descontando pontuação no início da palavra. */
function pivotIndex(word: string): number {
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
  return Math.min(word.length - 1, start + p);
}

/** Multiplicador de duração: pausas em pontuação, travessões/parênteses, números, longas. */
function delayFactor(word: string, punctMult: number): number {
  let f = 1;
  if (/^[—–]$/.test(word)) return f + 0.9 * punctMult; // travessão isolado
  if (/[.!?…]["'”’)\]]?$/.test(word)) f += 0.9 * punctMult; // fim de frase
  else if (/[,;:][”’"')\]]?$/.test(word)) f += 0.45 * punctMult; // pausa intermediária
  else if (/[—–)\]]$/.test(word)) f += 0.5 * punctMult; // travessão / fecha parêntese
  if (/^[—–("¿¡'"]/.test(word)) f += 0.3 * punctMult; // abre parêntese / travessão / aspas
  if (word.replace(/[^\p{L}\p{N}]/gu, "").length > 8) f += 0.25; // palavra longa
  if (/\d/.test(word)) f += 0.2; // números
  return f;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  title?: string;
  startIndex?: number;
  initialWpm?: number;
  onClose?: (wordIndex: number, total: number) => void;
};

export function RsvpReader({
  open,
  onOpenChange,
  text,
  title,
  startIndex = 0,
  initialWpm,
  onClose,
}: Props) {
  const { prefs, setPref } = usePrefs();
  const words = useMemo(() => tokenize(text), [text]);
  const total = words.length;

  const [idx, setIdx] = useState(startIndex);
  const [playing, setPlaying] = useState(false);
  const [wpm, setWpm] = useState(initialWpm ?? prefs.rsvpWpm);
  const [chrome, setChrome] = useState(true); // controles visíveis
  const [fs, setFs] = useState(false);
  const [panel, setPanel] = useState<null | "speed" | "prefs">(null);
  const [shift, setShift] = useState(0); // deslocamento p/ ancorar o ORP
  const [measureTick, setMeasureTick] = useState(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const pivotRef = useRef<HTMLSpanElement>(null);

  const clamp = useCallback((i: number) => Math.max(0, Math.min(total - 1, i)), [total]);

  const setSpeed = useCallback(
    (w: number) => {
      const v = Math.max(MIN_WPM, Math.min(MAX_WPM, w));
      setWpm(v);
      setPref("rsvpWpm", v);
    },
    [setPref]
  );

  const word = words[idx] ?? "";
  const p = pivotIndex(word);
  const before = word.slice(0, p);
  const pivot = word.slice(p, p + 1);
  const after = word.slice(p + 1);

  // Reposiciona ao (re)abrir
  useEffect(() => {
    if (open) {
      setIdx(clamp(startIndex));
      setPlaying(false);
      setChrome(true);
      setPanel(null);
    }
  }, [open, startIndex, clamp]);

  // Mede o centro real da letra-foco e desloca a linha para ancorá-lo no
  // reticle. useLayoutEffect → recalcula antes do paint (sem flash).
  useLayoutEffect(() => {
    const pv = pivotRef.current;
    if (!pv) return;
    setShift(-(pv.offsetLeft + pv.offsetWidth / 2));
  }, [idx, word, p, prefs.rsvpFont, prefs.rsvpFontScale, measureTick, open]);

  // Remede ao redimensionar (a fonte usa vw) e quando as webfonts carregam.
  useEffect(() => {
    const bump = () => setMeasureTick((t) => t + 1);
    window.addEventListener("resize", bump);
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(bump).catch(() => {});
    }
    return () => window.removeEventListener("resize", bump);
  }, []);

  // Modo foco: enquanto toca, esconde os controles após inatividade; mover o
  // mouse (ou tocar) reexibe. Quando pausado/painel aberto, ficam visíveis.
  useEffect(() => {
    if (!open) return;
    const wake = () => {
      setChrome(true);
      if (hideRef.current) clearTimeout(hideRef.current);
      if (playing && prefs.rsvpFocus && !panel) {
        hideRef.current = setTimeout(() => setChrome(false), 2200);
      }
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [open, playing, prefs.rsvpFocus, panel]);

  // Loop de reprodução: cada palavra tem sua própria duração
  useEffect(() => {
    if (!open || !playing) return;
    if (idx >= total - 1) {
      const last = setTimeout(() => setPlaying(false), 60000 / wpm);
      return () => clearTimeout(last);
    }
    const base = 60000 / wpm;
    let dur = base * delayFactor(words[idx] ?? "", prefs.rsvpPunctMult);
    if (prefs.rsvpEveryN > 0 && (idx + 1) % prefs.rsvpEveryN === 0) dur += 350; // pausa periódica
    timerRef.current = setTimeout(() => setIdx((i) => i + 1), dur);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, playing, idx, wpm, words, total, prefs.rsvpPunctMult, prefs.rsvpEveryN]);

  const togglePlay = useCallback(() => {
    if (idx >= total - 1) {
      setIdx(0);
      setPlaying(true);
    } else {
      setPlaying((pp) => !pp);
    }
  }, [idx, total]);

  const step = useCallback(
    (delta: number) => {
      setPlaying(false);
      setIdx((i) => clamp(i + delta));
    },
    [clamp]
  );

  const toggleFs = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Fecha o popover (velocidade/aparência) ao clicar fora do grupo de controles
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: MouseEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) setPanel(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [panel]);

  // Atalhos de teclado (silenciosos)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          step(e.shiftKey ? -10 : -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          step(e.shiftKey ? 10 : 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSpeed(wpm + 25);
          break;
        case "ArrowDown":
          e.preventDefault();
          setSpeed(wpm - 25);
          break;
        case "f":
          toggleFs();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, togglePlay, step, setSpeed, wpm, toggleFs]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (document.fullscreenElement) document.exitFullscreen();
      onClose?.(idx, total);
    }
    onOpenChange(next);
  };

  const wordsLeft = total - idx - 1;
  const minutesLeft = wpm > 0 ? wordsLeft / wpm : 0;
  const restante =
    minutesLeft >= 1 ? `${Math.ceil(minutesLeft)} min` : wordsLeft > 0 ? "<1 min" : "fim";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          ref={contentRef}
          aria-describedby={undefined}
          className="fixed inset-0 z-50 bg-[#070708] text-zinc-100 outline-none select-none data-open:animate-in data-open:fade-in-0"
        >
          {/* Título discreto (canto superior esquerdo) — some no modo foco */}
          <div
            className={cn(
              "absolute left-5 top-5 z-20 transition-opacity duration-300",
              !chrome && "pointer-events-none opacity-0"
            )}
          >
            <DialogPrimitive.Title className="line-clamp-1 max-w-[60vw] text-xs font-medium uppercase tracking-wider text-zinc-500">
              {title ?? "Leitura dinâmica"}
            </DialogPrimitive.Title>
          </div>

          {/* Fechar + tela cheia (canto superior direito) — some no modo foco */}
          <div
            className={cn(
              "absolute right-4 top-4 z-20 flex items-center gap-1 transition-opacity duration-300",
              !chrome && "pointer-events-none opacity-0"
            )}
          >
            <button
              onClick={toggleFs}
              aria-label="Tela cheia"
              className="grid size-9 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
            >
              {fs ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <DialogPrimitive.Close asChild>
              <button
                aria-label="Fechar"
                className="grid size-9 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
              >
                <XIcon className="size-5" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Palavra centralizada — ORP ancorado no reticle (medido) */}
          <div className="flex h-full w-full items-center justify-center px-6">
            <div className="w-full">
              <div className="mx-auto h-2.5 w-px" style={{ background: "var(--brand)" }} />
              <div
                className="relative overflow-hidden py-10"
                style={{
                  fontFamily: FONT_STACK[prefs.rsvpFont] ?? FONT_STACK.mono,
                  fontSize: `calc(${WORD_FONT_SIZE} * ${prefs.rsvpFontScale})`,
                }}
              >
                <div className="relative h-[1.4em] w-full">
                  <span
                    ref={lineRef}
                    className="absolute top-0 left-1/2 whitespace-pre leading-[1.4]"
                    style={{ transform: `translateX(${shift}px)` }}
                  >
                    <span className="text-zinc-100">{before}</span>
                    <span ref={pivotRef} style={{ color: "var(--brand)" }}>
                      {pivot}
                    </span>
                    <span className="text-zinc-100">{after}</span>
                  </span>
                </div>
              </div>
              <div className="mx-auto h-2.5 w-px" style={{ background: "var(--brand)" }} />
            </div>
          </div>

          {/* Barra de controles (rodapé) — play/pausa + progresso + aparência + velocidade */}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-20 transition-all duration-300",
              !chrome && "pointer-events-none translate-y-3 opacity-0"
            )}
          >
            <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 pb-7 pt-4">
              <button
                onClick={togglePlay}
                aria-label={playing ? "Pausar" : "Iniciar"}
                className="grid size-12 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-900 transition-transform hover:scale-105 active:scale-95"
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
              </button>

              <div className="flex flex-1 flex-col gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, total - 1)}
                  value={idx}
                  onChange={(e) => {
                    setPlaying(false);
                    setIdx(clamp(parseInt(e.target.value, 10)));
                  }}
                  className="w-full accent-brand"
                  aria-label="Posição da leitura"
                />
                <div className="flex justify-between font-mono text-[11px] tabular-nums text-zinc-500">
                  <span>
                    {Math.min(idx + 1, total)} / {total}
                  </span>
                  <span>{restante}</span>
                </div>
              </div>

              {/* Grupo direito: aparência + velocidade (popovers suspensos) */}
              <div ref={controlsRef} className="flex shrink-0 items-center gap-2">
                {/* Aparência — tamanho, fonte e cor de destaque */}
                <div className="relative">
                  <button
                    onClick={() => setPanel((p2) => (p2 === "prefs" ? null : "prefs"))}
                    aria-label="Aparência"
                    className={cn(
                      "grid size-9 place-items-center rounded-lg border transition-colors",
                      panel === "prefs"
                        ? "border-white/25 bg-white/10 text-zinc-100"
                        : "border-white/15 text-zinc-300 hover:border-white/25 hover:text-zinc-100"
                    )}
                  >
                    <SlidersHorizontal className="size-4" />
                  </button>
                  {panel === "prefs" && (
                    <div className="absolute bottom-full right-0 mb-3 w-64 space-y-4 rounded-2xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
                      <div>
                        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                          <span>Tamanho</span>
                          <span className="tabular-nums">
                            {Math.round(prefs.rsvpFontScale * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.7}
                          max={1.7}
                          step={0.1}
                          value={prefs.rsvpFontScale}
                          onChange={(e) => setPref("rsvpFontScale", Number(e.target.value))}
                          className="w-full accent-brand"
                          aria-label="Tamanho da fonte"
                        />
                      </div>
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                          Fonte
                        </div>
                        <div className="flex gap-1.5">
                          {FONT_LABELS.map((f) => (
                            <button
                              key={f.v}
                              onClick={() => setPref("rsvpFont", f.v)}
                              style={{ fontFamily: FONT_STACK[f.v] }}
                              className={cn(
                                "flex-1 rounded-lg border px-2 py-1.5 text-sm font-semibold transition-colors",
                                prefs.rsvpFont === f.v
                                  ? "border-brand bg-brand text-brand-foreground"
                                  : "border-white/15 text-zinc-300 hover:border-white/25 hover:text-zinc-100"
                              )}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                          Destaque
                        </div>
                        <AccentPicker dark />
                      </div>
                    </div>
                  )}
                </div>

                {/* Velocidade — popover suspenso (estilo player TRIH) */}
                <div className="relative">
                  <button
                    onClick={() => setPanel((p2) => (p2 === "speed" ? null : "speed"))}
                    aria-label="Velocidade de leitura"
                    className={cn(
                      "h-9 min-w-[64px] rounded-lg border px-3 font-mono text-sm font-semibold tabular-nums transition-colors",
                      panel === "speed"
                        ? "border-white/25 bg-white/10 text-zinc-100"
                        : "border-white/15 text-zinc-300 hover:border-white/25 hover:text-zinc-100"
                    )}
                  >
                    {wpm}
                  </button>
                  {panel === "speed" && (
                    <div className="absolute bottom-full right-0 mb-3 w-60 rounded-2xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
                      <div className="mb-3 text-center">
                        <span className="text-2xl font-bold text-zinc-100">{wpm}</span>
                        <span className="ml-1 text-sm text-zinc-400">ppm</span>
                      </div>
                      <input
                        type="range"
                        min={150}
                        max={800}
                        step={10}
                        value={wpm}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        className="w-full accent-brand"
                        aria-label="Velocidade (palavras por minuto)"
                      />
                      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                        {WPM_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setSpeed(preset)}
                            className={cn(
                              "rounded-md px-2.5 py-1 font-mono text-xs font-semibold tabular-nums transition-colors",
                              wpm === preset
                                ? "bg-brand text-brand-foreground"
                                : "border border-white/10 text-zinc-300 hover:border-white/25 hover:text-zinc-100"
                            )}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
