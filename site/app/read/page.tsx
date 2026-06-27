"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RsvpReader, tokenize } from "@/components/rsvp-reader";
import { Zap, Upload, Trash2 } from "lucide-react";

const STORAGE_KEY = "rsvp:reader";

type Saved = { text: string; idx: number; wpm: number };

export default function ReadPage() {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [resumeIdx, setResumeIdx] = useState(0);
  const [wpm, setWpm] = useState(350);
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Restaura o último texto/posição
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s: Saved = JSON.parse(raw);
        setText(s.text ?? "");
        setResumeIdx(s.idx ?? 0);
        setWpm(s.wpm ?? 350);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  // Persiste o texto enquanto edita
  useEffect(() => {
    if (!loaded) return;
    const save: Saved = { text, idx: resumeIdx, wpm };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch {
      /* ignore */
    }
  }, [text, resumeIdx, wpm, loaded]);

  const words = useMemo(() => tokenize(text), [text]);
  const wordCount = words.length;
  const minutes = wordCount / wpm;

  const onFile = async (file: File) => {
    const content = await file.text();
    setText(content);
    setResumeIdx(0);
  };

  const start = (fromStart: boolean) => {
    setResumeIdx((i) => (fromStart ? 0 : i));
    setOpen(true);
  };

  const hasResume = resumeIdx > 0 && resumeIdx < wordCount - 1;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Leitura dinâmica</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cole ou suba um texto e leia em modo Spritz: uma palavra por vez, com a
          letra de foco em vermelho, sem mover os olhos. Ajuste a velocidade em
          palavras por minuto e dispare a janela flutuante.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-3.5" />
                Subir .txt
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
              {text && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setText("");
                    setResumeIdx(0);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Limpar
                </Button>
              )}
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {wordCount > 0
                ? `${wordCount} palavras · ~${
                    minutes >= 1 ? `${Math.ceil(minutes)} min` : "menos de 1 min"
                  } a ${wpm} wpm`
                : "0 palavras"}
            </span>
          </div>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResumeIdx(0);
            }}
            placeholder="Cole aqui o texto que você quer ler de forma dinâmica…"
            className="h-64 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-7 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />

          <div className="flex flex-wrap gap-2">
            <Button disabled={wordCount === 0} onClick={() => start(true)}>
              <Zap className="size-4" />
              {hasResume ? "Ler do início" : "Iniciar leitura dinâmica"}
            </Button>
            {hasResume && (
              <Button variant="outline" onClick={() => start(false)}>
                Retomar na palavra {resumeIdx + 1}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <RsvpReader
        open={open}
        onOpenChange={setOpen}
        text={text}
        startIndex={resumeIdx}
        initialWpm={wpm}
        onClose={(wordIndex) => setResumeIdx(wordIndex)}
      />
    </div>
  );
}
