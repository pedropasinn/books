import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookOverview, listReadingChapters } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtMin(words: number) {
  const min = Math.round(words / 250);
  return min < 1 ? "<1 min" : `${min} min`;
}

export default async function ReadIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const overview = await getBookOverview(slug);
  if (!overview || overview.chapterCount === 0) notFound();
  const { book, readState } = overview;
  const chapters = await listReadingChapters(book.id);
  const resume = readState?.chapterNumber ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href={`/books/${book.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {book.title}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ler o livro</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {chapters.length} {chapters.length === 1 ? "capítulo" : "capítulos"}
            </p>
          </div>
          {resume && (
            <Button asChild>
              <Link href={`/books/${book.slug}/read/${resume}`}>
                <BookOpen className="size-4" />
                Continuar leitura
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {chapters.map((ch) => (
              <li key={ch.id}>
                <Link
                  href={`/books/${book.slug}/read/${ch.number}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                    {ch.number.toString().padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{ch.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">~{fmtMin(ch.wordCount)} de leitura</p>
                  </div>
                  {ch.number === resume && (
                    <Badge variant="secondary" className="h-5 font-normal">
                      continuar
                    </Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
