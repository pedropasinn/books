"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "sepia";

export type Prefs = {
  theme: Theme;
  brand: string; // hex da cor de destaque
  readingWidth: number; // px (largura do leitor)
  readingScale: number; // multiplicador do tamanho do texto de leitura
  // RSVP (usado na Fase 3)
  rsvpWpm: number;
  rsvpPunctMult: number; // 1..4 — multiplicador de pausa em pontuação
  rsvpEveryN: number; // pausa periódica a cada N palavras (0 = off)
  rsvpFade: boolean;
  rsvpFocus: boolean; // modo foco imersivo ao tocar
  // Layout editável
  showContinue: boolean; // bloco "Continuar" na home
  modeOrder: string[]; // ordem dos 3 modos da central
};

export const ACCENT_SWATCHES = [
  "#2dd4bf", "#38bdf8", "#818cf8", "#a78bfa",
  "#fb7185", "#fbbf24", "#34d399", "#94a3b8",
];

export const DEFAULTS: Prefs = {
  theme: "dark",
  brand: "#2dd4bf",
  readingWidth: 680,
  readingScale: 1,
  rsvpWpm: 350,
  rsvpPunctMult: 1.6,
  rsvpEveryN: 0,
  rsvpFade: true,
  rsvpFocus: true,
  showContinue: true,
  modeOrder: ["podcast", "read", "rsvp"],
};

const KEY = "books_prefs";

/** Aplica as preferências no <html> (classe de tema + CSS vars). */
export function applyPrefs(p: Prefs) {
  const r = document.documentElement;
  r.classList.remove("theme-dark", "theme-light", "theme-sepia", "dark");
  r.classList.add(`theme-${p.theme}`);
  if (p.theme === "dark") r.classList.add("dark");
  r.style.setProperty("--brand", p.brand);
  r.style.setProperty("--reading-width", `${p.readingWidth}px`);
  r.style.setProperty("--reading-scale", String(p.readingScale));
  // Layout editável aplicado via CSS (páginas continuam server components).
  p.modeOrder.forEach((k, i) => r.style.setProperty(`--order-${k}`, String(i)));
  r.classList.toggle("hide-continue", !p.showContinue);
}

type Ctx = {
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  reset: () => void;
};

const PreferencesContext = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    applyPrefs(prefs);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs, loaded]);

  const setPref = useCallback<Ctx["setPref"]>((key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  }, []);
  const reset = useCallback(() => setPrefs(DEFAULTS), []);

  return (
    <PreferencesContext.Provider value={{ prefs, setPref, reset }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePrefs(): Ctx {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePrefs precisa de <PreferencesProvider>");
  return ctx;
}

/** Script inline (anti-flash) — aplica o tema antes do primeiro paint. */
export const PREFS_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('${KEY}')||'{}');var t=p.theme||'dark';var r=document.documentElement;r.classList.remove('theme-dark','theme-light','theme-sepia','dark');r.classList.add('theme-'+t);if(t==='dark')r.classList.add('dark');if(p.brand)r.style.setProperty('--brand',p.brand);if(p.readingWidth)r.style.setProperty('--reading-width',p.readingWidth+'px');if(p.readingScale)r.style.setProperty('--reading-scale',p.readingScale);var mo=p.modeOrder||['podcast','read','rsvp'];mo.forEach(function(k,i){r.style.setProperty('--order-'+k,i)});if(p.showContinue===false)r.classList.add('hide-continue');}catch(e){}})();`;
