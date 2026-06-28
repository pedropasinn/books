import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookOverview } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Headphones, BookOpen, Zap, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Mode = {
  key: string;
  icon: typeof Headphones;
  title: string;
  desc: string;
  href: string;
  enabled: boolean;
};

function ModeCard({ mode }: { mode: Mode }) {
  const { icon: Icon, title, desc, enabled } = mode;
  const inner = (
    <Card
      className={cn(
        "h-full transition-all duration-200",
        enabled
          ? "hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-black/20"
          : "opacity-45"
      )}
    >
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <Icon className={cn("size-6", enabled ? "text-brand" : "text-muted-foreground")} />
        <div className="mt-auto">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {enabled ? desc : "Ainda não disponível"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
  return enabled ? (
    <Link href={mode.href} className="block">
      {inner}
    </Link>
  ) : (
    <div aria-disabled className="cursor-not-allowed">
      {inner}
    </div>
  );
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const overview = await getBookOverview(slug);
  if (!overview) notFound();
  const { book, episodeCount, chapterCount, slideCount, readState } = overview;
  const resume = readState?.chapterNumber ?? 1;

  const modes: Mode[] = [
    {
      key: "podcast",
      icon: Headphones,
      title: "Podcast-resumo",
      desc: `${episodeCount} ${episodeCount === 1 ? "episódio" : "episódios"} narrados`,
      href: `/books/${slug}/podcast`,
      enabled: episodeCount > 0,
    },
    {
      key: "read",
      icon: BookOpen,
      title: "Ler o livro",
      desc: `${chapterCount} ${chapterCount === 1 ? "capítulo" : "capítulos"}`,
      href: `/books/${slug}/read`,
      enabled: chapterCount > 0,
    },
    {
      key: "rsvp",
      icon: Zap,
      title: "Leitura dinâmica",
      desc: "Leitura acelerada (RSVP)",
      href: `/books/${slug}/read/${resume}?rsvp=1`,
      enabled: chapterCount > 0,
    },
    {
      key: "slides",
      icon: Presentation,
      title: "Apresentação",
      desc: "Slides + quiz",
      href: `/books/${slug}/slides/1`,
      enabled: slideCount > 0,
    },
  ];

  return (
    <div className="space-y-10">
      <header className="grid gap-8 md:grid-cols-[200px_1fr] md:gap-10">
        <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 shadow-lg md:w-[200px]">
          {book.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6 text-center">
              <span className="font-serif text-2xl tracking-tight text-zinc-100">{book.title}</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{book.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{book.authors}</p>
          </div>
          {book.summary && (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{book.summary}</p>
          )}
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Como consumir
        </h2>
        <div className="flex flex-col gap-4 sm:flex-row">
          {modes.map((m) => (
            <div
              key={m.key}
              className="flex-1"
              style={{ order: m.key === "slides" ? 99 : `var(--order-${m.key}, 0)` }}
            >
              <ModeCard mode={m} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
