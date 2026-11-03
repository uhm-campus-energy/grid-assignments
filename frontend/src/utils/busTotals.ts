import { KwData } from '../types/kwData';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STEP_MS = 15 * 60 * 1000;

export const busOf = (m: { substation_meter: string | null }) => m.substation_meter ?? 'Null';

// Parse a raw "2026-1-1 11:45:00" datetime string as UTC ms, so string order
// ("2026-1-10" < "2026-1-9") and timezones don't matter.
export function parseDt(s: string): number {
  const [datePart, timePart = ''] = s.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh = 0, mm = 0] = timePart.split(':').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1, hh, mm);
}

const fmtDay = (t: number) => {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};
export const fmtTime = (t: number) => new Date(t).toISOString().slice(11, 16);

// "Jan 1, 2026 · 10:15–14:30", or a single time when the run is one step.
export function fmtRun(start: number, end: number): string {
  if (start === end) return `${fmtDay(start)} · ${fmtTime(start)}`;
  const sameDay = fmtDay(start) === fmtDay(end);
  return `${fmtDay(start)} · ${fmtTime(start)}–${sameDay ? '' : `${fmtDay(end)} · `}${fmtTime(end)}`;
}

// Demand and PV summed over a bus's meters at each 15-minute step, in time order.
export interface Series {
  times: string[];
  demand: number[];
  pv: number[];
}

// Sum demand and PV per bus. busByMeter says which bus each meter is on;
// meters missing from it are left out, and so are rows with no timestamp
// (meters with no time series come back as one empty row).
export function sumByBus(kwData: KwData[], busByMeter: Record<string, string>): Record<string, Series> {
  const acc: Record<string, Record<string, { demand: number; pv: number }>> = {};
  kwData.forEach((d) => {
    const bus = busByMeter[d.meter_name];
    if (bus == null || !d.datetime_str) return;
    const steps = (acc[bus] ??= {});
    const step = (steps[d.datetime_str] ??= { demand: 0, pv: 0 });
    step.demand += d.demand_kw || 0;
    step.pv += d.pv_production_kw || 0;
  });
  const result: Record<string, Series> = {};
  Object.entries(acc).forEach(([bus, steps]) => {
    const times = Object.keys(steps).sort((a, b) => parseDt(a) - parseDt(b));
    result[bus] = {
      times,
      demand: times.map((t) => steps[t].demand),
      pv: times.map((t) => steps[t].pv),
    };
  });
  return result;
}

// Largest PV − demand over the day; above 0 means PV exceeds demand at some step.
export function peakSurplus(s: Series): number | null {
  if (s.times.length === 0) return null;
  return Math.max(...s.times.map((_, i) => s.pv[i] - s.demand[i]));
}

// The steps where PV is above demand, merged into runs of consecutive steps,
// each with its largest surplus.
export function exceedRuns(s: Series): { start: number; end: number; peak: number }[] {
  const runs: { start: number; end: number; peak: number }[] = [];
  s.times.forEach((time, i) => {
    const surplus = s.pv[i] - s.demand[i];
    if (surplus <= 0) return;
    const t = parseDt(time);
    const last = runs[runs.length - 1];
    if (last && t - last.end <= STEP_MS) {
      last.end = t;
      last.peak = Math.max(last.peak, surplus);
    } else {
      runs.push({ start: t, end: t, peak: surplus });
    }
  });
  return runs;
}
