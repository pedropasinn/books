import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookBySlug, listHighlights } from "@/lib/queries";
import { ArrowLeft } from "lucide-react";
import { NotesList } from "./notes-list";

export const dynamic = "force-dynamic";

export default async function NotesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) notFound();
  const highlights = await listHighlights(book.id);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/books/${book.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {book.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Notas &amp; trechos</h1>
        <p className="text-xs text-muted-foreground">
          {highlights.length} {highlights.length === 1 ? "trecho salvo" : "trechos salvos"}
        </p>
      </div>
      <NotesList slug={book.slug} highlights={highlights} />
    </div>
  );
}
