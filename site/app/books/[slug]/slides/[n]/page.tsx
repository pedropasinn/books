import { notFound } from "next/navigation";
import { getPresentation } from "@/lib/queries";
import { SlideDeck } from "@/components/slide-deck";

export const dynamic = "force-dynamic";

export default async function SlidesPage({
  params,
}: {
  params: Promise<{ slug: string; n: string }>;
}) {
  const { slug, n } = await params;
  const number = parseInt(n, 10);
  if (!Number.isFinite(number)) notFound();

  const data = await getPresentation(slug, number);
  if (!data) notFound();

  return (
    <SlideDeck
      slug={data.book.slug}
      chapterTitle={data.title}
      presentation={data.presentation}
      prev={data.prev}
      next={data.next}
    />
  );
}
