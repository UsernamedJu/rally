# Rally

A friend invites you to a challenge by text. You see the challenge and the consequence before you
make an account. You log one thing a day. The app keeps score.

Built to the plan in the build prompt: three tabs (Home, Check-in, Me), the challenge as one
screen, a four screen create flow, invite links, and five house challenges.

## Stack

- Expo SDK 57, React Native 0.86, TypeScript, Expo Router.
- A zero dependency Node API in `server/` with a JSON file for storage. Node runs the
  TypeScript directly, so there is no build step.
- Lexend everywhere, one red accent, no other libraries for UI, motion or charts.

## Running it

Two processes. Start the API first.

```bash
npm run api
```

```bash
npm start
```

Then press `w` for the browser, `i` for the iOS simulator, or scan the QR code with Expo Go.

The app finds the API on port 8787 of whatever host serves the app, so a phone on the same wifi
works with no configuration. To point it somewhere else, set `EXPO_PUBLIC_API_URL`. Invite links
are built the same way; override with `EXPO_PUBLIC_INVITE_URL` once it is hosted somewhere real.

## Demo data

Sign up in the app first, then:

```bash
npm run seed
```

That gives the most recent signup a crew (Maria, Keisha, Tom), a live class challenge with an
agreed consequence, a steps challenge with a consequence waiting on a vote, a finished challenge
you won, and a few days of history so the streak and the charts have something in them.
`npm run seed -- Dana` targets a person by name. Data lives in `server/data/db.json`; delete it
to start over.

## How scoring works

Each period (a day or a week) earns credit up to the target, so five gym sessions in one week
cannot cover a week you missed. Standings rank on total credit across the challenge, which is why
a card can say "2 of 3 this week" while the standings say "7 of 12".

- Threshold challenges (per day, per week): everyone who hits the target finishes. The lowest who
  does not is on the hook.
- Race challenges (a total, like the 20 miles house challenge): first to the target wins.
- Session challenges take one log a day. Numeric ones (steps, miles) add up across the day.
- House challenges run on each member's own window, starting the day they join, and have no
  consequence and no commissioner.

## Layout

```
app/            screens, one file per route (Expo Router)
src/            design system (theme, ui, inputs, motion) and shared screen pieces
shared/         types, challenge wording and copy used by both the app and the server
server/         the API, its storage, and the seed script
```

`shared/` is imported by both sides, so the plain words sentence on a challenge card and the one
in an invite text come from the same function.

## Apple platform features

Built from Apple's own documentation (Adopting Liquid Glass, Interface fundamentals, Graphics and
animation, Core experiences, Data management), and checked on an iOS 26.5 simulator.

**Liquid Glass.** `src/glass.tsx` uses the real `UIGlassEffect` through `expo-glass-effect`, which
runs in Expo Go. Glass is on the controls layer only (tab bar, sheets, toolbar buttons, and two
callouts), because Apple says content-layer glass collides with navigation glass. It falls back to a
frosted blur on older iOS, and to a plain solid surface under Reduce Transparency. Two gotchas that
cost real time: opacity on a glass view or any parent of one switches the effect off for good (so
`Enter` takes `fade={false}` around glass), and it also disappears when its screen is detached by a
push, so `Glass` remounts the native view when its screen regains focus.

**Motion.** Everything that responds to a finger is a spring (`src/motion.tsx`), so it can be
interrupted and reversed mid-flight. The tab bar's selection lens slides between tabs and can be
dragged across; sheets follow the finger and fling away with the release velocity; the swipe card
carries a flick's speed through. Create and Log are native iOS modal cards with interactive
swipe-down. Reduce Motion is respected throughout.

**Native pieces.** SF Symbols with symbol effects (`expo-symbols`), haptics tied to real events
(selection, threshold, success, warning), Face ID (`expo-local-authentication`), and a layered app
icon in `assets/rally.icon` (Liquid Glass, dark, tinted and clear appearances, verified with Xcode's
`ictool` and `actool`).

**Data.** The session token and remembered account live in the Keychain (`src/secure.ts`,
`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), migrated from AsyncStorage on first launch. Each screen's last
response is cached for the same calendar day so launches are instant and work offline.

**Sharing.** The API serves an invite page with Open Graph tags (`server/preview.ts`) so a link in
Messages shows a card with the challenge and its consequence, and serves the Apple App Site
Association file once `APPLE_TEAM_ID` is set. `app.config.ts` adds Associated Domains from
`INVITE_DOMAIN`. Together those are everything universal links need except a real domain.

**App Store.** Privacy manifest and export-compliance flag are in `app.json`.

### Needs a development build or an Apple account (not done here)

Native tabs (`expo-router/unstable-native-tabs`), Home Screen quick actions, widgets, Live
Activities, App Intents and Spotlight (all need native extension targets), Sign in with Apple, and
signing for TestFlight. The remaining glue for universal links is owning the domain.

## Not built, on purpose

Community tab, athlete challenges, a mascot, tracker sync, rewards, photo proof, money, chat,
comments, gradients and dark mode are all out of scope for this version. See the notes at the end
of the build conversation for the smaller things that were deliberately left out.
