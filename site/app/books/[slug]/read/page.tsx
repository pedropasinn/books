import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookBySlug, getReadingPosition } from "@/lib/queries";
import { ArrowLeft } from "lucide-react";
import { EpubReader } from "./reader";

export default async function ReadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) notFound();
  if (!book.epubUrl) {
    return (
      <div className="space-y-4">
        <Link
          href={`/books/${book.slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Voltar
        </Link>
        <p className="text-sm text-muted-foreground">
          Este livro não tem EPUB cadastrado. Coloque um arquivo em{" "}
          <code className="font-mono text-xs">content/{book.slug}/book.epub</code> e rode{" "}
          <code className="font-mono text-xs">pnpm ingest</code>.
        </p>
      </div>
    );
  }

  const pos = await getReadingPosition(book.id);

  return (
    <div className="-mx-6 -my-10 flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-border/40 px-6 py-2">
        <Link
          href={`/books/${book.slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          {book.title}
        </Link>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <EpubReader bookId={book.id} url={book.epubUrl} initialCfi={pos?.cfi ?? null} />
      </div>
    </div>
  );
}
