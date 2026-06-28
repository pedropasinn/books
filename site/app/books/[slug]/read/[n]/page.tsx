import { notFound } from "next/navigation";
import { getReadingChapter, listHighlights } from "@/lib/queries";
import { BookReader } from "./reader";

export const dynamic = "force-dynamic";

export default async function ReadChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; n: string }>;
  searchParams: Promise<{ rsvp?: string }>;
}) {
  const { slug, n } = await params;
  const sp = await searchParams;
  const number = parseInt(n, 10);
  if (!Number.isFinite(number)) notFound();

  const data = await getReadingChapter(slug, number);
  if (!data) notFound();
  const { book, chapter, prev, next, readState } = data;
  const highlights = await listHighlights(book.id, number);

  const initialWordIndex =
    readState?.chapterNumber === number ? readState.wordIndex ?? 0 : 0;

  return (
    <BookReader
      slug={book.slug}
      bookId={book.id}
      bookTitle={book.title}
      chapter={{ number: chapter.number, title: chapter.title, text: chapter.text }}
      prev={prev}
      next={next}
      autoRsvp={sp.rsvp === "1"}
      initialWordIndex={initialWordIndex}
      initialHighlights={highlights}
    />
  );
}
