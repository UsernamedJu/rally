import {
  ACTIVITIES, TIMES, TRACK_TYPES, TYPES, addDays, daysLeftText, diffDays, fairPlay, fmt, isBand, mondayOf,
  periodWord, personalTarget, rangeText, targetOptions, targetShort, targetText, unit,
} from '../shared/catalog.ts';
import type { Activity, Band, TrackType } from '../shared/catalog.ts';
import { offLimitsReason } from '../shared/copy.ts';
import type {
  ChallengeCard, ChallengeDetail, CheckinData, CheckinResult, ConsequenceView, FriendData, HomeData,
  HouseCard, InvitePreview, Me, MeData, PastRow, Person, SignupResult,
} from '../shared/api.ts';
import { HttpError, hashPin, isPin, newId, normalizePhone, nowIso, verifyPin } from './store.ts';
import type { Challenge, DB, Invite, Member, User } from './store.ts';

// ---------- lookups ----------

export const person = (u: User): Person => ({ id: u.id, name: u.name, avatar: u.avatar });

export const meView = (u: User): Me => ({
  ...person(u), workoutTime: u.workoutTime, trackedTypes: u.trackedTypes, notifications: u.notifications,
  band: u.band, phone: u.phone, hasPin: !!u.pinHash,
});

const userById = (db: DB, id: string | null) => db.users.find((u) => u.id === id);

export function challengeById(db: DB, id: string): Challenge {
  const ch = db.challenges.find((c) => c.id === id);
  if (!ch) throw new HttpError(404, 'Challenge not found.');
  return ch;
}

export function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Latest membership row. House challenges can be rejoined, so a user may have several. */
export function memberOf(db: DB, ch: Challenge, userId: string | undefined): Member | undefined {
  let found: Member | undefined;
  for (const m of db.members) {
    if (m.challengeId === ch.id && m.userId === userId && (!found || m.joinedAt > found.joinedAt)) found = m;
  }
  return found;
}

/** One row per person who has not been removed. */
function roster(db: DB, ch: Challenge): Member[] {
  const latest = new Map<string, Member>();
  for (const m of db.members) {
    if (m.challengeId !== ch.id) continue;
    const prev = latest.get(m.userId);
    if (!prev || m.joinedAt > prev.joinedAt) latest.set(m.userId, m);
  }
  return [...latest.values()].filter((m) => !m.removedAt);
}

export function windowOf(ch: Challenge, m: Member) {
  if (ch.houseChallenge) return { start: m.joinedDate, end: addDays(m.joinedDate, ch.lengthDays) };
  return { start: ch.startAt, end: ch.endAt };
}

export function isActive(ch: Challenge, m: Member | undefined, today: string): m is Member {
  return !!m && !m.removedAt && !m.result && ch.status !== 'done' && today < windowOf(ch, m).end;
}

/** Who shows up in cards and standings. House challenges only show people currently in. */
function people(db: DB, ch: Challenge, today: string, viewerId?: string): Member[] {
  const all = roster(db, ch);
  return ch.houseChallenge ? all.filter((m) => m.userId === viewerId || isActive(ch, m, today)) : all;
}

function statusOf(db: DB, ch: Challenge): Challenge['status'] {
  if (ch.status === 'done') return 'done';
  if (ch.houseChallenge) return 'live';
  return roster(db, ch).length >= 2 ? 'live' : 'waiting';
}

function activeFor(db: DB, user: User, today: string) {
  return db.challenges
    .map((ch) => ({ ch, m: memberOf(db, ch, user.id) }))
    .filter((x): x is { ch: Challenge; m: Member } => isActive(x.ch, x.m, today))
    .sort((a, b) => b.m.joinedAt.localeCompare(a.m.joinedAt));
}

// ---------- scoring ----------
// Each period (a day or a week) earns credit up to the target, so extra sessions in one week
// can't cover a missed one. A "total" challenge is a single period and a race to the target.

type Progress = {
  /** This person's own number for one period. Everyone shares it unless fair play is on. */
  target: number;
  credit: number;
  total: number;
  current: number;
  complete: boolean;
  periodDone: boolean;
  finishedAt: string | null;
  lastLog: string | null;
  loggedToday: boolean;
};

const periodLen = (ch: Challenge) => (ch.per === 'day' ? 1 : ch.per === 'week' ? 7 : ch.lengthDays);
const periodCount = (ch: Challenge) => (ch.per === 'total' ? 1 : Math.ceil(ch.lengthDays / periodLen(ch)));

/** Everyone plays to their own number in a fair play challenge, the crew's number otherwise. */
export function targetFor(db: DB, ch: Challenge, userId: string): number {
  const band: Band = userById(db, userId)?.band ?? 'active';
  return personalTarget(ch.type, ch.target, band, ch.houseChallenge);
}

/** How much of your own goal you have done. This is what standings rank on. */
const share = (p: Progress) => (p.total > 0 ? p.credit / p.total : 0);

/** `asOf` replays the challenge as it stood on an earlier day, for last week's ranking. */
function progressOf(db: DB, ch: Challenge, m: Member, today: string, asOf = today): Progress {
  const { start, end } = windowOf(ch, m);
  const target = targetFor(db, ch, m.userId);
  const len = periodLen(ch);
  const count = periodCount(ch);
  const sums = new Array<number>(count).fill(0);
  const total = target * count;
  const logs = db.logs
    .filter((l) => l.challengeId === ch.id && l.userId === m.userId && l.date >= start && l.date < end && l.date <= asOf)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let credit = 0;
  let finishedAt: string | null = null;
  let lastLog: string | null = null;
  for (const l of logs) {
    const i = Math.floor(diffDays(l.date, start) / len);
    const before = Math.min(sums[i], target);
    sums[i] += l.amount;
    credit += Math.min(sums[i], target) - before;
    if (!finishedAt && credit >= total) finishedAt = l.createdAt;
    if (!lastLog || l.date > lastLog) lastLog = l.date;
  }
  const now = Math.min(count - 1, Math.max(0, Math.floor(diffDays(today, start) / len)));
  const current = ch.per === 'total' ? credit : sums[now];
  return {
    target, credit, total, current, finishedAt, lastLog,
    complete: credit >= total,
    periodDone: current >= target,
    loggedToday: logs.some((l) => l.date === today),
  };
}

function progressText(ch: Challenge, p: Progress): string {
  const numeric = TYPES[ch.type].numeric;
  if (ch.per === 'total') return `${fmt(p.credit)} of ${fmt(p.target)} ${unit(ch.type, p.target)}`;
  return `${fmt(p.current)} of ${fmt(p.target)}${numeric ? ` ${unit(ch.type, p.target)}` : ''} ${periodWord(ch.per)}`;
}

/**
 * Standard competition ranking on percent of your own goal, so 1, 1, 3 for a tie at the top.
 */
function ranksOf(rows: { id: string; share: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  let rank = 0;
  let prev = NaN;
  [...rows].sort((a, b) => b.share - a.share).forEach((r, i) => {
    if (r.share !== prev) {
      rank = i + 1;
      prev = r.share;
    }
    out.set(r.id, rank);
  });
  return out;
}

function finish(db: DB, ch: Challenge, today: string): void {
  ch.status = 'done';
  const rows = roster(db, ch).filter((m) => !m.result).map((m) => ({ m, p: progressOf(db, ch, m, today) }));
  const winners = new Set<string>();
  if (rows.length >= 2) {
    if (ch.per === 'total') {
      const first = rows.filter((r) => r.p.finishedAt).sort((a, b) => a.p.finishedAt!.localeCompare(b.p.finishedAt!))[0];
      if (first) winners.add(first.m.userId);
    } else {
      const best = Math.max(...rows.map((r) => share(r.p)));
      const top = rows.filter((r) => share(r.p) === best);
      if (best > 0 && top.length < rows.length) top.forEach((r) => winners.add(r.m.userId));
    }
  }
  for (const r of rows) r.m.result = winners.has(r.m.userId) ? 'won' : 'finished';
}

/** Applies anything that became due since the last request: removals and finished challenges. */
export function settle(db: DB, today: string, now = Date.now()): boolean {
  let changed = false;
  for (const r of db.removals) {
    if (r.resolved) continue;
    const ch = db.challenges.find((c) => c.id === r.challengeId);
    const m = ch && memberOf(db, ch, r.userId);
    const loggedSince = db.logs.some((l) => l.challengeId === r.challengeId && l.userId === r.userId && l.createdAt > r.requestedAt);
    if (!ch || !isActive(ch, m, today) || loggedSince) {
      r.resolved = 'cancelled';
      changed = true;
    } else if (now - Date.parse(r.requestedAt) >= 86400000) {
      m.removedAt = new Date(now).toISOString();
      m.result = 'dropped';
      r.resolved = 'removed';
      changed = true;
    }
  }
  for (const ch of db.challenges) {
    if (ch.houseChallenge) {
      for (const m of db.members) {
        if (m.challengeId === ch.id && !m.result && !m.removedAt && today >= windowOf(ch, m).end) {
          m.result = 'finished';
          changed = true;
        }
      }
    } else if (ch.status !== 'done' && today >= ch.endAt) {
      finish(db, ch, today);
      changed = true;
    }
  }
  return changed;
}

function streaks(db: DB, userId: string, today: string) {
  const days = new Set(db.logs.filter((l) => l.userId === userId && l.date <= today).map((l) => l.date));
  let current = 0;
  for (let d = days.has(today) ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) current++;
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...days].sort()) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest };
}

// ---------- views ----------

function cardFor(db: DB, ch: Challenge, m: Member, today: string): ChallengeCard {
  const p = progressOf(db, ch, m, today);
  const status = statusOf(db, ch);
  const who = people(db, ch, today).map((x) => userById(db, x.userId)).filter((u): u is User => !!u);
  return {
    id: ch.id,
    name: ch.name,
    targetShort: targetShort(ch),
    progressText: progressText(ch, p),
    fraction: Math.min(1, p.current / p.target),
    periodDone: p.periodDone,
    complete: p.complete,
    members: who.slice(0, 5).map(person),
    memberCount: who.length,
    daysLeftText: daysLeftText(diffDays(windowOf(ch, m).end, today)),
    waiting: status === 'waiting',
    live: status === 'live',
  };
}

export function homeFor(db: DB, user: User, today: string): HomeData {
  const crew = db.crew
    .filter((c) => c.userId === user.id)
    .map((c) => userById(db, c.friendUserId))
    .filter((u): u is User => !!u)
    .map((f) => ({ ...person(f), loggedToday: db.logs.some((l) => l.userId === f.id && l.date === today) }));
  return { user: meView(user), crew, challenges: activeFor(db, user, today).map(({ ch, m }) => cardFor(db, ch, m, today)) };
}

export function friendFor(db: DB, viewer: User, friendId: string): FriendData {
  const inCrew = db.crew.some((c) => c.userId === viewer.id && c.friendUserId === friendId);
  const friend = userById(db, friendId);
  if (!inCrew || !friend) throw new HttpError(404, 'Not in your crew.');
  const rows = db.members.filter((m) => m.userId === friendId && (m.result === 'won' || m.result === 'finished'));
  const wins = rows
    .filter((m) => m.result === 'won')
    .map((m) => ({ ch: challengeById(db, m.challengeId), size: roster(db, challengeById(db, m.challengeId)).length }))
    .sort((a, b) => b.size - a.size || b.ch.endAt.localeCompare(a.ch.endAt));
  return { ...person(friend), completed: rows.length, biggestWin: wins[0]?.ch.name ?? null };
}

export function meFor(db: DB, user: User, today: string): MeData {
  const { current, longest } = streaks(db, user.id, today);
  const rows = db.members.filter((m) => m.userId === user.id);
  const monday = mondayOf(today);
  const todayIndex = diffDays(today, monday);

  // One check-in can count toward several challenges; group rows so nothing is counted twice.
  const checkins = new Map<string, typeof db.logs>();
  for (const l of db.logs) {
    if (l.userId !== user.id || l.date < monday || l.date > today) continue;
    checkins.set(l.checkinId, [...(checkins.get(l.checkinId) ?? []), l]);
  }
  const tracked = user.trackedTypes.map((type) => {
    const days = new Array<number>(7).fill(0);
    for (const group of checkins.values()) {
      const i = diffDays(group[0].date, monday);
      if (type === 'steps' || type === 'miles') {
        days[i] += Math.max(0, ...group.filter((l) => l.type === type).map((l) => l.amount));
      } else if (ACTIVITIES.find((a) => a.key === group[0].activity)?.tracks === type) {
        days[i] += 1;
      }
    }
    const total = days.reduce((a, b) => a + b, 0);
    return {
      type,
      label: TYPES[type].label,
      totalText: `${fmt(total)} this week`,
      days: days.map((v, i) => (i > todayIndex ? null : v)),
      todayIndex,
    };
  });

  const past: (PastRow & { end: string })[] = [];
  for (const m of rows) {
    if (!m.result && !m.removedAt) continue;
    const ch = challengeById(db, m.challengeId);
    const w = windowOf(ch, m);
    const result = m.result === 'won' ? 'Won' : m.result === 'finished' ? 'Finished' : 'Dropped';
    past.push({ id: ch.id, name: ch.name, rangeText: rangeText(w.start, w.end), result, end: w.end });
  }
  past.sort((a, b) => b.end.localeCompare(a.end));

  return {
    user: meView(user),
    streak: current,
    longestStreak: longest,
    completed: rows.filter((m) => m.result === 'won' || m.result === 'finished').length,
    won: rows.filter((m) => m.result === 'won').length,
    tracked,
    past: past.map(({ end, ...row }) => row),
  };
}

export function checkinFor(db: DB, user: User, today: string): CheckinData {
  return {
    checkedIn: db.logs.some((l) => l.userId === user.id && l.date === today),
    streak: streaks(db, user.id, today).current,
    challenges: activeFor(db, user, today).map(({ ch, m }) => {
      const p = progressOf(db, ch, m, today);
      const info = TYPES[ch.type];
      return {
        id: ch.id, name: ch.name, type: ch.type, numeric: info.numeric, unitMany: info.many,
        loggedToday: !info.numeric && p.loggedToday,
        progressText: progressText(ch, p),
      };
    }),
  };
}

export function logCheckin(db: DB, user: User, today: string, body: any): CheckinResult {
  const activity = body?.activity as Activity;
  if (!ACTIVITIES.some((a) => a.key === activity)) throw new HttpError(400, 'Pick what you did.');
  const checkinId = newId();
  const createdAt = nowIso();
  const previous: Record<string, number> = {};
  const touched: { ch: Challenge; m: Member }[] = [];
  const entries: any[] = Array.isArray(body.entries) ? body.entries : [];
  for (const entry of entries) {
    const ch = db.challenges.find((c) => c.id === entry?.challengeId);
    const m = ch && memberOf(db, ch, user.id);
    if (!ch || !isActive(ch, m, today) || touched.some((t) => t.ch.id === ch.id)) continue;
    const numeric = TYPES[ch.type].numeric;
    const before = progressOf(db, ch, m, today);
    if (!numeric && before.loggedToday) continue; // one log a day for session challenges
    const amount = numeric ? Number(entry.amount) : 1;
    if (!(amount > 0 && amount <= 100000)) continue;
    previous[ch.id] = Math.min(1, before.current / before.target);
    db.logs.push({ id: newId(), checkinId, userId: user.id, challengeId: ch.id, date: today, activity, type: ch.type, amount, createdAt });
    touched.push({ ch, m });
  }
  if (!touched.length) {
    if (entries.length) throw new HttpError(409, 'Already logged today.');
    db.logs.push({ id: newId(), checkinId, userId: user.id, challengeId: null, date: today, activity, type: null, amount: 1, createdAt });
  }
  const cards = touched.map(({ ch, m }) => cardFor(db, ch, m, today));
  const streak = streaks(db, user.id, today).current;
  const line = cards.length
    ? `Logged. ${cards[0].progressText}.`
    : `Logged. ${streak === 1 ? 'Day one of your streak.' : `That's a ${streak} day streak.`}`;
  return { cards, previous, line, checkinId };
}

/**
 * Takes back a log made moments ago. Only today's, only your own, and by check-in id so one tap
 * removes everything that check-in counted toward. Logging is on the honor system, so there is
 * nothing to protect here beyond not touching anyone else's data or past days.
 */
export function undoCheckin(db: DB, user: User, today: string, body: any): { removed: number } {
  const id = String(body?.checkinId ?? '');
  const before = db.logs.length;
  db.logs = db.logs.filter((l) => !(l.checkinId === id && l.userId === user.id && l.date === today));
  const removed = before - db.logs.length;
  if (!removed) throw new HttpError(404, 'That log is already gone.');
  return { removed };
}

function consequenceView(db: DB, ch: Challenge, ids: string[], viewerId?: string): ConsequenceView {
  const c = db.consequences.find((x) => x.challengeId === ch.id);
  if (!c?.text) return { status: 'none', text: null, proposedBy: null, youProposed: false, youAgreed: false, waitingOn: 0 };
  const agreed = ids.filter((id) => c.agreedBy.includes(id)).length;
  return {
    status: ids.length >= 2 && agreed === ids.length ? 'agreed' : 'proposed',
    text: c.text,
    proposedBy: userById(db, c.proposedBy)?.name ?? null,
    youProposed: c.proposedBy === viewerId,
    youAgreed: !!viewerId && c.agreedBy.includes(viewerId),
    waitingOn: ids.length - agreed,
  };
}

function syncConsequence(db: DB, ch: Challenge): void {
  const c = db.consequences.find((x) => x.challengeId === ch.id);
  if (c) c.status = consequenceView(db, ch, roster(db, ch).map((m) => m.userId)).status;
}

export function detailFor(db: DB, ch: Challenge, viewer: User | null, today: string): ChallengeDetail {
  const mine = viewer ? memberOf(db, ch, viewer.id) : undefined;
  const active = isActive(ch, mine, today);
  const status = statusOf(db, ch);
  const w = mine ? windowOf(ch, mine) : ch.houseChallenge ? { start: today, end: addDays(today, ch.lengthDays) } : { start: ch.startAt, end: ch.endAt };
  const finished = status === 'done' || (!!mine && !active);

  const fair = fairPlay(ch.type, ch.houseChallenge);
  const rows = people(db, ch, today, viewer?.id)
    .map((m) => ({ m, p: progressOf(db, ch, m, today), u: userById(db, m.userId) }))
    .filter((r): r is { m: Member; p: Progress; u: User } => !!r.u)
    .sort((a, b) =>
      share(b.p) - share(a.p) ||
      (a.p.finishedAt ?? '~').localeCompare(b.p.finishedAt ?? '~') ||
      a.u.name.localeCompare(b.u.name));

  const daysIn = diffDays(today, w.start);
  const rank = ranksOf(rows.map((r) => ({ id: r.u.id, share: share(r.p) })));
  // Movement only means something once there is a week of challenge behind it.
  const lastWeek = daysIn >= 7
    ? ranksOf(rows.map((r) => ({ id: r.u.id, share: share(progressOf(db, ch, r.m, today, addDays(today, -7))) })))
    : null;

  const open = rows.filter((r) => !r.p.complete);
  const lowest = open.length ? Math.min(...open.map((r) => share(r.p))) : null;
  const allTied = rows.every((r) => share(r.p) === share(rows[0].p));
  // Nobody is last place on day one. The challenge has to have been running a few days and
  // somebody has to have actually done something before the app starts pointing at anyone.
  const settledIn = rows.length >= 2 && daysIn >= Math.min(3, Math.ceil(ch.lengthDays / 4));
  const hookShown = !ch.houseChallenge && settledIn && lowest !== null && !allTied && rows.some((r) => r.p.credit > 0);

  const mineRow = rows.find((r) => r.u.id === viewer?.id);
  const wonRows = roster(db, ch).filter((m) => m.result === 'won');
  const winnerNames = wonRows.map((m) => userById(db, m.userId)?.name).filter((n): n is string => !!n);
  const youWon = mine?.result === 'won';
  const winnerName = youWon ? 'You' : winnerNames[0] ?? null;
  const resultText = !finished || !mine?.result
    ? null
    : mine.result === 'dropped'
      ? 'You were dropped from this one.'
      : youWon
        ? 'You won.'
        : winnerName
          ? `${winnerName} won this one.`
          : mineRow?.p.complete
            ? 'You finished it.'
            : 'Finished.';

  const alerts = db.removals
    .filter((r) => r.challengeId === ch.id && !r.resolved)
    .map((r) => {
      const m = memberOf(db, ch, r.userId);
      const since = m ? diffDays(today, progressOf(db, ch, m, today).lastLog ?? m.joinedDate) : 0;
      if (r.userId === viewer?.id) {
        return since >= 2 ? `You haven't logged in ${since} days. Log by tomorrow to stay in.` : 'Log by tomorrow to stay in this challenge.';
      }
      const name = userById(db, r.userId)?.name ?? 'Someone';
      const lead = since >= 2 ? `${name} hasn't logged in ${since} days.` : since === 1 ? `${name} hasn't logged since yesterday.` : `${name} is up for removal.`;
      return `${lead} Removing tomorrow unless they log.`;
    });

  const commissioner = active && !ch.houseChallenge && ch.creatorId === viewer?.id;
  return {
    id: ch.id,
    name: ch.name,
    targetText: targetText(ch),
    type: ch.type,
    target: ch.target,
    per: ch.per,
    lengthDays: ch.lengthDays,
    numeric: TYPES[ch.type].numeric,
    house: ch.houseChallenge,
    status,
    daysLeftText: finished ? 'Finished' : daysLeftText(diffDays(w.end, today)),
    timeFraction: finished ? 1 : Math.min(1, Math.max(0, diffDays(today, w.start) / ch.lengthDays)),
    rangeText: rangeText(w.start, w.end),
    consequence: ch.houseChallenge ? null : consequenceView(db, ch, rows.map((r) => r.u.id), viewer?.id),
    hero: {
      rank: mineRow ? `#${rank.get(mineRow.u.id)}` : '—',
      progress: mineRow ? `${Math.round(share(mineRow.p) * 100)}%` : '—',
      people: String(rows.length),
    },
    fair,
    yourGoalText: fair && mineRow ? targetShort({ ...ch, target: mineRow.p.target }) : null,
    winnerName,
    resultText,
    standings: rows.map((r) => {
      const now = rank.get(r.u.id) ?? 1;
      const moved = lastWeek ? (lastWeek.get(r.u.id) ?? now) - now : 0;
      return {
        ...person(r.u),
        rank: now,
        fraction: share(r.p),
        percent: Math.round(share(r.p) * 100),
        label: `${fmt(r.p.credit)} of ${fmt(r.p.total)}`,
        goalText: fair ? targetShort({ ...ch, target: r.p.target }) : null,
        delta: moved > 0 ? `+${moved}` : moved < 0 ? String(moved) : null,
        isYou: r.u.id === viewer?.id,
        onTheHook: hookShown && !r.p.complete && share(r.p) === lowest,
        complete: r.p.complete,
      };
    }),
    members: rows.map((r) => person(r.u)),
    alerts,
    you: { member: active, commissioner, readOnly: !active, result: mine?.result ?? null },
    manage: commissioner
      ? rows
        .filter((r) => r.u.id !== viewer?.id)
        .map((r) => ({ ...person(r.u), pending: db.removals.some((x) => x.challengeId === ch.id && x.userId === r.u.id && !x.resolved) }))
      : [],
  };
}

export function canView(db: DB, ch: Challenge, user: User): boolean {
  return ch.houseChallenge || db.members.some((m) => m.challengeId === ch.id && m.userId === user.id);
}

export function houseFor(db: DB, user: User, today: string): HouseCard[] {
  return db.challenges
    .filter((ch) => ch.houseChallenge)
    .map((ch) => ({
      id: ch.id,
      name: ch.name,
      targetText: targetText(ch),
      memberCount: roster(db, ch).filter((m) => isActive(ch, m, today)).length,
      joined: isActive(ch, memberOf(db, ch, user.id), today),
    }));
}

// ---------- writes ----------

export function join(db: DB, ch: Challenge, user: User, today: string): void {
  if (isActive(ch, memberOf(db, ch, user.id), today)) return;
  if (ch.status === 'done') throw new HttpError(409, 'This challenge has ended.');
  db.members.push({ challengeId: ch.id, userId: user.id, joinedAt: nowIso(), joinedDate: today, removedAt: null, result: null });
  // The invite shows the consequence before anyone joins, so joining counts as agreeing to it.
  const c = db.consequences.find((x) => x.challengeId === ch.id);
  if (c?.text && !c.agreedBy.includes(user.id)) c.agreedBy.push(user.id);
  if (!ch.houseChallenge && roster(db, ch).length >= 2) ch.status = 'live';
  syncConsequence(db, ch);
}

export function inviteFor(db: DB, user: User, challengeId: string | null): string {
  const existing = db.invites.find((i) => i.invitedBy === user.id && i.challengeId === challengeId);
  if (existing) return existing.token;
  const token = newId(5);
  db.invites.push({ token, challengeId, invitedBy: user.id, acceptedBy: [], createdAt: nowIso() });
  return token;
}

export function inviteByToken(db: DB, token: string): Invite {
  const invite = db.invites.find((i) => i.token === token);
  if (!invite) throw new HttpError(404, 'This invite link does not work anymore.');
  return invite;
}

export function invitePreview(db: DB, invite: Invite, viewer: User | null, today: string): InvitePreview {
  const ch = invite.challengeId ? challengeById(db, invite.challengeId) : null;
  return {
    token: invite.token,
    inviterName: userById(db, invite.invitedBy)?.name ?? 'A friend',
    challenge: ch ? detailFor(db, ch, viewer, today) : null,
    alreadyMember: !!ch && !!viewer && isActive(ch, memberOf(db, ch, viewer.id), today),
    ended: ch?.status === 'done',
  };
}

export function acceptInvite(db: DB, invite: Invite, user: User, today: string): string | null {
  if (invite.invitedBy !== user.id) {
    for (const [a, b] of [[invite.invitedBy, user.id], [user.id, invite.invitedBy]]) {
      if (!db.crew.some((c) => c.userId === a && c.friendUserId === b)) db.crew.push({ userId: a, friendUserId: b });
    }
  }
  if (!invite.acceptedBy.includes(user.id)) invite.acceptedBy.push(user.id);
  if (invite.challengeId) join(db, challengeById(db, invite.challengeId), user, today);
  return invite.challengeId;
}

export function signup(db: DB, today: string, body: any): SignupResult {
  const name = cleanText(body?.name, 30);
  if (!name) throw new HttpError(400, 'Tell us what to call you.');
  const invite = body?.inviteToken ? inviteByToken(db, String(body.inviteToken)) : null;
  const inviteType = invite?.challengeId ? challengeById(db, invite.challengeId).type : null;
  const tracked = validTracked(body?.trackedTypes) ?? (inviteType && inviteType !== 'custom' ? [inviteType] : []);
  const user: User = {
    id: newId(),
    name,
    avatar: db.users.length % 6,
    workoutTime: TIMES.includes(body?.workoutTime) ? body.workoutTime : '07:00',
    trackedTypes: tracked,
    band: isBand(body?.band) ? body.band : 'active',
    notifications: true,
    token: newId(24),
    createdAt: nowIso(),
    phone: null,
    pinSalt: null,
    pinHash: null,
  };
  db.users.push(user);
  applyPhonePin(db, user, body);
  const challengeId = invite ? acceptInvite(db, invite, user, today) : null;
  return { token: user.token, user: meView(user), challengeId };
}

function validTracked(v: unknown): TrackType[] | null {
  if (!Array.isArray(v)) return null;
  const picked = TRACK_TYPES.filter((t) => v.includes(t));
  return picked.length >= 1 && picked.length <= 3 ? picked : null;
}

/** The portable credential — how someone signs back in on a device that doesn't already
 * remember them. Both fields are optional and can be set at signup or later from settings. */
function applyPhonePin(db: DB, user: User, body: any): void {
  if (body?.phone !== undefined) {
    const phone = normalizePhone(body.phone);
    if (!phone) {
      user.phone = null;
      user.pinSalt = null;
      user.pinHash = null;
    } else {
      if (phone.length !== 10) throw new HttpError(400, 'Enter a 10 digit phone number.');
      if (db.users.some((u) => u.id !== user.id && u.phone === phone)) {
        throw new HttpError(409, 'That phone number already has an account. Try signing in instead.');
      }
      user.phone = phone;
    }
  }
  if (body?.pin !== undefined) {
    if (!isPin(body.pin)) throw new HttpError(400, 'Enter a 4 digit PIN.');
    if (!user.phone) throw new HttpError(400, 'Add a phone number first.');
    const { salt, hash } = hashPin(body.pin);
    user.pinSalt = salt;
    user.pinHash = hash;
  }
}

export function updateMe(db: DB, user: User, body: any): Me {
  if (body?.name !== undefined) {
    const name = cleanText(body.name, 30);
    if (!name) throw new HttpError(400, 'Your name cannot be empty.');
    user.name = name;
  }
  if (TIMES.includes(body?.workoutTime)) user.workoutTime = body.workoutTime;
  if (body?.trackedTypes !== undefined) {
    const tracked = validTracked(body.trackedTypes);
    if (!tracked) throw new HttpError(400, 'Pick up to three things to track.');
    user.trackedTypes = tracked;
  }
  if (typeof body?.notifications === 'boolean') user.notifications = body.notifications;
  if (body?.band !== undefined) {
    if (!isBand(body.band)) throw new HttpError(400, 'Pick how active you are.');
    user.band = body.band;
  }
  applyPhonePin(db, user, body);
  return meView(user);
}

/** Signing in on a device that doesn't already remember you — the phone and PIN you set up
 * are the only portable credential this app has. */
export function signin(db: DB, body: any): SignupResult {
  const phone = normalizePhone(body?.phone);
  if (phone.length !== 10) throw new HttpError(400, 'Enter your 10 digit phone number.');
  if (!isPin(body?.pin)) throw new HttpError(400, 'Enter your 4 digit PIN.');
  const user = db.users.find((u) => u.phone === phone);
  const ok = !!user?.pinHash && !!user.pinSalt && verifyPin(body.pin, user.pinSalt, user.pinHash);
  if (!user || !ok) throw new HttpError(401, "That phone number and PIN don't match.");
  return { token: user.token, user: meView(user), challengeId: null };
}

export function createChallenge(db: DB, user: User, today: string, body: any): { id: string; token: string } {
  const type = body?.type;
  if (!(type in TYPES)) throw new HttpError(400, 'Pick a kind of challenge.');
  const per = body.per === 'day' ? 'day' : 'week';
  const lengthDays = Number(body.lengthDays);
  if (![7, 14, 28].includes(lengthDays)) throw new HttpError(400, 'Pick a length.');
  const target = Number(body.target);
  if (!targetOptions(type, per).includes(target)) throw new HttpError(400, 'Pick a target.');
  const customName = cleanText(body.name, 40);
  if (type === 'custom' && !customName) throw new HttpError(400, 'Name your challenge.');
  const consequence = cleanText(body.consequence, 80);
  const problem = consequence && offLimitsReason(consequence);
  if (problem) throw new HttpError(400, problem);

  const ch: Challenge = {
    id: newId(), creatorId: user.id, name: customName || TYPES[type as keyof typeof TYPES].defaultName,
    type, target, per, lengthDays, startAt: today, endAt: addDays(today, lengthDays),
    status: 'waiting', houseChallenge: false, createdAt: nowIso(),
  };
  db.challenges.push(ch);
  db.members.push({ challengeId: ch.id, userId: user.id, joinedAt: nowIso(), joinedDate: today, removedAt: null, result: null });
  db.consequences.push({
    challengeId: ch.id,
    text: consequence || null,
    proposedBy: consequence ? user.id : null,
    agreedBy: consequence ? [user.id] : [],
    status: consequence ? 'proposed' : 'none',
  });
  return { id: ch.id, token: inviteFor(db, user, ch.id) };
}

function requireMember(db: DB, ch: Challenge, user: User, today: string): Member {
  const m = memberOf(db, ch, user.id);
  if (!isActive(ch, m, today)) throw new HttpError(403, "You're not in this challenge.");
  return m;
}

function requireCommissioner(db: DB, ch: Challenge, user: User, today: string): void {
  requireMember(db, ch, user, today);
  if (ch.houseChallenge || ch.creatorId !== user.id) throw new HttpError(403, 'Only the person who started this can do that.');
}

export function proposeConsequence(db: DB, ch: Challenge, user: User, today: string, body: any): void {
  requireMember(db, ch, user, today);
  if (ch.houseChallenge) throw new HttpError(400, 'House challenges have no consequence.');
  const text = cleanText(body?.text, 80);
  if (!text) throw new HttpError(400, 'Pick or write a consequence.');
  const problem = offLimitsReason(text);
  if (problem) throw new HttpError(400, problem);
  let c = db.consequences.find((x) => x.challengeId === ch.id);
  if (!c) db.consequences.push((c = { challengeId: ch.id, text: null, proposedBy: null, agreedBy: [], status: 'none' }));
  c.text = text;
  c.proposedBy = user.id;
  c.agreedBy = [user.id];
  syncConsequence(db, ch);
}

export function agreeConsequence(db: DB, ch: Challenge, user: User, today: string): void {
  requireMember(db, ch, user, today);
  const c = db.consequences.find((x) => x.challengeId === ch.id);
  if (!c?.text) throw new HttpError(400, 'Nothing to agree to yet.');
  if (!c.agreedBy.includes(user.id)) c.agreedBy.push(user.id);
  syncConsequence(db, ch);
}

export function requestRemoval(db: DB, ch: Challenge, user: User, today: string, body: any): void {
  requireCommissioner(db, ch, user, today);
  const targetId = String(body?.userId ?? '');
  if (targetId === user.id || !isActive(ch, memberOf(db, ch, targetId), today)) throw new HttpError(400, "They're not in this challenge.");
  if (db.removals.some((r) => r.challengeId === ch.id && r.userId === targetId && !r.resolved)) return;
  db.removals.push({ id: newId(), challengeId: ch.id, userId: targetId, requestedBy: user.id, requestedAt: nowIso(), resolved: null });
}

export function endEarly(db: DB, ch: Challenge, user: User, today: string): void {
  requireCommissioner(db, ch, user, today);
  ch.endAt = addDays(today, 1);
  finish(db, ch, today);
}
