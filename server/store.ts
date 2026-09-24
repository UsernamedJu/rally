import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBand } from '../shared/catalog.ts';
import type { Activity, Band, ChallengeType, Per, Result, TrackType } from '../shared/catalog.ts';

export type User = {
  id: string;
  name: string;
  avatar: number;
  workoutTime: string;
  trackedTypes: TrackType[];
  notifications: boolean;
  /** Sets this person's own goal in a fair play challenge. */
  band: Band;
  token: string;
  createdAt: string;
  /** Digits only, no formatting. The portable credential — how you sign in on a new device. */
  phone: string | null;
  pinSalt: string | null;
  pinHash: string | null;
};
export type Crew = { userId: string; friendUserId: string };
export type Challenge = {
  id: string;
  creatorId: string | null;
  name: string;
  type: ChallengeType;
  target: number;
  per: Per;
  lengthDays: number;
  startAt: string;
  endAt: string; // exclusive
  status: 'waiting' | 'live' | 'done';
  houseChallenge: boolean;
  createdAt: string;
};
export type Member = {
  challengeId: string;
  userId: string;
  joinedAt: string;
  joinedDate: string;
  removedAt: string | null;
  result: Result | null;
};
export type Log = {
  id: string;
  checkinId: string;
  userId: string;
  challengeId: string | null;
  date: string;
  activity: Activity;
  type: ChallengeType | null;
  amount: number;
  createdAt: string;
};
export type Consequence = {
  challengeId: string;
  text: string | null;
  proposedBy: string | null;
  agreedBy: string[];
  status: 'none' | 'proposed' | 'agreed';
};
export type Invite = { token: string; challengeId: string | null; invitedBy: string; acceptedBy: string[]; createdAt: string };
export type Removal = {
  id: string;
  challengeId: string;
  userId: string;
  requestedBy: string;
  requestedAt: string;
  resolved: 'removed' | 'cancelled' | null;
};

export type DB = {
  users: User[];
  crew: Crew[];
  challenges: Challenge[];
  members: Member[];
  logs: Log[];
  consequences: Consequence[];
  invites: Invite[];
  removals: Removal[];
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const newId = (bytes = 6) => randomBytes(bytes).toString('base64url');
export const nowIso = () => new Date().toISOString();

// ---------- PIN hashing ----------
// A 4 digit PIN has little entropy on its own, which is exactly why it gets a deliberately
// slow hash (scrypt) rather than a fast one like sha256 — it raises the cost of guessing it.

export function hashPin(pin: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32).toString('hex');
  return { salt, hash };
}

export function verifyPin(pin: string, salt: string, hash: string): boolean {
  const check = scryptSync(pin, salt, 32);
  const stored = Buffer.from(hash, 'hex');
  return check.length === stored.length && timingSafeEqual(check, stored);
}

/** Digits only. Keeps the last 10, so "+1 (555) 010-2030" and "5550102030" match. */
export function normalizePhone(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\D/g, '').slice(-10) : '';
}

export const isPin = (v: unknown): v is string => typeof v === 'string' && /^\d{4}$/.test(v);

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = process.env.DATA_FILE ?? join(here, 'data', 'db.json');

// House challenges have no creator and no fixed dates. Each member runs their own window
// starting the day they join.
const HOUSE: Pick<Challenge, 'id' | 'name' | 'type' | 'target' | 'per' | 'lengthDays'>[] = [
  { id: 'house-walk7', name: '7 day walk', type: 'walk', target: 1, per: 'day', lengthDays: 7 },
  { id: 'house-10k', name: '10k steps', type: 'steps', target: 10000, per: 'day', lengthDays: 14 },
  { id: 'house-gym2', name: 'Gym twice', type: 'gym', target: 2, per: 'week', lengthDays: 28 },
  { id: 'house-class', name: 'Class of the week', type: 'class', target: 1, per: 'week', lengthDays: 28 },
  { id: 'house-20mi', name: '20 miles', type: 'miles', target: 20, per: 'total', lengthDays: 28 },
];

// The file is small enough to read on every request, which also lets the seed script
// edit it while the server is running.
export function load(): DB {
  const db: DB = { users: [], crew: [], challenges: [], members: [], logs: [], consequences: [], invites: [], removals: [] };
  if (existsSync(DATA_FILE)) Object.assign(db, JSON.parse(readFileSync(DATA_FILE, 'utf8')));
  for (const u of db.users) {
    if (!isBand(u.band)) u.band = 'active';
    if (u.phone === undefined) u.phone = null;
    if (u.pinSalt === undefined) u.pinSalt = null;
    if (u.pinHash === undefined) u.pinHash = null;
  }
  for (const h of HOUSE) {
    if (db.challenges.some((c) => c.id === h.id)) continue;
    const created = nowIso();
    db.challenges.push({ ...h, creatorId: null, startAt: created.slice(0, 10), endAt: '9999-12-31', status: 'live', houseChallenge: true, createdAt: created });
  }
  return db;
}

export function save(db: DB): void {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DATA_FILE);
}
