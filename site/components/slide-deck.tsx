"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Presentation } from "@/lib/db/schema";

const ICON_COLOR: Record<string, string> = {
  gold: "bg-amber-400",
  blue: "bg-sky-400",
  terracota: "bg-orange-500",
  ardosia: "bg-slate-400",
  green: "bg-emerald-400",
};

/** url_wikimedia aponta para a PÁGINA do Commons; Special:FilePath devolve a imagem. */
function imgUrl(u?: string): string | null {
  if (!u) return null;
  const m = u.match(/File:(.+)$/);
  return m ? `https://commons.wikimedia.org/wiki/Special:FilePath/${m[1]}?width=900` : u;
}

const html = (s: unknown) => ({ __html: String(s ?? "") });

type Slide =
  | { type: "hero"; data: Record<string, any> }
  | { type: "section"; data: Record<string, any> }
  | { type: "diagram"; data: Record<string, any> }
  | { type: "quiz"; data: Record<string, any>; qi: number }
  | { type: "result" };

export function SlideDeck({
  slug,
  chapterTitle,
  presentation,
  prev,
  next,
}: {
  slug: string;
  chapterTitle: string;
  presentation: Presentation;
  prev: number | null;
  next: number | null;
}) {
  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    if (presentation.hero) out.push({ type: "hero", data: presentation.hero });
    for (const s of presentation.secoes ?? []) out.push({ type: "section", data: s });
    if (presentation.diagrama) out.push({ type: "diagram", data: presentation.diagrama });
    const questions = (presentation.quiz as any)?.questions ?? [];
    questions.forEach((q: any, qi: number) => out.push({ type: "quiz", data: q, qi }));
    if (questions.length) out.push({ type: "result" });
    return out;
  }, [presentation]);

  const total = slides.length;
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const go = useCallback(
    (d: number) => setI((x) => Math.max(0, Math.min(total - 1, x + d))),
    [total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const slide = slides[i];
  const questions = (presentation.quiz as any)?.questions ?? [];

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/books/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {chapterTitle}
        </Link>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {i + 1} / {total}
        </span>
      </div>

      {/* Palco */}
      <div className="relative flex flex-1 items-center">
        <button
          aria-label="Anterior"
          onClick={() => go(-1)}
          disabled={i === 0}
          className="absolute left-0 z-10 grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-20"
        >
          <ChevronLeft className="size-6" />
        </button>

        <div className="mx-auto w-full max-w-3xl px-12">
          {slide?.type === "hero" && <HeroSlide d={slide.data} />}
          {slide?.type === "section" && <SectionSlide d={slide.data} />}
          {slide?.type === "diagram" && <DiagramSlide d={slide.data} />}
          {slide?.type === "quiz" && (
            <QuizSlide
              d={slide.data}
              chosen={answers[slide.qi]}
              onChoose={(alt) => setAnswers((a) => ({ ...a, [slide.qi]: alt }))}
            />
          )}
          {slide?.type === "result" && <ResultSlide questions={questions} answers={answers} />}
        </div>

        <button
          aria-label="Próximo"
          onClick={() => go(1)}
          disabled={i === total - 1}
          className="absolute right-0 z-10 grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-20"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>

      {/* Barra de progresso + navegação entre capítulos */}
      <div className="mt-6 space-y-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${total > 1 ? (i / (total - 1)) * 100 : 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          {prev != null ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/books/${slug}/slides/${prev}`}>
                <ChevronLeft className="size-4" />
                Cap. anterior
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next != null ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/books/${slug}/slides/${next}`}>
                Próximo cap.
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}

function HeroSlide({ d }: { d: Record<string, any> }) {
  const img = imgUrl(d.imagem_hero_sugerida?.url_wikimedia);
  return (
    <div className="space-y-5 text-center">
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={d.imagem_hero_sugerida?.alt ?? ""}
          className="mx-auto max-h-64 rounded-xl object-cover shadow-lg"
        />
      )}
      <h1 className="text-4xl font-bold tracking-tight">{d.titulo}</h1>
      {d.subtitulo && <p className="text-lg text-muted-foreground">{d.subtitulo}</p>}
      {d.epigrafe?.texto && (
        <blockquote className="mx-auto max-w-xl border-l-2 border-brand pl-4 text-left text-sm italic text-foreground/80">
          <span dangerouslySetInnerHTML={html(d.epigrafe.texto)} />
          {d.epigrafe.autor && (
            <footer className="mt-1 not-italic text-muted-foreground">— {d.epigrafe.autor}</footer>
          )}
        </blockquote>
      )}
    </div>
  );
}

function SectionSlide({ d }: { d: Record<string, any> }) {
  const imgs: any[] = Array.isArray(d.imagens) ? d.imagens : [];
  const first = imgUrl(imgs[0]?.url_wikimedia);
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        {d.slide_badge && (
          <span className="text-xs font-semibold uppercase tracking-wider text-brand">
            {d.slide_badge}
          </span>
        )}
        <h2 className="text-2xl font-bold tracking-tight">{d.titulo}</h2>
        {d.subtitulo && <p className="text-muted-foreground">{d.subtitulo}</p>}
      </header>

      <div className={cn("gap-6", first && "grid sm:grid-cols-[1fr_220px]")}>
        <div className="prose dark:prose-invert reading-prose max-w-none text-[0.98rem]">
          {d.lead && (
            <p className="font-medium text-foreground" dangerouslySetInnerHTML={html(d.lead)} />
          )}
          {(Array.isArray(d.corpo) ? d.corpo : []).slice(0, 4).map((p: string, k: number) => (
            <p key={k} dangerouslySetInnerHTML={html(p)} />
          ))}
        </div>
        {first && (
          <figure className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={first} alt={imgs[0]?.alt ?? ""} className="rounded-lg object-cover shadow" />
            {imgs[0]?.credito && (
              <figcaption className="text-[10px] text-muted-foreground">{imgs[0].credito}</figcaption>
            )}
          </figure>
        )}
      </div>

      {Array.isArray(d.key_points) && d.key_points.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {d.key_points.map((kp: any, k: number) => (
            <li key={k} className="flex gap-2.5 rounded-lg border border-border p-3 text-sm">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", ICON_COLOR[kp.icone] ?? "bg-brand")} />
              <span dangerouslySetInnerHTML={html(kp.texto)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiagramSlide({ d }: { d: Record<string, any> }) {
  return (
    <div className="space-y-3 text-center">
      {d.eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-wider text-brand">{d.eyebrow}</span>
      )}
      <h2 className="text-2xl font-bold tracking-tight">{d.titulo}</h2>
      {d.caption && (
        <p className="mx-auto max-w-xl text-muted-foreground" dangerouslySetInnerHTML={html(d.caption)} />
      )}
    </div>
  );
}

function QuizSlide({
  d,
  chosen,
  onChoose,
}: {
  d: Record<string, any>;
  chosen: number | undefined;
  onChoose: (alt: number) => void;
}) {
  const correct = d.correta_idx as number;
  const answered = chosen !== undefined;
  return (
    <div className="space-y-4">
      <span className="text-xs font-semibold uppercase tracking-wider text-brand">Quiz</span>
      <h2 className="text-xl font-semibold tracking-tight">{d.pergunta}</h2>
      <div className="space-y-2">
        {(d.alternativas ?? []).map((alt: string, k: number) => {
          const isCorrect = k === correct;
          const isChosen = k === chosen;
          return (
            <button
              key={k}
              disabled={answered}
              onClick={() => onChoose(k)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                !answered && "border-border hover:border-brand/50 hover:bg-secondary",
                answered && isCorrect && "border-emerald-500/60 bg-emerald-500/10",
                answered && isChosen && !isCorrect && "border-rose-500/60 bg-rose-500/10",
                answered && !isCorrect && !isChosen && "border-border opacity-60"
              )}
            >
              {answered && isCorrect && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />}
              {answered && isChosen && !isCorrect && <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />}
              <span dangerouslySetInnerHTML={html(alt)} />
            </button>
          );
        })}
      </div>
      {answered && d.explicacao && (
        <p
          className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground"
          dangerouslySetInnerHTML={html(d.explicacao)}
        />
      )}
    </div>
  );
}

function ResultSlide({
  questions,
  answers,
}: {
  questions: any[];
  answers: Record<number, number>;
}) {
  const acertos = questions.filter((q, i) => answers[i] === q.correta_idx).length;
  return (
    <div className="space-y-3 text-center">
      <h2 className="text-2xl font-bold tracking-tight">Resultado</h2>
      <p className="text-4xl font-bold text-brand">
        {acertos} / {questions.length}
      </p>
      <p className="text-sm text-muted-foreground">
        {acertos === questions.length
          ? "Perfeito!"
          : acertos >= questions.length / 2
          ? "Bom trabalho — revise os que errou."
          : "Vale revisar o capítulo."}
      </p>
    </div>
  );
}
