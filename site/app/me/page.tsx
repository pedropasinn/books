import Link from "next/link";
import { listAllProgress } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, CheckCircle2 } from "lucide-react";

function fmtRel(d: Date | null) {
  if (!d) return "";
  const now = Date.now();
  const t = new Date(d).getTime();
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `há ${dd} d`;
  return new Date(d).toLocaleDateString("pt-BR");
}

export default async function MePage() {
  const rows = await listAllProgress();
  const inProgress = rows.filter((r) => !r.completed);
  const done = rows.filter((r) => r.completed);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Seu progresso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {rows.length === 0
            ? "Você ainda não ouviu nada — comece pela biblioteca."
            : `${inProgress.length} em andamento · ${done.length} concluídos`}
        </p>
      </header>

      {inProgress.length > 0 && (
        <Section title="Em andamento">
          {inProgress.map((row) => {
            const pct = row.durationSec
              ? Math.min(100, Math.round((row.positionSec / row.durationSec) * 100))
              : 0;
            return (
              <ProgressRow
                key={row.episodeId}
                href={`/books/${row.bookSlug}/ep/${row.number}`}
                bookTitle={row.bookTitle}
                cover={row.bookCover}
                title={`Ep ${row.number.toString().padStart(2, "0")} · ${row.title}`}
                meta={`${fmtRel(row.lastPlayedAt)} · ${pct}%`}
                pct={pct}
                icon={<Play className="size-4 text-muted-foreground" />}
              />
            );
          })}
        </Section>
      )}

      {done.length > 0 && (
        <Section title="Concluídos">
          {done.map((row) => (
            <ProgressRow
              key={row.episodeId}
              href={`/books/${row.bookSlug}/ep/${row.number}`}
              bookTitle={row.bookTitle}
              cover={row.bookCover}
              title={`Ep ${row.number.toString().padStart(2, "0")} · ${row.title}`}
              meta={fmtRel(row.lastPlayedAt)}
              pct={100}
              icon={<CheckCircle2 className="size-5 text-emerald-500" />}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">{children}</ul>
        </CardContent>
      </Card>
    </section>
  );
}

function ProgressRow({
  href,
  bookTitle,
  cover,
  title,
  meta,
  pct,
  icon,
}: {
  href: string;
  bookTitle: string;
  cover: string | null;
  title: string;
  meta: string;
  pct: number;
  icon: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
        <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-zinc-900">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-xs text-muted-foreground">{bookTitle}</p>
          <p className="line-clamp-1 text-sm font-medium">{title}</p>
          <div className="mt-1 flex items-center gap-2">
            <Progress value={pct} className="h-0.5 max-w-32" />
            <span className="text-xs text-muted-foreground">{meta}</span>
          </div>
        </div>
        {icon}
      </Link>
    </li>
  );
}
