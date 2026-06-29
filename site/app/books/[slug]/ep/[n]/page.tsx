import { notFound } from "next/navigation";
import { getEpisode, getAdjacentEpisodes } from "@/lib/queries";
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
    <EpisodePlayer
      episodeId={episode.id}
      bookSlug={book.slug}
      bookTitle={book.title}
      episodeNumber={episode.number}
      episodeTitle={episode.title}
      audioUrl={episode.audioUrl}
      alignmentUrl={episode.alignmentUrl}
      scriptText={episode.scriptText}
      initialPositionSec={progress?.positionSec ?? 0}
      initialCompleted={progress?.completed ?? false}
      prevN={prev}
      nextN={next}
    />
  );
}
