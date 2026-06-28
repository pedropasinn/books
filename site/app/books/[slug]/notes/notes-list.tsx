"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { deleteHighlight } from "@/lib/actions-read";
import type { Highlight } from "@/lib/queries";
import { cn } from "@/lib/utils";

const SWATCH: Record<string, string> = {
  brand: "bg-brand",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  green: "bg-emerald-400",
};

export function NotesList({ slug, highlights }: { slug: string; highlights: Highlight[] }) {
  const [items, setItems] = useState(highlights);

  const remove = async (id: string) => {
    setItems((i) => i.filter((x) => x.id !== id));
    try {
      await deleteHighlight(id);
      toast.success("Removido");
    } catch {
      toast.error("Não consegui remover");
    }
  };

  if (!items.length)
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum trecho salvo ainda. No leitor, selecione um trecho para salvar ou anotar.
      </p>
    );

  return (
    <div className="space-y-3">
      {items.map((h) => (
        <Card key={h.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn("size-2.5 rounded-full", SWATCH[h.color] ?? "bg-brand")} />
                Capítulo {h.chapterNumber}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remover"
                onClick={() => remove(h.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <Link href={`/books/${slug}/read/${h.chapterNumber}?w=${h.startWordIndex}`} className="block">
              <blockquote className="border-l-2 border-border pl-3 text-sm italic leading-6 text-foreground/90">
                {h.snippet}
              </blockquote>
            </Link>
            {h.note && <p className="text-sm text-muted-foreground">{h.note}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
