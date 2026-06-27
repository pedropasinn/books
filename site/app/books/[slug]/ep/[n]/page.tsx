import Link from "next/link";
import { notFound } from "next/navigation";
import { getEpisode, getAdjacentEpisodes } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { EpisodePlayer } from "./player";

export const dynamic = "force-dynamic";

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ slug: string; n: string }>;
}) {
  const { slug, n } = await params;
  const number = parseInt(n, 10);
  if (Number.isNaN(number)) notFound();

  const data = await getEpisode(slug, number);
  if (!data) notFound();

  const { book, episode, progress } = data;
  const { prev, next } = await getAdjacentEpisodes(book.id, episode.number);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/books/${book.slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          {book.title}
        </Link>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-mono text-sm text-muted-foreground">
            Ep {episode.number.toString().padStart(2, "0")}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{episode.title}</h1>
        </div>
        {episode.status === "audio_pending" && (
          <Badge variant="outline" className="mt-3 font-normal">
            Áudio em processamento — só script disponível
          </Badge>
        )}
      </div>

      <EpisodePlayer
        episodeId={episode.id}
        audioUrl={episode.audioUrl}
        alignmentUrl={episode.alignmentUrl}
        scriptText={episode.scriptText}
        initialPositionSec={progress?.positionSec ?? 0}
        initialCompleted={progress?.completed ?? false}
      />

      <nav className="flex items-center justify-between border-t border-border/40 pt-4">
        {prev !== null ? (
          <Button variant="ghost" asChild>
            <Link href={`/books/${book.slug}/ep/${prev}`}>
              <ChevronLeft className="size-4" />
              Ep {prev.toString().padStart(2, "0")}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next !== null && (
          <Button variant="ghost" asChild>
            <Link href={`/books/${book.slug}/ep/${next}`}>
              Ep {next.toString().padStart(2, "0")}
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        )}
      </nav>
    </div>
  );
}
