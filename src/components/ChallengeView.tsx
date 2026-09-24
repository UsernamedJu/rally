import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ChallengeDetail, Standing } from '../../shared/api';
import { api } from '../api';
import { Glass } from '../glass';
import { Enter } from '../motion';
import { colors, radius, space } from '../theme';
import { Avatar, AvatarStack, Button, Card, CheckCircle, ErrorText, Header, Icon, Page, ProgressBar, Sheet, T, TextLink } from '../ui';
import { ConsequencePicker, consequenceProblem } from './ConsequencePicker';
import { useInviteComposer } from './InviteComposer';

type Props = {
  detail: ChallengeDetail;
  onChange: (d: ChallengeDetail) => void;
  header?: ReactNode;
  eyebrow?: string;
  /** Replaces the pinned Log today button (the invite screen uses I'm in). */
  footer?: ReactNode;
};

/** The one place a challenge lives. Read only hides logging, inviting and commissioner controls. */
export function ChallengeView({ detail, onChange, header, eyebrow, footer }: Props) {
  const [sheet, setSheet] = useState<'propose' | 'invite' | 'manage' | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = !detail.you.readOnly;
  const c = detail.consequence;

  const openSheet = (s: typeof sheet) => {
    setError(null);
    setConfirmEnd(false);
    setDraft('');
    setSheet(s);
  };

  const act = async (key: string, path: string, body: object = {}) => {
    setBusy(key);
    setError(null);
    try {
      onChange(await api<ChallengeDetail>(`/challenges/${detail.id}${path}`, { body }));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const invite = useInviteComposer({
    spec: { ...detail, consequence: c?.text ?? null },
    getToken: async () => (await api<{ token: string }>(`/challenges/${detail.id}/invite`, { body: {} })).token,
    onFinish: () => setSheet(null),
    onSheet: true,
  });

  return (
    <>
      <Page
        header={header ?? <Header />}
        footer={footer !== undefined ? footer : live ? <Button title="Log today" onPress={() => router.push(`/log/${detail.id}`)} /> : null}
        bubbles="challenge"
      >
        <Enter index={0} style={{ gap: 4 }}>
          {eyebrow ? <T variant="label" color={colors.stone}>{eyebrow}</T> : null}
          <T variant="display">{detail.name}</T>
          <T color={colors.stone}>{detail.targetText}</T>
          {detail.yourGoalText ? <T variant="small">Your goal: {detail.yourGoalText}</T> : null}
        </Enter>

        {detail.standings.length >= 2 ? (
          <Enter index={1} style={styles.heroRow}>
            <HeroStat value={detail.hero.rank} label="Rank" />
            <HeroStat value={detail.hero.progress} label="Progress" />
            <HeroStat value={detail.hero.people} label="People" />
          </Enter>
        ) : null}

        {detail.resultText ? (
          <Card style={styles.result}>
            <Icon name={detail.winnerName ? 'award' : 'flag'} size={22} color={colors.ink} />
            <T variant="label" style={{ flex: 1 }}>{detail.resultText}</T>
          </Card>
        ) : null}

        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <ProgressBar fraction={detail.timeFraction} tone="ink" height={6} />
          </View>
          <T variant="label">{detail.daysLeftText}</T>
        </View>

        <Enter index={3} fade={false}>
        <Glass tintColor={colors.signalTint} style={styles.consequence}>
          <T variant="title">Consequence</T>
          {!c ? (
            <T>No consequence on this one. Just bragging rights.</T>
          ) : c.status === 'none' ? (
            <>
              <T>Nothing agreed yet</T>
              {live ? <Button variant="outline" title="Propose one" style={styles.inline} onPress={() => openSheet('propose')} /> : null}
            </>
          ) : (
            <>
              <T>{c.text}</T>
              {c.status === 'agreed' ? (
                <View style={styles.agreed}>
                  <CheckCircle size={20} />
                  <T variant="label">Agreed</T>
                </View>
              ) : (
                <>
                  <T variant="small" color={colors.ink}>{c.youProposed ? 'Proposed by you' : `Proposed by ${c.proposedBy}`}</T>
                  {live && c.youAgreed ? (
                    <T variant="small" color={colors.ink}>
                      {c.waitingOn > 0 ? `Waiting on ${c.waitingOn} more to agree` : 'Your crew votes once they join'}
                    </T>
                  ) : null}
                  {live ? (
                    <View style={styles.buttonRow}>
                      {!c.youAgreed ? (
                        <Button variant="outline" title="Agree" busy={busy === 'agree'} style={styles.inline} onPress={() => act('agree', '/consequence/agree')} />
                      ) : null}
                      <Button variant="outline" title="Suggest another" style={styles.inline} onPress={() => openSheet('propose')} />
                    </View>
                  ) : null}
                </>
              )}
            </>
          )}
        </Glass>
        </Enter>

        <Enter index={4} style={{ gap: space.gap }}>
          <T variant="title">Standings</T>
          <Card style={{ padding: 8, gap: 4 }}>
            {detail.standings.map((row, i) => (
              <Enter key={row.id} index={i + 1} distance={10}>
                <StandingRow row={row} challengeId={detail.id} />
              </Enter>
            ))}
          </Card>
        </Enter>

        {detail.alerts.map((alert) => (
          <Card key={alert} style={styles.alert}>
            <Icon name="bell" size={20} color={colors.ink} />
            <T style={{ flex: 1 }}>{alert}</T>
          </Card>
        ))}

        <View style={{ gap: space.gap }}>
          <T variant="title">Crew</T>
          <Card style={styles.crew}>
            <AvatarStack people={detail.members.slice(0, 6)} total={detail.members.length} size={36} />
            {live ? <Button variant="outline" title="Invite more" style={styles.inline} onPress={() => openSheet('invite')} /> : null}
          </Card>
        </View>

        {!sheet ? <ErrorText>{error}</ErrorText> : null}
        {detail.you.commissioner ? <TextLink title="Manage challenge" onPress={() => openSheet('manage')} /> : null}
      </Page>

      <Sheet visible={sheet === 'propose'} onClose={() => setSheet(null)} title="Consequence for last place?">
        <ConsequencePicker value={draft} onChange={setDraft} />
        <T variant="small">Your crew votes on this. No money, nothing mean.</T>
        <ErrorText>{error}</ErrorText>
        <Button
          title="Propose it"
          disabled={!draft.trim() || !!consequenceProblem(draft)}
          busy={busy === 'propose'}
          onPress={async () => {
            if (await act('propose', '/consequence', { text: draft })) setSheet(null);
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'invite'} onClose={() => setSheet(null)} title="Invite your crew">
        {invite.content}
        {invite.actions}
      </Sheet>

      <Sheet visible={sheet === 'manage'} onClose={() => setSheet(null)} title="Manage challenge">
        <T variant="label">Remove someone</T>
        {detail.manage.length ? (
          detail.manage.map((p) => (
            <View key={p.id} style={styles.manageRow}>
              <Avatar person={p} size={40} />
              <T variant="label" style={{ flex: 1 }}>{p.name}</T>
              {p.pending ? (
                <T variant="small">Alert sent</T>
              ) : (
                <Button variant="outline" title="Remove" busy={busy === p.id} style={styles.inline} onPress={() => act(p.id, '/removals', { userId: p.id })} />
              )}
            </View>
          ))
        ) : (
          <T color={colors.stone}>Nobody else is in yet.</T>
        )}
        <T variant="small">Your crew gets an alert first. They're removed after a day unless they log.</T>
        <ErrorText>{error}</ErrorText>
        {confirmEnd ? (
          <>
            <T>End it now? Standings lock and results are final.</T>
            <Button
              title="End challenge"
              busy={busy === 'end'}
              onPress={async () => {
                if (await act('end', '/end')) setSheet(null);
              }}
            />
            <Button variant="outline" title="Keep going" onPress={() => setConfirmEnd(false)} />
          </>
        ) : (
          <Button variant="outline" title="End challenge early" onPress={() => setConfirmEnd(true)} />
        )}
      </Sheet>
    </>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <T variant="title" center>{value}</T>
      <T variant="small" center>{label}</T>
    </View>
  );
}

function StandingRow({ row, challengeId }: { row: Standing; challengeId: string }) {
  const momentum = row.delta ? `, ${row.delta.startsWith('-') ? 'down' : 'up'} ${row.delta.replace('-', '')} this week` : '';
  return (
    <View
      accessible
      accessibilityLabel={`Rank ${row.rank}. ${row.name}${row.isYou ? ', you' : ''}. ${row.percent} percent${momentum}. ${row.label}.${row.onTheHook ? ' On the hook.' : ''}`}
      style={[styles.standing, row.isYou ? styles.you : null]}
    >
      <View style={styles.rankBadge}>
        <T variant="small" color={colors.ink}>{row.rank}</T>
      </View>
      <Avatar person={row} size={40} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.standingTop}>
          <T variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>{row.name}</T>
          {row.onTheHook ? <T variant="small">On the hook</T> : null}
          <View style={{ flex: 1 }} />
          <T variant="label">{row.percent}%</T>
        </View>
        <ProgressBar fraction={row.fraction} tone={row.complete ? 'ink' : 'signal'} height={8} animKey={`standing:${challengeId}:${row.id}`} />
        <View style={styles.standingBottom}>
          <T variant="small">{row.label}</T>
          {row.delta ? <T variant="small">{row.delta} this week</T> : null}
          {row.goalText ? <T variant="small">Goal: {row.goalText}</T> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  consequence: { gap: 8, padding: space.card },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: space.gap },
  inline: { alignSelf: 'flex-start', minHeight: space.touch, paddingHorizontal: 20 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  agreed: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroRow: { flexDirection: 'row', gap: 8 },
  heroStat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 8, gap: 2 },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.gap },
  standing: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.card - 4, borderWidth: 1.5, borderColor: 'transparent' },
  you: { borderColor: colors.ink },
  rankBadge: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  standingTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  standingBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: space.gap },
  crew: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.gap },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: space.gap },
});
