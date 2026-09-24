// The JSON shapes the API returns. Screens render these directly; the server does the math.
import type { Band, ChallengeType, Per, Result, TrackType } from './catalog.ts';

export type Person = { id: string; name: string; avatar: number };

export type Me = Person & {
  workoutTime: string;
  trackedTypes: TrackType[];
  notifications: boolean;
  band: Band;
  /** Digits only, no formatting. Null until they add one. */
  phone: string | null;
  hasPin: boolean;
};

export type SignupResult = { token: string; user: Me; challengeId: string | null };

export type ChallengeCard = {
  id: string;
  name: string;
  targetShort: string;
  progressText: string;
  fraction: number;
  periodDone: boolean;
  complete: boolean;
  members: Person[];
  memberCount: number;
  daysLeftText: string;
  waiting: boolean;
  live: boolean;
};

export type HomeData = {
  user: Me;
  crew: (Person & { loggedToday: boolean })[];
  challenges: ChallengeCard[];
};

export type FriendData = Person & { completed: number; biggestWin: string | null };

export type Standing = Person & {
  rank: number;
  fraction: number;
  percent: number;
  /** "7 of 12" — credit against this person's own goal. */
  label: string;
  /** "8,000 steps a day", only when fair play is on. */
  goalText: string | null;
  /** Rank movement over the last week: "+2", "-1" or null for no change. */
  delta: string | null;
  isYou: boolean;
  onTheHook: boolean;
  complete: boolean;
};

/** The three numbers at the top of a challenge: where you stand, in one glance. */
export type HeroStats = { rank: string; progress: string; people: string };

export type ConsequenceView = {
  status: 'none' | 'proposed' | 'agreed';
  text: string | null;
  proposedBy: string | null;
  youProposed: boolean;
  youAgreed: boolean;
  waitingOn: number;
};

export type ChallengeDetail = {
  id: string;
  name: string;
  targetText: string;
  type: ChallengeType;
  target: number;
  per: Per;
  lengthDays: number;
  numeric: boolean;
  house: boolean;
  status: 'waiting' | 'live' | 'done';
  daysLeftText: string;
  timeFraction: number;
  rangeText: string;
  consequence: ConsequenceView | null;
  hero: HeroStats;
  /** Ranked on percent of each person's own goal. */
  fair: boolean;
  yourGoalText: string | null;
  winnerName: string | null;
  resultText: string | null;
  standings: Standing[];
  members: Person[];
  alerts: string[];
  you: { member: boolean; commissioner: boolean; readOnly: boolean; result: Result | null };
  manage: (Person & { pending: boolean })[];
};

export type CheckinChallenge = {
  id: string;
  name: string;
  type: ChallengeType;
  numeric: boolean;
  unitMany: string;
  loggedToday: boolean;
  progressText: string;
};

export type CheckinData = { checkedIn: boolean; streak: number; challenges: CheckinChallenge[] };

export type CheckinResult = { cards: ChallengeCard[]; previous: Record<string, number>; line: string; checkinId: string };

export type TrackedCard = {
  type: TrackType;
  label: string;
  totalText: string;
  days: (number | null)[];
  todayIndex: number;
};

export type PastRow = { id: string; name: string; rangeText: string; result: 'Won' | 'Finished' | 'Dropped' };

export type MeData = {
  user: Me;
  streak: number;
  longestStreak: number;
  completed: number;
  won: number;
  tracked: TrackedCard[];
  past: PastRow[];
};

export type HouseCard = { id: string; name: string; targetText: string; memberCount: number; joined: boolean };

export type InvitePreview = {
  token: string;
  inviterName: string;
  challenge: ChallengeDetail | null;
  alreadyMember: boolean;
  ended: boolean;
};
