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
} from "lucide-react";

/**
 * Leitura dinâmica estilo Spritz (RSVP — Rapid Serial Visual Presentation).
 * Mostra uma palavra por vez com a letra de foco (ORP) destacada em vermelho,
 * de forma que o olho não precisa se mover. Controles de play/pausa, velocidade
 * em palavras por minuto (WPM) e navegação palavra a palavra.
 */

const WPM_PRESETS = [200, 250, 300, 350, 400, 450, 500, 600];
const MIN_WPM = 100;
const MAX_WPM = 900;

/** Tokeniza o texto em palavras, preservando pontuação anexada. */
export function tokenize(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Ponto ótimo de reconhecimento (ORP / pivot): a letra que o cérebro usa para
 * ancorar a palavra. Posição aproximada usada pelo Spritz, baseada no tamanho.
 */
function pivotIndex(word: string): number {
  const n = word.length;
  if (n <= 1) return 0;
  if (n <= 5) return 1;
  if (n <= 9) return 2;
  if (n <= 13) return 3;
  return 4;
}

/** Multiplicador de duração para dar mais tempo em pontuação e palavras longas. */
function delayFactor(word: string): number {
  let f = 1;
  if (/[.!?…]["'”’)\]]?$/.test(word)) f += 1.2; // fim de frase
  else if (/[,;:—)\]"'”’]$/.test(word)) f += 0.6; // pausa intermediária
  if (word.length > 8) f += 0.25; // palavras longas
  if (/\d/.test(word)) f += 0.2; // números
  return f;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  title?: string;
  /** Índice inicial da palavra (para retomar). */
  startIndex?: number;
  /** WPM inicial. */
  initialWpm?: number;
  /** Chamado ao fechar, com a palavra atual e o total. */
  onClose?: (wordIndex: number, total: number) => void;
};

export function RsvpReader({
  open,
  onOpenChange,
  text,
  title,
  startIndex = 0,
  initialWpm = 350,
  onClose,
}: Props) {
  const words = useMemo(() => tokenize(text), [text]);
  const total = words.length;

  const [idx, setIdx] = useState(startIndex);
  const [playing, setPlaying] = useState(false);
  const [wpm, setWpm] = useState(initialWpm);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(total - 1, i)),
    [total]
  );

  // Reposiciona ao (re)abrir
  useEffect(() => {
    if (open) {
      setIdx(clamp(startIndex));
      setPlaying(false);
    }
  }, [open, startIndex, clamp]);

  // Loop de reprodução: cada palavra tem sua própria duração
  useEffect(() => {
    if (!open || !playing) return;
    if (idx >= total - 1) {
      // chegou ao fim
      const last = setTimeout(() => setPlaying(false), 60000 / wpm);
      return () => clearTimeout(last);
    }
    const base = 60000 / wpm;
    const dur = base * delayFactor(words[idx] ?? "");
    timerRef.current = setTimeout(() => setIdx((i) => i + 1), dur);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, playing, idx, wpm, words, total]);

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

  const bumpWpm = useCallback((delta: number) => {
    setWpm((w) => Math.max(MIN_WPM, Math.min(MAX_WPM, w + delta)));
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
          bumpWpm(25);
          break;
        case "ArrowDown":
          e.preventDefault();
          bumpWpm(-25);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, togglePlay, step, bumpWpm]);

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose?.(idx, total);
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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-5 shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0"
        >
          <div className="flex items-center justify-between gap-2">
            <DialogPrimitive.Title className="line-clamp-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title ?? "Leitura dinâmica"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Fechar">
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>

          {/* Janela de uma palavra por vez com a letra-foco (ORP) em vermelho */}
          <div className="relative my-5 select-none">
            <div className="border-y border-border/60">
              {/* tique central superior */}
              <div className="mx-auto h-2 w-px bg-red-500/70" />
              <div className="grid grid-cols-[1fr_auto_1fr] items-baseline px-4 py-6 font-mono text-4xl tracking-tight sm:text-5xl">
                <span className="text-right text-foreground">{before}</span>
                <span className="text-red-500">{pivot}</span>
                <span className="text-left text-foreground">{after}</span>
              </div>
              {/* tique central inferior */}
              <div className="mx-auto h-2 w-px bg-red-500/70" />
            </div>
          </div>

          {/* Barra de progresso */}
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={idx}
            onChange={(e) => {
              setPlaying(false);
              setIdx(clamp(parseInt(e.target.value, 10)));
            }}
            className="w-full accent-red-500"
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

          {/* Controles de transporte */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={restart}
              aria-label="Reiniciar"
            >
              <RotateCcw className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => step(-1)}
              aria-label="Palavra anterior"
            >
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => step(1)}
              aria-label="Próxima palavra"
            >
              <ChevronRight className="size-5" />
            </Button>
            {/* espaçador simétrico ao botão reiniciar */}
            <span className="inline-block size-8" />
          </div>

          {/* Velocidade (WPM) */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Gauge className="size-3.5 text-muted-foreground" />
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => bumpWpm(-25)}
                aria-label="Diminuir velocidade"
              >
                <span className="text-base leading-none">−</span>
              </Button>
              <span className="w-24 text-center font-mono text-sm tabular-nums">
                {wpm} wpm
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => bumpWpm(25)}
                aria-label="Aumentar velocidade"
              >
                <span className="text-base leading-none">+</span>
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {WPM_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  variant={wpm === preset ? "default" : "outline"}
                  size="xs"
                  onClick={() => setWpm(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>

          <p className="mt-4 hidden text-center text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:block">
            espaço · play/pausa · ← → palavra (shift = 10) · ↑ ↓ velocidade
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
