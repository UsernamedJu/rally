// Shared by the app and the API server. The server runs this file directly with Node's
// type stripping, so: explicit .ts imports, `import type` for types, no enums.

export type ChallengeType = 'gym' | 'walk' | 'run' | 'bike' | 'class' | 'steps' | 'miles' | 'custom';
export type TrackType = Exclude<ChallengeType, 'custom'>;
export type Activity = 'gym' | 'walk' | 'run' | 'bike' | 'class' | 'sport' | 'other';
export type Per = 'day' | 'week' | 'total';
export type Tone = 'friendly' | 'playful' | 'jab';
export type Result = 'won' | 'finished' | 'dropped';
export type Band = 'starting' | 'active' | 'very';

type TypeInfo = {
  label: string;
  one: string;
  many: string;
  numeric: boolean;
  defaultPer: 'day' | 'week';
  defaultTarget: number;
  defaultName: string;
  noun: string;
};

export const TYPES: Record<ChallengeType, TypeInfo> = {
  gym: { label: 'Gym sessions', one: 'gym session', many: 'gym sessions', numeric: false, defaultPer: 'week', defaultTarget: 3, defaultName: 'Gym challenge', noun: 'gym' },
  walk: { label: 'Walks', one: 'walk', many: 'walks', numeric: false, defaultPer: 'week', defaultTarget: 3, defaultName: 'Walking challenge', noun: 'walking' },
  run: { label: 'Runs', one: 'run', many: 'runs', numeric: false, defaultPer: 'week', defaultTarget: 2, defaultName: 'Running challenge', noun: 'running' },
  bike: { label: 'Bike rides', one: 'bike ride', many: 'bike rides', numeric: false, defaultPer: 'week', defaultTarget: 2, defaultName: 'Bike challenge', noun: 'bike' },
  class: { label: 'Classes', one: 'class', many: 'classes', numeric: false, defaultPer: 'week', defaultTarget: 2, defaultName: 'Class challenge', noun: 'class' },
  steps: { label: 'Steps', one: 'step', many: 'steps', numeric: true, defaultPer: 'day', defaultTarget: 8000, defaultName: 'Steps challenge', noun: 'steps' },
  miles: { label: 'Miles', one: 'mile', many: 'miles', numeric: true, defaultPer: 'week', defaultTarget: 10, defaultName: 'Miles challenge', noun: 'miles' },
  custom: { label: 'Your own', one: 'session', many: 'sessions', numeric: false, defaultPer: 'week', defaultTarget: 3, defaultName: 'Challenge', noun: '' },
};

// ---------- fair play ----------
// A shared step target is not the same ask for everyone. Each person plays to their own
// number, scaled off the one the crew agreed on, and standings rank on percent of your own
// goal. Everyone can still read one sentence and know what they have to do today.

export const BANDS: { key: Band; label: string; hint: string; factor: number }[] = [
  { key: 'starting', label: 'Just getting started', hint: 'A walk here and there', factor: 0.8 },
  { key: 'active', label: 'Active most weeks', hint: 'You move a few times a week', factor: 1 },
  { key: 'very', label: 'Very active', hint: 'You train most days', factor: 1.25 },
];

export const isBand = (v: unknown): v is Band => BANDS.some((b) => b.key === v);
export const bandFactor = (b: Band) => BANDS.find((x) => x.key === b)?.factor ?? 1;
export const bandLabel = (b: Band) => BANDS.find((x) => x.key === b)?.label ?? '';

/**
 * Fair play only touches numbers that measure a body: steps and miles. Turning up to the gym
 * three times is the same ask for everyone, so session counts stay flat. House challenges stay
 * flat too, because a fixed public number is what lets strangers compare.
 */
export function fairPlay(type: ChallengeType, house: boolean): boolean {
  return !house && TYPES[type].numeric;
}

/** Scaled, then rounded to a number a person would actually say out loud. */
export function personalTarget(type: ChallengeType, base: number, band: Band, house = false): number {
  if (!fairPlay(type, house)) return base;
  const raw = base * bandFactor(band);
  if (type === 'steps') return Math.max(500, Math.round(raw / 250) * 250);
  return Math.max(0.5, Math.round(raw * 2) / 2);
}

export const TRACK_TYPES: TrackType[] = ['gym', 'walk', 'run', 'bike', 'class', 'steps', 'miles'];

export const ACTIVITIES: { key: Activity; label: string; fits: ChallengeType[]; tracks: TrackType | null }[] = [
  { key: 'gym', label: 'Gym', fits: ['gym', 'custom'], tracks: 'gym' },
  { key: 'walk', label: 'Walk', fits: ['walk', 'steps', 'miles'], tracks: 'walk' },
  { key: 'run', label: 'Run', fits: ['run', 'steps', 'miles'], tracks: 'run' },
  { key: 'bike', label: 'Bike', fits: ['bike', 'miles'], tracks: 'bike' },
  { key: 'class', label: 'Class', fits: ['class', 'custom'], tracks: 'class' },
  { key: 'sport', label: 'Sport', fits: ['steps', 'miles', 'custom'], tracks: null },
  { key: 'other', label: 'Other', fits: ['custom', 'steps', 'miles'], tracks: null },
];

export const LENGTHS = [
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 28, label: '1 month' },
];

export function range(from: number, to: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out;
}

// Session challenges allow one log a day, so a weekly target tops out at 7 and a daily one is 1.
export function targetOptions(type: ChallengeType, per: Per): number[] {
  if (type === 'steps') return range(2000, 20000, 500);
  if (type === 'miles') return range(1, 50);
  return per === 'day' ? [1] : range(1, 7);
}

export function logOptions(type: ChallengeType): number[] {
  return type === 'steps' ? range(500, 30000, 500) : range(0.5, 30, 0.5);
}

export function fmt(n: number): string {
  const [whole, dec] = String(Math.round(n * 10) / 10).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? `.${dec}` : '');
}

export function unit(type: ChallengeType, n: number): string {
  return n === 1 ? TYPES[type].one : TYPES[type].many;
}

export type TargetSpec = { type: ChallengeType; target: number; per: Per; lengthDays: number };

export function weeksText(days: number): string {
  return days === 7 ? '1 week' : `${Math.round(days / 7)} weeks`;
}

/** "3 gym sessions a week" */
export function targetShort(c: TargetSpec): string {
  if (c.per === 'total') return `${fmt(c.target)} ${unit(c.type, c.target)} total`;
  return `${fmt(c.target)} ${unit(c.type, c.target)} a ${c.per}`;
}

/** "3 gym sessions a week for 4 weeks." */
export function targetText(c: TargetSpec): string {
  return `${targetShort(c)} ${c.per === 'total' ? 'in' : 'for'} ${weeksText(c.lengthDays)}.`;
}

export function periodWord(per: Per): string {
  return per === 'day' ? 'today' : per === 'week' ? 'this week' : '';
}

// Dates are plain YYYY-MM-DD strings in the user's local calendar. The app sends its own
// "today" with every request so the server never guesses a time zone.
const DAY_MS = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const pad = (n: number) => String(n).padStart(2, '0');

export const addDays = (d: string, n: number) => new Date(ms(d) + n * DAY_MS).toISOString().slice(0, 10);
export const diffDays = (a: string, b: string) => Math.round((ms(a) - ms(b)) / DAY_MS);
export const isDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shortDate(d: string): string {
  const t = new Date(ms(d));
  return `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}`;
}

export function longDate(d: string): string {
  return `${WEEKDAYS[new Date(ms(d)).getUTCDay()]}, ${shortDate(d)}`;
}

export function rangeText(start: string, endExclusive: string): string {
  return `${shortDate(start)} to ${shortDate(addDays(endExclusive, -1))}`;
}

export function daysLeftText(n: number): string {
  if (n <= 0) return 'Ended';
  return n === 1 ? 'Last day' : `${n} days left`;
}

export function mondayOf(d: string): string {
  return addDays(d, -((new Date(ms(d)).getUTCDay() + 6) % 7));
}

export const TIMES = range(0, 47).map((i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`);

export function timeLabel(hhmm: string): string {
  const h = +hhmm.slice(0, 2);
  const suffix = h < 12 ? 'am' : 'pm';
  return `${h % 12 === 0 ? 12 : h % 12}:${hhmm.slice(3, 5)} ${suffix}`;
}
