import { TYPES, targetShort, weeksText } from './catalog.ts';
import type { TargetSpec, Tone } from './catalog.ts';

export const CONSEQUENCE_SUGGESTIONS = [
  'Buys coffee',
  'Buys dinner',
  'Posts an embarrassing video',
  "Wears the crew's pick for a day",
  "Does the winner's chores once",
  'Sings at the next hangout',
];

// Placeholder until the off limits list is decided. Money is the one firm rule.
const OFF_LIMITS = /\$|\bdollars?\b|\bbucks\b|\bcash\b|\bvenmo\b|\bzelle\b|\bpaypal\b|\bcash ?app\b|\bmoney\b/i;

export function offLimitsReason(text: string): string | null {
  return OFF_LIMITS.test(text) ? 'Keep it light. No money.' : null;
}

export const TONES: { key: Tone; label: string }[] = [
  { key: 'friendly', label: 'Friendly' },
  { key: 'playful', label: 'Playful' },
  { key: 'jab', label: 'Jab' },
];

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function inviteMessage(
  tone: Tone,
  c: TargetSpec & { name: string; consequence?: string | null },
  link: string,
): string {
  const short = targetShort(c);
  const loser = c.consequence ? `loser ${lower(c.consequence)}` : '';
  const noun = c.type === 'custom' ? c.name : TYPES[c.type].noun;
  const adjective = c.lengthDays === 7 ? '1 week' : `${Math.round(c.lengthDays / 7)} week`;
  const span = c.lengthDays === 7 ? 'a week' : c.lengthDays === 14 ? 'two weeks' : 'a month';
  switch (tone) {
    case 'friendly':
      return `Starting a ${adjective} ${noun} challenge, ${short}. Would love to do it with you.${loser ? ` ${upper(loser)}.` : ''} ${link}`;
    case 'playful':
      return `Bet you can't do ${short} for ${span}. Prove me wrong.${loser ? ` ${upper(loser)}.` : ''} ${link}`;
    case 'jab':
      return `Get off the couch. ${upper(short)}, ${weeksText(c.lengthDays)}${loser ? `, ${loser}` : ''}. You in or nah. ${link}`;
  }
}

export function crewInviteMessage(link: string): string {
  return `I'm doing fitness challenges with friends and want you in my crew. ${link}`;
}

export const BANNER_LINES = [
  "Most people skip Fridays. Don't be most people.",
  'Your couch will still be there after your workout.',
  "Nobody ever said 'I wish I'd skipped that walk.'",
  'Somebody in your crew is hoping you skip today.',
  'Twenty minutes counts. So does a walk around the block.',
  "Today's workout is tomorrow's bragging rights.",
  'The hardest part is putting your shoes on. Go put your shoes on.',
  'Mondays are for fresh starts. So is every other day.',
  'Your crew can see who logged today. Just saying.',
  'Being on the hook is only fun for everyone else.',
  'A slow walk still beats a fast scroll.',
  'Rain is just a free cool down.',
  'Pack your gym bag tonight. Future you says thanks.',
  "It's not a streak until you do it twice.",
  'The best workout is the one you actually do.',
  "Somebody's buying coffee this week. Make sure it isn't you.",
  "Take the stairs. Nobody's timing you.",
  'Show up tired. It still counts.',
  'Your crew is counting on you. Mostly to lose.',
  'Small workouts add up faster than you think.',
  'Weekend plans? Put a walk in them.',
  "Missed yesterday? Today doesn't know that.",
  'Bring a friend. Misery loves company, and so does Pilates.',
  'Stretch first. Brag later.',
  "One more class than last week. That's the whole plan.",
  'A lunch break walk is a workout with a view.',
  "Consequences are funnier when they're someone else's.",
  "Don't let the group chat talk more than it walks.",
  "You don't have to love it. You just have to log it.",
  "Earn your dinner. Or at least don't buy everyone else's.",
];

export function bannerFor(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
  return BANNER_LINES[dayOfYear % BANNER_LINES.length];
}

export function reminderLines(friendName: string | null): string[] {
  return [
    'Time to move. Your crew is watching.',
    friendName ? `Log today before ${friendName} does.` : 'Log today before your crew does.',
    'Twenty seconds to log. Go.',
    'Shoes on. Then log it.',
    'Nobody wants to be on the hook. Get moving.',
    'A quick walk counts. Go get one in.',
    'Your workout called. It wants to know where you are.',
  ];
}
