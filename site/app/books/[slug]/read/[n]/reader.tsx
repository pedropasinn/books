"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, Zap, StickyNote } from "lucide-react";
import { RsvpReader } from "@/components/rsvp-reader";
import { saveReadingProgress, saveHighlight } from "@/lib/actions-read";
import type { Highlight } from "@/lib/queries";
import { cn } from "@/lib/utils";

const HL_COLORS: Record<string, string> = {
  brand: "bg-brand/25",
  amber: "bg-amber-400/30",
  rose: "bg-rose-400/30",
  green: "bg-emerald-400/30",
};
const COLOR_SWATCH: Record<string, string> = {
  brand: "bg-brand",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  green: "bg-emerald-400",
};

type Props = {
  slug: string;
  bookId: string;
  bookTitle: string;
  chapter: { number: number; title: string; text: string };
  prev: number | null;
  next: number | null;
  autoRsvp: boolean;
  initialWordIndex: number;
  initialHighlights: Highlight[];
};

type Pending = { startGi: number; endGi: number; snippet: string; x: number; y: number };

export function BookReader({
  slug,
  bookId,
  bookTitle,
  chapter,
  prev,
  next,
  autoRsvp,
  initialWordIndex,
  initialHighlights,
}: Props) {
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [rsvpStart, setRsvpStart] = useState(initialWordIndex);
  const [wordIndex, setWordIndex] = useState(initialWordIndex);
  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingColor, setPendingColor] = useState("brand");
  const [pendingNote, setPendingNote] = useState("");
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (autoRsvp) {
      setRsvpStart(initialWordIndex);
      setRsvpOpen(true);
    }
  }, [autoRsvp, initialWordIndex]);

  useEffect(() => {
    saveReadingProgress({ bookId, chapterNumber: chapter.number, wordIndex: initialWordIndex }).catch(
      () => {}
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapter.number]);

  // Parágrafos com índice de palavra GLOBAL (bate com tokenize do RSVP).
  const paras = useMemo(() => {
    const split = chapter.text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    let offset = 0;
    return split.map((par) => {
      const words = par.split(/\s+/).filter(Boolean);
      const start = offset;
      offset += words.length;
      return { words, start };
    });
  }, [chapter.text]);

  const hlByWord = useMemo(() => {
    const m = new Map<number, { color: string; hasNote: boolean }>();
    for (const h of highlights)
      for (let i = h.startWordIndex; i <= h.endWordIndex; i++)
        m.set(i, { color: h.color, hasNote: !!h.note });
    return m;
  }, [highlights]);

  const openRsvpAt = (gi: number) => {
    setRsvpStart(gi);
    setRsvpOpen(true);
  };

  // Clique simples numa palavra → RSVP dali. Seleção → popover de trecho/nota.
  const onMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    if (!text) {
      const node = sel.anchorNode;
      const el = (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>("[data-gi]");
      if (el?.dataset.gi) openRsvpAt(Number(el.dataset.gi));
      setPending(null);
      return;
    }

    const spans = articleRef.current?.querySelectorAll<HTMLElement>("span[data-gi]");
    const gis: number[] = [];
    spans?.forEach((s) => {
      if (range.intersectsNode(s)) gis.push(Number(s.dataset.gi));
    });
    if (!gis.length) return;
    const rect = range.getBoundingClientRect();
    setPendingColor("brand");
    setPendingNote("");
    setPending({
      startGi: Math.min(...gis),
      endGi: Math.max(...gis),
      snippet: text,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const commit = async () => {
    if (!pending) return;
    const optimistic: Highlight = {
      id: `tmp-${pending.startGi}`,
      userId: "pedro",
      bookId,
      chapterNumber: chapter.number,
      startWordIndex: pending.startGi,
      endWordIndex: pending.endGi,
      snippet: pending.snippet,
      color: pendingColor,
      note: pendingNote.trim() || null,
      createdAt: new Date(),
    };
    setHighlights((h) => [...h, optimistic]);
    setPending(null);
    window.getSelection()?.removeAllRanges();
    try {
      const id = await saveHighlight({
        bookId,
        chapterNumber: chapter.number,
        startWordIndex: optimistic.startWordIndex,
        endWordIndex: optimistic.endWordIndex,
        snippet: optimistic.snippet,
        color: optimistic.color,
        note: optimistic.note ?? undefined,
      });
      setHighlights((h) => h.map((x) => (x.id === optimistic.id ? { ...x, id } : x)));
      toast.success(pendingNote.trim() ? "Nota salva" : "Trecho salvo");
    } catch {
      setHighlights((h) => h.filter((x) => x.id !== optimistic.id));
      toast.error("Não consegui salvar");
    }
  };

  const noteCount = highlights.length;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link
          href={`/books/${slug}/read`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {bookTitle}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{chapter.title}</h1>
          <div className="flex items-center gap-2">
            {noteCount > 0 && (
              <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                <Link href={`/books/${slug}/notes`}>
                  <StickyNote className="size-3.5" />
                  {noteCount}
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openRsvpAt(wordIndex)}
            >
              <Zap className="size-3.5" />
              Leitura dinâmica
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Clique numa palavra para ler em RSVP a partir dela · selecione um trecho para salvar/anotar
        </p>
      </header>

      <article
        ref={articleRef}
        onMouseUp={onMouseUp}
        className="prose dark:prose-invert reading-prose mx-auto"
        style={{
          maxWidth: "var(--reading-width, 680px)",
          fontSize: "calc(1.0625rem * var(--reading-scale, 1))",
        }}
      >
        {paras.map((p, pi) => (
          <p key={pi}>
            {p.words.map((w, wi) => {
              const gi = p.start + wi;
              const hl = hlByWord.get(gi);
              return (
                <span
                  key={gi}
                  data-gi={gi}
                  className={cn(
                    "rounded-sm transition-colors hover:text-brand",
                    hl && HL_COLORS[hl.color],
                    hl?.hasNote && "underline decoration-dotted underline-offset-4"
                  )}
                >
                  {w}{" "}
                </span>
              );
            })}
          </p>
        ))}
      </article>

      {/* Popover de trecho/nota */}
      {pending && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPending(null)} />
          <div
            className="fixed z-50 w-72 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-popover p-3 shadow-2xl"
            style={{ left: pending.x, top: pending.y - 8 }}
          >
            <div className="mb-2 flex gap-2">
              {Object.keys(HL_COLORS).map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  onClick={() => setPendingColor(c)}
                  className={cn(
                    "size-5 rounded-full",
                    COLOR_SWATCH[c],
                    pendingColor === c && "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                  )}
                />
              ))}
            </div>
            <textarea
              value={pendingNote}
              onChange={(e) => setPendingNote(e.target.value)}
              placeholder="Nota (opcional)…"
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-brand"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={commit}>
                Salvar
              </Button>
            </div>
          </div>
        </>
      )}

      <nav className="flex items-center justify-between border-t border-border/60 pt-4">
        {prev != null ? (
          <Button variant="ghost" asChild>
            <Link href={`/books/${slug}/read/${prev}`}>
              <ChevronLeft className="size-4" />
              Anterior
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next != null ? (
          <Button variant="ghost" asChild>
            <Link href={`/books/${slug}/read/${next}`}>
              Próximo
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </nav>

      <RsvpReader
        open={rsvpOpen}
        onOpenChange={setRsvpOpen}
        text={chapter.text}
        title={chapter.title}
        startIndex={rsvpStart}
        onClose={(idx) => {
          setWordIndex(idx);
          saveReadingProgress({ bookId, chapterNumber: chapter.number, wordIndex: idx }).catch(
            () => {}
          );
        }}
      />
    </div>
  );
}
