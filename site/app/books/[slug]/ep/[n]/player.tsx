"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, FastForward, Check, Gauge, Zap } from "lucide-react";
import { saveProgress, markCompleted } from "@/lib/actions";
import { RsvpReader } from "@/components/rsvp-reader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AlignmentWord = { word: string; start: number; end: number };

type Props = {
  episodeId: string;
  audioUrl: string | null;
  alignmentUrl: string | null;
  scriptText: string;
  initialPositionSec: number;
  initialCompleted: boolean;
};

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

const PLAYBACK_RATES = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];

export function EpisodePlayer({
  episodeId,
  audioUrl,
  alignmentUrl,
  scriptText,
  initialPositionSec,
  initialCompleted,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(initialPositionSec);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [completed, setCompleted] = useState(initialCompleted);
  const [alignment, setAlignment] = useState<AlignmentWord[] | null>(null);
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const lastSavedRef = useRef(initialPositionSec);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);

  // Load alignment JSON if present
  useEffect(() => {
    if (!alignmentUrl) return;
    fetch(alignmentUrl)
      .then((r) => r.json())
      .then((data) => {
        const words: AlignmentWord[] = Array.isArray(data) ? data : data.words ?? [];
        setAlignment(words);
      })
      .catch(() => {});
  }, [alignmentUrl]);

  // Restore initial position
  useEffect(() => {
    const a = audioRef.current;
    if (a && initialPositionSec > 0 && initialPositionSec < (a.duration || Infinity)) {
      a.currentTime = initialPositionSec;
    }
  }, [initialPositionSec]);

  // Persist progress every ~5s and on pause
  useEffect(() => {
    if (!audioUrl) return;
    const id = setInterval(() => {
      if (playing && Math.abs(time - lastSavedRef.current) > 5) {
        lastSavedRef.current = time;
        saveProgress({ episodeId, positionSec: time }).catch(() => {});
      }
    }, 3000);
    return () => clearInterval(id);
  }, [audioUrl, episodeId, playing, time]);

  // Karaoke: binary-search word at time
  useEffect(() => {
    if (!alignment || alignment.length === 0) return;
    let lo = 0;
    let hi = alignment.length - 1;
    let idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const w = alignment[mid];
      if (time < w.start) hi = mid - 1;
      else if (time > w.end) lo = mid + 1;
      else {
        idx = mid;
        break;
      }
    }
    if (idx === -1) {
      // Use last word that ended before `time`
      idx = Math.max(-1, lo - 1);
    }
    if (idx !== activeWordIdx) {
      setActiveWordIdx(idx);
      // Scroll só quando a palavra ativa sai do viewport, evita scroll nervoso.
      const el = wordRefs.current[idx];
      if (el) {
        const rect = el.getBoundingClientRect();
        const margin = 80;
        const inView = rect.top >= margin && rect.bottom <= window.innerHeight - margin;
        if (!inView) el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [time, alignment, activeWordIdx]);

  const onTogglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  };

  const onSeekBar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const t = parseFloat(e.target.value);
    a.currentTime = t;
    setTime(t);
  };

  const cycleRate = () => {
    const idx = PLAYBACK_RATES.indexOf(rate);
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const onMarkCompleted = async () => {
    const next = !completed;
    setCompleted(next);
    try {
      await markCompleted(episodeId, next);
      toast.success(next ? "Episódio marcado como concluído" : "Marcação removida");
    } catch {
      setCompleted(!next);
      toast.error("Falha ao salvar progresso");
    }
  };

  const seekBy = (delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + delta));
  };

  const seekToWord = (idx: number) => {
    if (!alignment || !audioRef.current) return;
    const w = alignment[idx];
    audioRef.current.currentTime = w.start;
    setTime(w.start);
    if (!playing) audioRef.current.play();
  };

  useEffect(() => {
    if (!audioUrl) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          onTogglePlay();
          break;
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          seekBy(-10);
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          seekBy(10);
          break;
        case "ArrowUp": {
          e.preventDefault();
          const idx = PLAYBACK_RATES.indexOf(rate);
          const next = PLAYBACK_RATES[Math.min(PLAYBACK_RATES.length - 1, idx + 1)];
          setRate(next);
          if (audioRef.current) audioRef.current.playbackRate = next;
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const idx = PLAYBACK_RATES.indexOf(rate);
          const next = PLAYBACK_RATES[Math.max(0, idx - 1)];
          setRate(next);
          if (audioRef.current) audioRef.current.playbackRate = next;
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [audioUrl, rate]);

  // Calcula índices de quebra de parágrafo no array `alignment`, alinhando
  // por contagem de palavras com o `scriptText` original. WhisperX devolve
  // tokens sem newlines — re-injetamos a estrutura aqui.
  const paragraphBreaks = useMemo(() => {
    if (!alignment || alignment.length === 0) return null;
    const paragraphs = scriptText.split(/\n\s*\n/).filter((p) => p.trim());
    const breaks: number[] = []; // índices em `alignment` que iniciam um parágrafo
    let cursor = 0;
    for (const p of paragraphs) {
      const wc = p.trim().split(/\s+/).filter(Boolean).length;
      breaks.push(cursor);
      cursor += wc;
    }
    // se sobrarem ou faltarem palavras (WhisperX dropou alguma), trunca/ignora
    return breaks.filter((b) => b < alignment.length);
  }, [alignment, scriptText]);

  // Para highlight de sentença ativa, mapeia cada palavra → índice de sentença.
  const sentenceOfWord = useMemo(() => {
    if (!alignment) return null;
    const map = new Int32Array(alignment.length);
    let s = 0;
    for (let i = 0; i < alignment.length; i++) {
      map[i] = s;
      if (/[.!?…]$/.test(alignment[i].word)) s++;
    }
    return map;
  }, [alignment]);

  const activeSentence = activeWordIdx >= 0 && sentenceOfWord ? sentenceOfWord[activeWordIdx] : -1;

  // Render script: if alignment available, use words grouped by paragraph; otherwise plain paragraphs
  const renderedScript = useMemo(() => {
    if (alignment && alignment.length > 0 && paragraphBreaks && sentenceOfWord) {
      const paras: Array<Array<number>> = [];
      for (let i = 0; i < paragraphBreaks.length; i++) {
        const start = paragraphBreaks[i];
        const end = i + 1 < paragraphBreaks.length ? paragraphBreaks[i + 1] : alignment.length;
        const idxs: number[] = [];
        for (let j = start; j < end; j++) idxs.push(j);
        paras.push(idxs);
      }
      return (
        <div className="space-y-4 text-base leading-8">
          {paras.map((idxs, pIdx) => (
            <p key={pIdx} className="text-foreground/90">
              {idxs.map((i) => {
                const isActive = i === activeWordIdx;
                const isPast = i < activeWordIdx;
                const inActiveSentence = activeSentence >= 0 && sentenceOfWord[i] === activeSentence;
                return (
                  <span
                    key={i}
                    ref={(el) => { wordRefs.current[i] = el; }}
                    onClick={() => seekToWord(i)}
                    className={cn(
                      "cursor-pointer rounded px-0.5 transition-colors",
                      isActive && "bg-primary/30 text-foreground",
                      !isActive && inActiveSentence && "bg-primary/5 text-foreground",
                      !isActive && !inActiveSentence && isPast && "text-muted-foreground/70",
                      !isActive && !inActiveSentence && !isPast && "text-foreground/80 hover:bg-muted/40"
                    )}
                  >
                    {alignment[i].word}{" "}
                  </span>
                );
              })}
            </p>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-4 text-base leading-7 text-foreground/90">
        {scriptText
          .split(/\n\s*\n/)
          .filter((p) => p.trim())
          .map((p, i) => (
            <p key={i}>{p.trim()}</p>
          ))}
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alignment, activeWordIdx, activeSentence, paragraphBreaks, sentenceOfWord, scriptText]);

  return (
    <div className="space-y-6">
      {audioUrl ? (
        <Card className="overflow-hidden">
          <CardContent className="space-y-4 p-4">
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="metadata"
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => {
                setPlaying(false);
                saveProgress({ episodeId, positionSec: audioRef.current?.currentTime ?? 0 }).catch(
                  () => {}
                );
              }}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onEnded={() => {
                setPlaying(false);
                setCompleted(true);
                markCompleted(episodeId, true).catch(() => {});
              }}
            />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={time}
                  onChange={onSeekBar}
                  className="w-full accent-primary"
                  aria-label="Posição do áudio"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button size="icon" onClick={onTogglePlay} className="size-11 rounded-full">
                  {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => seekBy(-10)}
                  aria-label="Voltar 10 segundos"
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => seekBy(10)}
                  aria-label="Avançar 10 segundos"
                >
                  <FastForward className="size-4" />
                </Button>
                <div className="flex flex-1 justify-center font-mono text-xs tabular-nums text-muted-foreground">
                  <span>{fmt(time)}</span>
                  <span className="mx-1">/</span>
                  <span>{fmt(duration)}</span>
                </div>
                <Button variant="outline" size="sm" onClick={cycleRate} className="gap-1.5">
                  <Gauge className="size-3.5" />
                  {rate}x
                </Button>
                <Button
                  variant={completed ? "default" : "outline"}
                  size="sm"
                  onClick={onMarkCompleted}
                  className="gap-1.5"
                >
                  <Check className="size-3.5" />
                  <span className="hidden sm:inline">
                    {completed ? "Concluído" : "Marcar"}
                  </span>
                </Button>
              </div>
              <p className="hidden text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:block">
                espaço · play/pausa  ·  ← →  ±10s  ·  ↑ ↓ velocidade
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Áudio ainda não foi gerado. Quando rodar OmniVoice e colocar em{" "}
            <code className="font-mono text-xs">content/{`<slug>`}/audio/</code>, rode{" "}
            <code className="font-mono text-xs">pnpm ingest</code> e o player aparece aqui.
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Script
        </h2>
        <Button variant="outline" size="sm" onClick={() => setRsvpOpen(true)} className="gap-1.5">
          <Zap className="size-3.5" />
          Leitura dinâmica
        </Button>
      </div>

      <article className="prose prose-invert max-w-none">{renderedScript}</article>

      <RsvpReader
        open={rsvpOpen}
        onOpenChange={setRsvpOpen}
        text={scriptText}
        title="Leitura dinâmica do script"
      />
    </div>
  );
}
