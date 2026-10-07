// The JSON shapes the API returns. Screens render these directly; the server does the math.
import type { Band, ChallengeType, Per, Result, TrackType } from './catalog.ts';

export type Person = { id: string; name: string; avatar: number };

/** A last name a challenge winner gave someone, while it lasts. */
export type NameChange = { lastName: string; by: string; challengeName: string; until: string };

export type Me = Person & {
  /** Set while a winner's chosen last name is in effect. `name` is then the changed one. */
  nameChange: NameChange | null;
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
  type: ChallengeType;
  /** You started this one, so it is yours to delete. */
  mine: boolean;
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

/** The last name punishment, once the challenge is over and its consequence is the rename one. */
export type RenameView = {
  /** You won and someone here still needs a new last name. */
  canSet: boolean;
  targets: {
    id: string;
    /** Their own name, before any change. */
    name: string;
    isYou: boolean;
    /** pending: still the winner's to pick. active: they carry it now. over: it ran its course. */
    status: 'pending' | 'active' | 'over';
    /** The full name they carry now, while active. */
    newName: string | null;
    setBy: string | null;
    until: string | null;
  }[];
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
  rename: RenameView | null;
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

export type HouseCard = { id: string; name: string; type: ChallengeType; targetText: string; memberCount: number; joined: boolean };

export type InvitePreview = {
  token: string;
  inviterName: string;
  challenge: ChallengeDetail | null;
  alreadyMember: boolean;
  ended: boolean;
};
