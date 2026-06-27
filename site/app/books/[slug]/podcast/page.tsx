import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookBySlug, listEpisodesForBook } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtDuration(sec?: number | null) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function PodcastPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) notFound();

  const episodes = await listEpisodesForBook(book.id);
  const completed = episodes.filter((e) => e.progress?.completed).length;
  const pct = episodes.length ? Math.round((completed / episodes.length) * 100) : 0;

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
            <h1 className="text-2xl font-semibold tracking-tight">Podcast-resumo</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{episodes.length} episódios</Badge>
              {completed > 0 && <Badge variant="outline">{completed} concluídos</Badge>}
              <span>{pct}% completo</span>
            </div>
          </div>
          {episodes.length > 0 && (
            <Button asChild>
              <Link href={`/books/${book.slug}/ep/${episodes[0].number}`}>
                <Play className="size-4" />
                Começar do início
              </Link>
            </Button>
          )}
        </div>
        <Progress value={pct} className="h-1 max-w-md" />
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {episodes.map((ep) => {
              const isCompleted = ep.progress?.completed;
              const hasAudio = ep.status === "ready" || ep.status === "aligned";
              const dur = fmtDuration(ep.durationSec);
              return (
                <li key={ep.id}>
                  <Link
                    href={`/books/${book.slug}/ep/${ep.number}`}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                      {ep.number.toString().padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{ep.title}</p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        {dur && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {dur}
                          </span>
                        )}
                        {!hasAudio && (
                          <Badge variant="outline" className="h-5 font-normal">
                            só script
                          </Badge>
                        )}
                        {ep.status === "ready" && (
                          <Badge variant="secondary" className="h-5 font-normal">
                            karaoke
                          </Badge>
                        )}
                        {ep.progress && !isCompleted && ep.progress.positionSec > 5 && (
                          <span>parado em {Math.floor(ep.progress.positionSec / 60)}min</span>
                        )}
                      </div>
                    </div>
                    {isCompleted ? (
                      <CheckCircle2 className="size-5 text-emerald-500" />
                    ) : (
                      <Play className="size-4 text-muted-foreground" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
