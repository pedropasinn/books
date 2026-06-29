"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { usePrefs } from "@/lib/preferences";
import { cn } from "@/lib/utils";

// ── conversões de cor ────────────────────────────────────────────────────────
function clampByte(x: number) {
  return Math.max(0, Math.min(255, Math.round(x)));
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => clampByte(255 * x).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = (hex || "").replace("#", "");
  let r = 0,
    g = 0,
    b = 0;
  if (m.length === 3) {
    r = parseInt(m[0] + m[0], 16);
    g = parseInt(m[1] + m[1], 16);
    b = parseInt(m[2] + m[2], 16);
  } else if (m.length >= 6) {
    r = parseInt(m.slice(0, 2), 16);
    g = parseInt(m.slice(2, 4), 16);
    b = parseInt(m.slice(4, 6), 16);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0,
    s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const HUE_GRADIENT =
  "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)";

/** Faixa arrastável (espectrograma de matiz / luminosidade). */
function Bar({
  background,
  value,
  onChange,
}: {
  background: string;
  value: number; // 0..1
  onChange: (frac: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const at = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    onChange(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };
  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        at(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && at(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      className="relative h-4 w-full cursor-pointer rounded-full"
      style={{ background }}
    >
      <span
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/40"
        style={{ left: `${value * 100}%` }}
      />
    </div>
  );
}

/**
 * Seletor de cor de destaque reutilizável: espectrograma (matiz + luminosidade)
 * para escolher qualquer cor + 3 slots que o usuário define (salvar a cor atual).
 * `dark` força tons claros (usado dentro do RSVP, que é sempre escuro).
 */
export function AccentPicker({ dark = false }: { dark?: boolean }) {
  const { prefs, setPref } = usePrefs();
  const { h, s, l } = hexToHsl(prefs.brand);
  const sat = s < 15 ? 72 : s; // evita cinza onde o matiz não teria efeito
  const slots = prefs.accentSlots ?? [];

  const setHue = (frac: number) =>
    setPref("brand", hslToHex(Math.round(frac * 360), sat, l < 22 ? 55 : l > 85 ? 55 : l));
  const setLight = (frac: number) =>
    setPref("brand", hslToHex(h, sat, Math.round(22 + frac * 63))); // 22..85

  const saveSlot = () => {
    const next = [prefs.brand, ...slots.filter((c) => c.toLowerCase() !== prefs.brand.toLowerCase())].slice(0, 3);
    setPref("accentSlots", next);
  };

  const subtle = dark ? "text-zinc-400" : "text-muted-foreground";
  const ringOffset = dark ? "ring-offset-zinc-900" : "ring-offset-card";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span
          className="size-7 shrink-0 rounded-full ring-1 ring-black/20"
          style={{ background: prefs.brand }}
        />
        <span className={cn("font-mono text-xs tabular-nums uppercase", subtle)}>{prefs.brand}</span>
      </div>

      <Bar background={HUE_GRADIENT} value={((h % 360) + 360) % 360 / 360} onChange={setHue} />
      <Bar
        background={`linear-gradient(to right, ${hslToHex(h, sat, 22)}, ${hslToHex(h, sat, 55)}, ${hslToHex(h, sat, 85)})`}
        value={Math.min(1, Math.max(0, (l - 22) / 63))}
        onChange={setLight}
      />

      <div className="flex items-center gap-2 pt-0.5">
        {slots.map((c, i) => (
          <button
            key={i}
            aria-label={`Cor salva ${c}`}
            onClick={() => setPref("brand", c)}
            style={{ background: c }}
            className={cn(
              "size-7 rounded-full transition-transform hover:scale-110",
              prefs.brand.toLowerCase() === c.toLowerCase() &&
                cn("ring-2 ring-offset-2", dark ? "ring-white" : "ring-foreground", ringOffset)
            )}
          />
        ))}
        <button
          aria-label="Salvar cor atual"
          onClick={saveSlot}
          className={cn(
            "grid size-7 place-items-center rounded-full border border-dashed transition-colors",
            dark
              ? "border-white/25 text-zinc-400 hover:border-white/50 hover:text-zinc-100"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          )}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
