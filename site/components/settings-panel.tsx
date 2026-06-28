"use client";

import { useState } from "react";
import { Settings, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefs, ACCENT_SWATCHES, type Theme } from "@/lib/preferences";

const MODE_LABELS: Record<string, string> = {
  podcast: "Podcast-resumo",
  read: "Ler o livro",
  rsvp: "Leitura dinâmica",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {hint && <span className="text-xs tabular-nums text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
            value === o.v
              ? "border-brand bg-brand text-brand-foreground"
              : "border-border text-muted-foreground hover:border-border hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const { prefs, setPref, reset } = usePrefs();

  const moveMode = (i: number, dir: -1 | 1) => {
    const next = [...prefs.modeOrder];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setPref("modeOrder", next);
  };

  return (
    <>
      <button
        aria-label="Preferências"
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Settings className="size-4" />
      </button>

      {/* Overlay */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[60] bg-black/50 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Painel deslizante */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-[61] w-[344px] max-w-[88vw] overflow-y-auto border-l border-border bg-card px-5 pb-12 pt-5 shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Preferências</h2>
          <button
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-7">
          <Field label="Tema">
            <Segmented<Theme>
              value={prefs.theme}
              onChange={(v) => setPref("theme", v)}
              options={[
                { v: "dark", label: "Escuro" },
                { v: "light", label: "Claro" },
                { v: "sepia", label: "Sépia" },
              ]}
            />
          </Field>

          <Field label="Destaque">
            <div className="flex flex-wrap gap-2.5">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  onClick={() => setPref("brand", c)}
                  style={{ background: c }}
                  className={cn(
                    "size-7 rounded-full transition-transform hover:scale-110",
                    prefs.brand === c && "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                  )}
                />
              ))}
            </div>
          </Field>

          <Field label="Largura de leitura" hint={`${prefs.readingWidth}px`}>
            <input
              type="range"
              min={520}
              max={960}
              step={20}
              value={prefs.readingWidth}
              onChange={(e) => setPref("readingWidth", Number(e.target.value))}
              className="w-full accent-brand"
            />
          </Field>

          <Field label="Tamanho do texto" hint={`${Math.round(prefs.readingScale * 100)}%`}>
            <input
              type="range"
              min={0.85}
              max={1.45}
              step={0.05}
              value={prefs.readingScale}
              onChange={(e) => setPref("readingScale", Number(e.target.value))}
              className="w-full accent-brand"
            />
          </Field>

          <Field label="Leitura dinâmica (RSVP)" hint={`${prefs.rsvpWpm} ppm`}>
            <input
              type="range"
              min={150}
              max={800}
              step={10}
              value={prefs.rsvpWpm}
              onChange={(e) => setPref("rsvpWpm", Number(e.target.value))}
              className="w-full accent-brand"
            />
            <label className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              Modo foco ao tocar
              <input
                type="checkbox"
                checked={prefs.rsvpFocus}
                onChange={(e) => setPref("rsvpFocus", e.target.checked)}
                className="size-4 accent-brand"
              />
            </label>
          </Field>

          <Field label="Layout — ordem dos modos">
            <div className="space-y-1.5">
              {prefs.modeOrder.map((m, i) => (
                <div
                  key={m}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>{MODE_LABELS[m] ?? m}</span>
                  <div className="flex gap-1">
                    <button
                      aria-label="Subir"
                      disabled={i === 0}
                      onClick={() => moveMode(i, -1)}
                      className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      aria-label="Descer"
                      disabled={i === prefs.modeOrder.length - 1}
                      onClick={() => moveMode(i, 1)}
                      className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Layout — blocos">
            <label className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Mostrar &quot;Continuar&quot; na home</span>
              <input
                type="checkbox"
                checked={prefs.showContinue}
                onChange={(e) => setPref("showContinue", e.target.checked)}
                className="size-4 accent-brand"
              />
            </label>
          </Field>

          <button
            onClick={reset}
            className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Restaurar padrões
          </button>
        </div>
      </aside>
    </>
  );
}
