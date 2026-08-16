import type { DailyStats, Streak } from "./types";

/** Data local em YYYY-MM-DD (não usa UTC: o "dia" é o do usuário). */
export function dayKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msPerDay = 86_400_000;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

export function fragmentsToday(stats: DailyStats[]): number {
  return stats.find((s) => s.day === dayKey())?.fragments ?? 0;
}

/** Soma +1 fragmento no dia de hoje, mantendo só os últimos 120 dias. */
export function bumpToday(stats: DailyStats[]): DailyStats[] {
  const today = dayKey();
  const idx = stats.findIndex((s) => s.day === today);
  const next =
    idx >= 0
      ? stats.map((s, i) => (i === idx ? { ...s, fragments: s.fragments + 1 } : s))
      : [...stats, { day: today, fragments: 1 }];
  return next.slice(-120);
}

/**
 * Atualiza o streak quando a meta do dia é batida.
 * Dia seguido → +1; mesmo dia → nada; buraco → recomeça em 1.
 */
export function bumpStreak(streak: Streak): Streak {
  const today = dayKey();
  if (streak.lastDay === today) return streak;
  const gap = streak.lastDay ? daysBetween(streak.lastDay, today) : Infinity;
  const current = gap === 1 ? streak.current + 1 : 1;
  return { current, best: Math.max(current, streak.best), lastDay: today };
}

/**
 * O streak "vence" se o último dia com meta batida não é hoje nem ontem.
 * Só para exibição — o valor guardado é corrigido no próximo `bumpStreak`.
 */
export function displayStreak(streak: Streak): number {
  if (!streak.lastDay) return 0;
  const gap = daysBetween(streak.lastDay, dayKey());
  return gap <= 1 ? streak.current : 0;
}

/** Últimos `n` dias (mais antigo → mais recente) para o gráfico de barras. */
export function lastDays(stats: DailyStats[], n: number): DailyStats[] {
  const byDay = new Map(stats.map((s) => [s.day, s.fragments]));
  const out: DailyStats[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    out.push({ day: key, fragments: byDay.get(key) ?? 0 });
  }
  return out;
}
