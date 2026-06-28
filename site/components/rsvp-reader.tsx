"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Gauge,
  XIcon,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { usePrefs } from "@/lib/preferences";
import { cn } from "@/lib/utils";

/**
 * Leitura dinâmica estilo Spritz (RSVP). A letra de foco (ORP) fica SEMPRE na
 * mesma posição horizontal (ancorada por posicionamento absoluto + fonte
 * monospace), então palavras longas não desalinham o ponteiro vermelho.
 */

const WPM_PRESETS = [250, 300, 350, 400, 450, 500, 600];
const MIN_WPM = 100;
const MAX_WPM = 900;

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

/** Tamanho da palavra: reduz para palavras muito longas evitando estourar a tela. */
function wordFontSize(word: string): string {
  const n = word.length;
  if (n <= 12) return "clamp(2rem, 8vw, 3rem)";
  if (n <= 18) return "clamp(1.55rem, 6vw, 2.4rem)";
  return "clamp(1.15rem, 4.6vw, 1.9rem)";
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
  const contentRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clamp = useCallback((i: number) => Math.max(0, Math.min(total - 1, i)), [total]);

  const setSpeed = useCallback(
    (w: number) => {
      const v = Math.max(MIN_WPM, Math.min(MAX_WPM, w));
      setWpm(v);
      setPref("rsvpWpm", v);
    },
    [setPref]
  );

  // Reposiciona ao (re)abrir
  useEffect(() => {
    if (open) {
      setIdx(clamp(startIndex));
      setPlaying(false);
      setChrome(true);
    }
  }, [open, startIndex, clamp]);

  // Modo foco: enquanto toca, esconde os controles após inatividade
  const immersive = playing && prefs.rsvpFocus && !chrome;
  useEffect(() => {
    if (!open) return;
    const wake = () => {
      setChrome(true);
      if (hideRef.current) clearTimeout(hideRef.current);
      if (playing && prefs.rsvpFocus) {
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
  }, [open, playing, prefs.rsvpFocus]);

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
      setPlaying((p) => !p);
    }
  }, [idx, total]);

  const step = useCallback(
    (delta: number) => {
      setPlaying(false);
      setIdx((i) => clamp(i + delta));
    },
    [clamp]
  );

  const restart = useCallback(() => {
    setPlaying(false);
    setIdx(0);
  }, []);

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

  // Atalhos de teclado
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

  const word = words[idx] ?? "";
  const p = pivotIndex(word);
  const before = word.slice(0, p);
  const pivot = word.slice(p, p + 1);
  const after = word.slice(p + 1);

  const pct = total > 1 ? (idx / (total - 1)) * 100 : 0;
  const wordsLeft = total - idx - 1;
  const minutesLeft = wpm > 0 ? wordsLeft / wpm : 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          ref={contentRef}
          aria-describedby={undefined}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none transition-[width,background] duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            immersive || fs
              ? "h-full w-full rounded-none bg-black p-0"
              : "w-[calc(100%-1.5rem)] max-w-xl rounded-2xl bg-card p-5 shadow-2xl ring-1 ring-foreground/10"
          )}
        >
          {/* Cabeçalho — some no modo foco */}
          <div className={cn("flex items-center justify-between gap-2", immersive && "hidden")}>
            <DialogPrimitive.Title className="line-clamp-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title ?? "Leitura dinâmica"}
            </DialogPrimitive.Title>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={toggleFs} aria-label="Tela cheia">
                {fs ? <Minimize2 /> : <Maximize2 />}
              </Button>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Fechar">
                  <XIcon />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Janela RSVP — pivot ancorado num X fixo (alinhado ao reticle) */}
          <div
            className={cn(
              "relative select-none font-mono",
              immersive || fs ? "flex h-full items-center justify-center" : "my-5"
            )}
          >
            <div className="w-full">
              <div className="mx-auto h-2 w-px bg-red-500/70" />
              <div className="relative border-y border-border/40 py-8" style={{ fontSize: wordFontSize(word) }}>
                <div className="relative mx-auto h-[1.25em]">
                  <span
                    key={idx}
                    className={cn(prefs.rsvpFade && "animate-in fade-in-0 duration-75")}
                  >
                    <span
                      className="absolute top-0 whitespace-pre text-right text-foreground"
                      style={{ right: "calc(50% + 0.5ch)" }}
                    >
                      {before}
                    </span>
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-pre text-red-500">
                      {pivot}
                    </span>
                    <span
                      className="absolute top-0 whitespace-pre text-foreground"
                      style={{ left: "calc(50% + 0.5ch)" }}
                    >
                      {after}
                    </span>
                  </span>
                </div>
              </div>
              <div className="mx-auto h-2 w-px bg-red-500/70" />
            </div>
          </div>

          {/* Tudo abaixo some no modo foco */}
          <div className={cn(immersive && "hidden")}>
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
            <div className="mt-1 flex justify-between font-mono text-[11px] tabular-nums text-muted-foreground">
              <span>
                {Math.min(idx + 1, total)} / {total}
              </span>
              <span>{pct.toFixed(0)}%</span>
              <span>
                {minutesLeft >= 1
                  ? `${Math.ceil(minutesLeft)} min restantes`
                  : wordsLeft > 0
                  ? "menos de 1 min"
                  : "fim"}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="ghost" size="icon" onClick={restart} aria-label="Reiniciar">
                <RotateCcw className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Palavra anterior">
                <ChevronLeft className="size-5" />
              </Button>
              <Button
                size="icon"
                onClick={togglePlay}
                className="size-12 rounded-full"
                aria-label={playing ? "Pausar" : "Iniciar"}
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Próxima palavra">
                <ChevronRight className="size-5" />
              </Button>
              <span className="inline-block size-8" />
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Gauge className="size-3.5 text-muted-foreground" />
                <Button variant="outline" size="icon-sm" onClick={() => setSpeed(wpm - 25)} aria-label="Diminuir velocidade">
                  <span className="text-base leading-none">−</span>
                </Button>
                <span className="w-24 text-center font-mono text-sm tabular-nums">{wpm} wpm</span>
                <Button variant="outline" size="icon-sm" onClick={() => setSpeed(wpm + 25)} aria-label="Aumentar velocidade">
                  <span className="text-base leading-none">+</span>
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {WPM_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    variant={wpm === preset ? "default" : "outline"}
                    size="xs"
                    onClick={() => setSpeed(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>

            <p className="mt-4 hidden text-center text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:block">
              espaço · play/pausa · ← → palavra · ↑ ↓ velocidade · f tela cheia
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
