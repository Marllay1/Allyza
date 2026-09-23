/** Pure cycle maths. Everything here is an OBSERVATION from her own data, never a prediction of fact. */

export type Period = { id: string; start_date: string; end_date: string | null };
export type DailyLog = {
  id?: string;
  log_date: string;
  is_period: boolean;
  flow: number | null;
  pain: number | null;
  pain_type: string | null;
  pain_duration_min: number | null;
  fatigue: number | null;
  mood: number | null;
  mood_tag: string | null;
  energy: number | null;
  sleep_bedtime: string | null;
  sleep_wake_time: string | null;
  sleep_quality: number | null;
  sugar_level: "low" | "moderate" | "high" | null;
  symptoms: string[];
  note: string | null;
};
export type FoodLog = { id: string; log_date: string; category: string; note: string | null };

const DAY = 86_400_000;

/** yyyy-mm-dd from a local Date (never toISOString: that shifts the day across time zones). */
export function toISODate(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const daysBetween = (a: string, b: string) => Math.round((parse(b) - parse(a)) / DAY);

export function addDays(iso: string, n: number): string {
  const d = new Date(parse(iso) + n * DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const sortedStarts = (periods: Period[]) => periods.map((p) => p.start_date).sort();

/** Lengths between consecutive period starts. */
export function cycleLengths(periods: Period[]): number[] {
  const s = sortedStarts(periods);
  return s.slice(1).map((d, i) => daysBetween(s[i], d));
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function currentCycleDay(periods: Period[], today: string): number | null {
  const last = sortedStarts(periods)
    .filter((d) => d <= today)
    .pop();
  if (!last) return null;
  const n = daysBetween(last, today) + 1;
  return n > 0 ? n : null;
}

export function periodDurations(periods: Period[]): number[] {
  return periods.filter((p) => p.end_date).map((p) => daysBetween(p.start_date, p.end_date!) + 1);
}

export type Stats = {
  cycleCount: number;
  avgCycle: number | null;
  minCycle: number | null;
  maxCycle: number | null;
  variability: number | null; // standard deviation, days
  avgPeriod: number | null;
  lengths: { start: string; days: number }[];
};

export function computeStats(periods: Period[]): Stats {
  const starts = sortedStarts(periods);
  const lens = cycleLengths(periods);
  const avg = mean(lens);
  const sd =
    avg !== null && lens.length > 1
      ? Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / (lens.length - 1))
      : null;
  return {
    cycleCount: lens.length,
    avgCycle: avg === null ? null : Math.round(avg),
    minCycle: lens.length ? Math.min(...lens) : null,
    maxCycle: lens.length ? Math.max(...lens) : null,
    variability: sd === null ? null : Math.round(sd * 10) / 10,
    avgPeriod: (() => {
      const m = mean(periodDurations(periods));
      return m === null ? null : Math.round(m * 10) / 10;
    })(),
    lengths: lens.map((days, i) => ({ start: starts[i + 1], days })),
  };
}

export const MIN_CYCLES_FOR_STATS = 3;
export const MIN_LOGS_FOR_TRENDS = 7;

/** Averages of a numeric field over rolling windows (for trend lines). */
export function series(logs: DailyLog[], field: "pain" | "fatigue" | "mood" | "energy", days = 60) {
  const cutoff = addDays(toISODate(), -days);
  return logs
    .filter((l) => l.log_date >= cutoff && l[field] !== null)
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .map((l) => ({ date: l.log_date, value: l[field] as number }));
}

export function trendDirection(points: { value: number }[]): "up" | "down" | "flat" | null {
  if (points.length < 6) return null;
  const half = Math.floor(points.length / 2);
  const a = mean(points.slice(0, half).map((p) => p.value))!;
  const b = mean(points.slice(-half).map((p) => p.value))!;
  if (Math.abs(b - a) < 0.75) return "flat";
  return b > a ? "up" : "down";
}

export function sugarPattern(logs: DailyLog[], days = 60) {
  const cutoff = addDays(toISODate(), -days);
  const rec = logs.filter((l) => l.log_date >= cutoff && l.sugar_level);
  const count = (v: string) => rec.filter((l) => l.sugar_level === v).length;
  return { total: rec.length, low: count("low"), moderate: count("moderate"), high: count("high") };
}

/** Minutes asleep from "HH:MM" bedtime/wake times, assuming wake is the next occurrence after bedtime. */
export function sleepDurationMin(bedtime: string | null, wake: string | null): number | null {
  if (!bedtime || !wake) return null;
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const b = toMin(bedtime);
  const w = toMin(wake);
  return w > b ? w - b : 24 * 60 - b + w;
}

export function foodPattern(food: FoodLog[], days = 30) {
  const cutoff = addDays(toISODate(), -days);
  const out: Record<string, number> = {};
  for (const f of food) if (f.log_date >= cutoff) out[f.category] = (out[f.category] ?? 0) + 1;
  return out;
}
