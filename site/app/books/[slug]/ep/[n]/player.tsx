"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Rewind,
  FastForward,
  Check,
  Zap,
  ChevronLeft,
  List,
  X,
  Repeat,
  ArrowRight,
} from "lucide-react";
import { saveProgress, markCompleted } from "@/lib/actions";
import { RsvpReader } from "@/components/rsvp-reader";
import { SettingsButton } from "@/components/settings-panel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AlignmentWord = { word: string; start: number; end: number };

type Props = {
  episodeId: string;
  bookSlug: string;
  bookTitle: string;
  episodeNumber: number;
  episodeTitle: string;
  audioUrl: string | null;
  alignmentUrl: string | null;
  scriptText: string;
  initialPositionSec: number;
  initialCompleted: boolean;
  prevN: number | null;
  nextN: number | null;
};

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

function countWords(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Primeiras palavras de um parágrafo, como rótulo de marcador. */
function markerLabel(p: string, max = 8) {
  const words = p.trim().replace(/\s+/g, " ").split(" ");
  const head = words.slice(0, max).join(" ");
  return head + (words.length > max ? "…" : "");
}

export function EpisodePlayer({
  episodeId,
  bookSlug,
  bookTitle,
  episodeNumber,
  episodeTitle,
  audioUrl,
  alignmentUrl,
  scriptText,
  initialPositionSec,
  initialCompleted,
  prevN,
  nextN,
}: Props) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const paraRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lastSavedRef = useRef(initialPositionSec);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overChromeRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(initialPositionSec);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [completed, setCompleted] = useState(initialCompleted);
  const [alignment, setAlignment] = useState<AlignmentWord[] | null>(null);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false); // sidebar no mobile
  const [speedOpen, setSpeedOpen] = useState(false);
  const [chrome, setChrome] = useState(true); // topbar+player visíveis
  const [autoFollow, setAutoFollow] = useState(true);
  const [showBack, setShowBack] = useState(false);
  const [ended, setEnded] = useState(false);

  // Parágrafos do script + contagens (a base do índice e dos marcadores).
  const paragraphs = useMemo(
    () => scriptText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    [scriptText]
  );
  const { cumWords, totalWords } = useMemo(() => {
    const cum: number[] = [];
    let acc = 0;
    for (const p of paragraphs) {
      cum.push(acc);
      acc += countWords(p);
    }
    return { cumWords: cum, totalWords: acc || 1 };
  }, [paragraphs]);

  // Carrega alignment (karaokê palavra-a-palavra) se existir.
  useEffect(() => {
    if (!alignmentUrl) return;
    fetch(alignmentUrl)
      .then((r) => r.json())
      .then((data) => setAlignment(Array.isArray(data) ? data : data.words ?? []))
      .catch(() => {});
  }, [alignmentUrl]);

  // Tempo (em segundos) de início de cada parágrafo: exato via alignment ou
  // estimado proporcionalmente quando não há (ritmo de fala ~constante).
  const paraTimes = useMemo(() => {
    return paragraphs.map((_, i) => {
      if (alignment && alignment.length) {
        const w = alignment[Math.min(cumWords[i], alignment.length - 1)];
        return w ? w.start : 0;
      }
      return duration ? (cumWords[i] / totalWords) * duration : 0;
    });
  }, [paragraphs, alignment, cumWords, totalWords, duration]);

  // Parágrafo ativo segundo o tempo atual.
  const activePara = useMemo(() => {
    if (!duration && !alignment) return -1;
    let est = 0;
    if (alignment && alignment.length) {
      // índice de palavra atual via busca binária
      let lo = 0,
        hi = alignment.length - 1,
        wi = 0;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (alignment[m].start <= time) {
          wi = m;
          lo = m + 1;
        } else hi = m - 1;
      }
      est = wi;
    } else {
      est = duration ? (time / duration) * totalWords : 0;
    }
    let idx = 0;
    for (let i = 0; i < cumWords.length; i++) {
      if (cumWords[i] <= est) idx = i;
      else break;
    }
    return idx;
  }, [time, duration, alignment, cumWords, totalWords]);

  // ── controles de mídia ───────────────────────────────────────────────────
  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, t);
    setTime(a.currentTime);
    setAutoFollow(true);
    setShowBack(false);
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  }, []);

  const seekBy = useCallback((d: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + d));
    setTime(a.currentTime);
  }, []);

  const changeRate = useCallback((r: number) => {
    setRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  // Persiste progresso a cada ~5s tocando.
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

  // Restaura posição salva.
  useEffect(() => {
    const a = audioRef.current;
    if (a && initialPositionSec > 5) {
      const onMeta = () => {
        if (initialPositionSec < (a.duration || Infinity) - 8) a.currentTime = initialPositionSec;
      };
      a.addEventListener("loadedmetadata", onMeta, { once: true });
      return () => a.removeEventListener("loadedmetadata", onMeta);
    }
  }, [initialPositionSec]);

  // Auto-scroll suave para o parágrafo ativo.
  useEffect(() => {
    if (!autoFollow || activePara < 0) return;
    const el = paraRefs.current[activePara];
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    const target = el.offsetTop - sc.clientHeight * 0.4 + el.clientHeight / 2;
    sc.scrollTo({ top: target, behavior: "smooth" });
  }, [activePara, autoFollow]);

  const onMarkCompleted = async () => {
    const next = !completed;
    setCompleted(next);
    try {
      await markCompleted(episodeId, next);
      toast.success(next ? "Episódio concluído" : "Marcação removida");
    } catch {
      setCompleted(!next);
      toast.error("Falha ao salvar");
    }
  };

  // ── track (barra de progresso com fill + knob) ─────────────────────────────
  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;
  const seekAtX = useCallback(
    (clientX: number) => {
      const r = trackRef.current?.getBoundingClientRect();
      if (!r || !duration) return;
      const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      seek(p * duration);
    },
    [duration, seek]
  );
  const draggingRef = useRef(false);

  // ── modo imersivo (esconde topbar+player ao tocar) ─────────────────────────
  useEffect(() => {
    const wake = () => {
      setChrome(true);
      if (hideRef.current) clearTimeout(hideRef.current);
      if (playing && !speedOpen && !navOpen && !overChromeRef.current) {
        hideRef.current = setTimeout(() => setChrome(false), 2600);
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
  }, [playing, speedOpen, navOpen]);

  // Fecha popover de velocidade ao clicar fora.
  const speedWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!speedOpen) return;
    const onDown = (e: MouseEvent) => {
      if (speedWrapRef.current && !speedWrapRef.current.contains(e.target as Node))
        setSpeedOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [speedOpen]);

  // Atalhos.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (rsvpOpen) return; // o RSVP tem os seus
      if (e.code === "Space" || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight" || e.key === "l") seekBy(e.shiftKey ? 30 : 10);
      else if (e.key === "ArrowLeft" || e.key === "j") seekBy(e.shiftKey ? -30 : -10);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, rsvpOpen]);

  const onScrollerWheel = () => {
    if (autoFollow) {
      setAutoFollow(false);
      setShowBack(true);
    }
  };

  const goNext = () => {
    if (nextN !== null) router.push(`/books/${bookSlug}/ep/${nextN}`);
    else router.push(`/books/${bookSlug}`);
  };

  // ── render do script ───────────────────────────────────────────────────────
  const readingStyle = {
    maxWidth: "var(--reading-width, 680px)",
    fontSize: "calc(1.05rem * var(--reading-scale, 1))",
  } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            setTime(a.currentTime);
            // sincroniza a duração de forma robusta (o loadedmetadata pode ter
            // corrido antes do React anexar o handler)
            setDuration((d) => (a.duration && Math.abs(a.duration - d) > 0.5 ? a.duration : d));
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            setChrome(true);
            saveProgress({ episodeId, positionSec: audioRef.current?.currentTime ?? 0 }).catch(
              () => {}
            );
          }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => {
            setPlaying(false);
            if (!completed) {
              setCompleted(true);
              markCompleted(episodeId, true).catch(() => {});
            }
            setEnded(true);
          }}
        />
      )}

      {/* área de leitura (ocupa tudo; topbar/sidebar/player são overlays) */}
      <div
        ref={scrollerRef}
        onWheel={onScrollerWheel}
        onTouchMove={onScrollerWheel}
        className="absolute inset-0 overflow-y-auto pt-14 pb-28 md:pl-[280px]"
      >
        <article
          className="reading-prose mx-auto px-6 py-[8vh] md:py-[10vh]"
          style={readingStyle}
        >
          {paragraphs.map((p, i) => {
            const isActive = i === activePara;
            const isPast = i < activePara;
            return (
              <p
                key={i}
                ref={(el) => {
                  paraRefs.current[i] = el;
                }}
                onClick={() => {
                  if (duration) seek(paraTimes[i] + 0.05);
                  if (audioRef.current?.paused) audioRef.current.play();
                }}
                className={cn(
                  "-mx-3 mb-5 cursor-pointer rounded-xl px-3 py-1.5 leading-[1.7] transition-colors",
                  isActive
                    ? "bg-brand/15 text-foreground"
                    : isPast
                    ? "text-muted-foreground/70 hover:text-foreground"
                    : "text-foreground/85 hover:text-foreground"
                )}
              >
                {p}
              </p>
            );
          })}
        </article>
      </div>

      {/* topbar */}
      <header
        onMouseEnter={() => (overChromeRef.current = true)}
        onMouseLeave={() => (overChromeRef.current = false)}
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 px-3 backdrop-blur transition-transform duration-300",
          !chrome && "-translate-y-full"
        )}
      >
        <button
          onClick={() => setNavOpen((o) => !o)}
          aria-label="Marcadores"
          className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
        >
          <List className="size-4" />
        </button>
        <Link
          href={`/books/${bookSlug}`}
          aria-label="Voltar ao livro"
          className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight">{episodeTitle}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {bookTitle} · Ep {episodeNumber.toString().padStart(2, "0")}
          </div>
        </div>
        <div className="flex-1" />
        <SettingsButton />
      </header>

      {/* sidebar de marcadores (desktop fixo / mobile drawer) */}
      <aside
        className={cn(
          "absolute bottom-24 top-14 left-0 z-30 w-[280px] overflow-y-auto border-r border-border/60 bg-background/95 px-2 py-3 backdrop-blur transition-transform duration-200 md:bottom-28 md:z-10 md:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <h3 className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Marcadores{!alignment && " (aprox.)"}
        </h3>
        <div className="space-y-0.5">
          {paragraphs.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                if (duration) seek(paraTimes[i] + 0.05);
                if (audioRef.current?.paused) audioRef.current.play();
                setNavOpen(false);
              }}
              className={cn(
                "flex w-full items-baseline gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                i === activePara ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "shrink-0 font-mono text-[11px] tabular-nums",
                  i === activePara ? "text-brand" : "text-muted-foreground/60"
                )}
              >
                {fmt(paraTimes[i])}
              </span>
              <span className="line-clamp-2 text-[12.5px] leading-snug">{markerLabel(p)}</span>
            </button>
          ))}
        </div>
      </aside>
      {/* scrim do drawer (mobile) */}
      <div
        onClick={() => setNavOpen(false)}
        className={cn(
          "absolute inset-0 z-20 bg-black/50 transition-opacity md:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* botão voltar ao trecho atual */}
      {showBack && (
        <button
          onClick={() => {
            setAutoFollow(true);
            setShowBack(false);
          }}
          className="absolute bottom-32 left-1/2 z-30 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg md:left-[calc(50%+140px)]"
        >
          ↓ Voltar ao trecho atual
        </button>
      )}

      {/* player (rodapé) */}
      <footer
        onMouseEnter={() => (overChromeRef.current = true)}
        onMouseLeave={() => (overChromeRef.current = false)}
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur transition-transform duration-300",
          !chrome && "translate-y-full"
        )}
      >
        {/* track */}
        <div className="flex items-center gap-3 px-5 pt-3">
          <span className="w-11 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {fmt(time)}
          </span>
          <div
            ref={trackRef}
            onPointerDown={(e) => {
              draggingRef.current = true;
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              seekAtX(e.clientX);
            }}
            onPointerMove={(e) => draggingRef.current && seekAtX(e.clientX)}
            onPointerUp={() => (draggingRef.current = false)}
            className="group relative h-1.5 flex-1 cursor-pointer rounded-full bg-secondary"
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-brand"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
              style={{ left: `${pct}%` }}
            />
          </div>
          <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
            -{fmt(Math.max(0, duration - time))}
          </span>
        </div>

        {/* controles */}
        <div className="flex items-center gap-3 px-5 pb-5 pt-2">
          {/* meta (oculto no mobile) */}
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="truncate text-[13px] font-semibold">{episodeTitle}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              Ep {episodeNumber.toString().padStart(2, "0")}
            </div>
          </div>

          {/* centro */}
          <div className="flex flex-1 items-center justify-center gap-3 md:flex-none">
            <button
              onClick={() => seekBy(-10)}
              aria-label="Voltar 10s"
              className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Rewind className="size-5" />
            </button>
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pausar" : "Tocar"}
              className="grid size-13 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95"
              style={{ width: 54, height: 54 }}
            >
              {playing ? <Pause className="size-6" /> : <Play className="size-6 translate-x-px" />}
            </button>
            <button
              onClick={() => seekBy(10)}
              aria-label="Avançar 10s"
              className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <FastForward className="size-5" />
            </button>
          </div>

          {/* direita: velocidade + RSVP + concluir */}
          <div className="flex flex-1 items-center justify-end gap-2">
            <div ref={speedWrapRef} className="relative">
              <button
                onClick={() => setSpeedOpen((s) => !s)}
                aria-label="Velocidade"
                className={cn(
                  "h-9 min-w-[52px] rounded-lg border px-2.5 font-mono text-[13px] font-semibold tabular-nums transition-colors",
                  speedOpen
                    ? "border-border bg-secondary text-foreground"
                    : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {rate}×
              </button>
              {speedOpen && (
                <div className="absolute bottom-full right-0 mb-3 w-52 rounded-2xl border border-border bg-popover p-4 shadow-2xl">
                  <div className="mb-3 text-center">
                    <span className="text-2xl font-bold">{rate}</span>
                    <span className="ml-0.5 text-sm text-muted-foreground">×</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.05}
                    value={rate}
                    onChange={(e) => changeRate(Number(e.target.value))}
                    className="w-full accent-brand"
                    aria-label="Velocidade de reprodução"
                  />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {PLAYBACK_RATES.map((r) => (
                      <button
                        key={r}
                        onClick={() => changeRate(r)}
                        className={cn(
                          "flex-1 basis-1/4 rounded-md py-1 font-mono text-xs font-semibold tabular-nums transition-colors",
                          rate === r
                            ? "bg-brand text-brand-foreground"
                            : "border border-border/70 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {r}×
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setRsvpOpen(true)}
              aria-label="Leitura dinâmica"
              className="hidden size-9 place-items-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-border hover:text-foreground sm:grid"
            >
              <Zap className="size-4" />
            </button>
            <button
              onClick={onMarkCompleted}
              aria-label="Marcar concluído"
              className={cn(
                "grid size-9 place-items-center rounded-lg border transition-colors",
                completed
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <Check className="size-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* modal de fim de episódio */}
      {ended && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/55 p-4">
          <div className="w-[380px] max-w-[90vw] rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-brand/15 text-brand">
              <Check className="size-6" />
            </div>
            <h2 className="text-lg font-bold">Episódio concluído</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {nextN !== null ? "Pronto para o próximo." : "Você chegou ao fim do livro."}
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => {
                  setEnded(false);
                  seek(0);
                  audioRef.current?.play();
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold transition-colors hover:border-foreground/40"
              >
                <Repeat className="size-4" /> Reouvir
              </button>
              <button
                onClick={goNext}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground"
              >
                {nextN !== null ? "Próximo" : "Biblioteca"} <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <RsvpReader
        open={rsvpOpen}
        onOpenChange={setRsvpOpen}
        text={scriptText}
        title={episodeTitle}
      />
    </div>
  );
}
