"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { RsvpReader } from "@/components/rsvp-reader";
import { saveReadingProgress } from "@/lib/actions-read";

type Props = {
  slug: string;
  bookId: string;
  bookTitle: string;
  chapter: { number: number; title: string; text: string };
  prev: number | null;
  next: number | null;
  autoRsvp: boolean;
  initialWordIndex: number;
};

export function BookReader({
  slug,
  bookId,
  bookTitle,
  chapter,
  prev,
  next,
  autoRsvp,
  initialWordIndex,
}: Props) {
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [wordIndex, setWordIndex] = useState(initialWordIndex);

  // Abre o RSVP automaticamente quando chega via ?rsvp=1 (deep-link da central).
  useEffect(() => {
    if (autoRsvp) setRsvpOpen(true);
  }, [autoRsvp]);

  // Marca este capítulo como a posição de leitura atual (ao montar / trocar capítulo).
  useEffect(() => {
    saveReadingProgress({ bookId, chapterNumber: chapter.number, wordIndex: initialWordIndex }).catch(
      () => {}
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapter.number]);

  const paragraphs = useMemo(
    () =>
      chapter.text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    [chapter.text]
  );

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
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRsvpOpen(true)}>
            <Zap className="size-3.5" />
            Leitura dinâmica
          </Button>
        </div>
      </header>

      <article className="prose dark:prose-invert reading-prose max-w-prose text-[1.05rem]">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>

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
        startIndex={wordIndex}
        initialWpm={350}
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
