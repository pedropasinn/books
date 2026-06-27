import Link from "next/link";
import { listBooks, getContinueListening } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Play } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtMin(sec?: number | null) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  return `${m}min`;
}

export default async function HomePage() {
  const [books, continueRows] = await Promise.all([listBooks(), getContinueListening(6)]);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Biblioteca</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Podcasts por capítulo. Áudio + script. Continue de onde parou.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Séries · karaokê
        </h2>
        <a href="/fr/index.html" className="group block">
          <Card className="overflow-hidden transition-colors hover:border-foreground/40">
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg"
                style={{ background: "linear-gradient(150deg, hsl(188 34% 17%), hsl(214 40% 9%))" }}
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-90 transition-opacity group-hover:opacity-100">
                  <Play className="size-7 text-white" />
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold tracking-tight">A Revolução Francesa</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  The Rest Is History · 13 episódios · inglês com tradução, vídeo do YouTube e
                  legenda sincronizada palavra a palavra
                </p>
              </div>
            </CardContent>
          </Card>
        </a>
      </section>

      {continueRows.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Continuar
            </h2>
            <Link href="/me" className="text-xs text-muted-foreground hover:text-foreground">
              ver tudo →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {continueRows.map((row) => {
              const pct = row.durationSec
                ? Math.min(100, Math.round((row.positionSec / row.durationSec) * 100))
                : 0;
              const left = row.durationSec ? row.durationSec - row.positionSec : null;
              return (
                <Link
                  key={row.episodeId}
                  href={`/books/${row.bookSlug}/ep/${row.number}`}
                  className="group"
                >
                  <Card className="transition-colors hover:border-foreground/40">
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="relative aspect-[3/4] h-20 w-15 shrink-0 overflow-hidden rounded bg-zinc-900">
                        {row.bookCover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.bookCover}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                          <Play className="size-5 text-white" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {row.bookTitle}
                        </p>
                        <p className="line-clamp-2 text-sm font-medium leading-snug">
                          Ep {row.number.toString().padStart(2, "0")} · {row.title}
                        </p>
                        <div className="space-y-1">
                          <Progress value={pct} className="h-0.5" />
                          <p className="text-xs text-muted-foreground">
                            {left ? `${fmtMin(left)} restantes` : `${fmtMin(row.positionSec)} ouvido`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        {continueRows.length > 0 && (
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Todos os livros
          </h2>
        )}
        {books.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Nenhum livro ainda. Rode <code className="font-mono text-xs">pnpm ingest</code>.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => {
              const pct = book.totalEpisodes
                ? Math.round((book.completedEpisodes / book.totalEpisodes) * 100)
                : 0;
              return (
                <Link key={book.id} href={`/books/${book.slug}`}>
                  <Card className="group h-full overflow-hidden transition-colors hover:border-foreground/40">
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950">
                      {book.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-6 text-center">
                          <span className="font-serif text-xl tracking-tight text-zinc-100">
                            {book.title}
                          </span>
                        </div>
                      )}
                    </div>
                    <CardContent className="space-y-3 p-4">
                      <div>
                        <h2 className="line-clamp-2 text-base font-semibold tracking-tight">
                          {book.title}
                        </h2>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {book.authors}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {book.totalEpisodes > 0 && (
                          <Badge variant="secondary" className="font-normal">
                            {book.totalEpisodes} ep
                          </Badge>
                        )}
                        {book.totalChapters > 0 && (
                          <Badge variant="secondary" className="font-normal">
                            {book.totalChapters} cap
                          </Badge>
                        )}
                        {book.completedEpisodes > 0 && (
                          <Badge variant="outline" className="font-normal">
                            {book.completedEpisodes} concluídos
                          </Badge>
                        )}
                      </div>
                      {book.totalEpisodes > 0 && <Progress value={pct} className="h-1" />}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
