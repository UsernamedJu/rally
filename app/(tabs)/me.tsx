import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MeData, TrackedCard } from '../../shared/api';
import { useLoad } from '../../src/api';
import { BubbleField } from '../../src/bubbles';
import { Enter, PulseRing } from '../../src/motion';
import { colors, radius, space } from '../../src/theme';
import { Avatar, Button, Card, IconButton, T, useTabBarSpace } from '../../src/ui';

export default function Me() {
  const { data, error, reload } = useLoad<MeData>('/me/summary');
  const top = useSafeAreaInsets().top;
  const tabSpace = useTabBarSpace();

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <BubbleField scene="me" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: tabSpace + space.screen }]}>
        {!data ? (
          error ? (
            <Card style={{ gap: space.gap }}>
              <T>{error}</T>
              <Button variant="outline" title="Try again" onPress={reload} />
            </Card>
          ) : null
        ) : (
          <>
            <Enter index={0} fade={false} style={styles.header}>
              <Avatar person={data.user} size={56} />
              <T variant="title" numberOfLines={1} style={{ flex: 1 }}>{data.user.name}</T>
              <IconButton name="settings" label="Settings" onPress={() => router.push('/settings')} />
            </Enter>

            <Enter index={1} style={styles.hero}>
              {data.streak > 0 ? (
                <PulseRing size={64}>
                  <T variant="display" center>{data.streak}</T>
                </PulseRing>
              ) : null}
              {data.streak > 0 ? (
                <T color={colors.stone} center>day streak</T>
              ) : (
                <T variant="display" center>Start a streak today</T>
              )}
            </Enter>

            <Enter index={2} style={styles.stats}>
              <Stat value={data.completed} label="Challenges completed" />
              <Stat value={data.won} label="Challenges won" />
              <Stat value={data.longestStreak} label="Longest streak" />
            </Enter>

            <Enter index={3} style={{ gap: space.gap }}>
              <T variant="title">What you track</T>
              {data.tracked.length ? (
                data.tracked.map((t) => <TrackedRow key={t.type} item={t} />)
              ) : (
                <Card onPress={() => router.push('/settings')} label="Pick what you track">
                  <T>Pick what you want to track in settings.</T>
                </Card>
              )}
            </Enter>

            <Enter index={4} style={{ gap: space.gap }}>
              <T variant="title">Past challenges</T>
              {data.past.length ? (
                <Card style={{ paddingVertical: 4 }}>
                  {data.past.map((p, i) => (
                    <Pressable
                      key={`${p.id}-${i}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name}, ${p.rangeText}, ${p.result}`}
                      onPress={() => router.push(`/challenge/${p.id}`)}
                      style={[styles.pastRow, i > 0 ? styles.divider : null]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="label">{p.name}</T>
                        <T variant="small">{p.rangeText}</T>
                      </View>
                      <T variant="label">{p.result}</T>
                    </Pressable>
                  ))}
                </Card>
              ) : (
                <Card>
                  <T>Finish a challenge and it shows up here.</T>
                </Card>
              )}
            </Enter>
          </>
        )}
        </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <T variant="title" center>{value}</T>
      <T variant="small" center>{label}</T>
    </View>
  );
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function TrackedRow({ item }: { item: TrackedCard }) {
  const max = Math.max(1, ...item.days.map((d) => d ?? 0));
  return (
    <Card style={styles.tracked}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="label" color={colors.stone}>{item.label}</T>
        <T variant="title">{item.totalText}</T>
      </View>
      <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {item.days.map((d, i) => {
          const isToday = i === item.todayIndex;
          const height = d ? Math.max(6, (d / max) * 44) : 6;
          return (
            <View key={i} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  style={{
                    height,
                    borderRadius: radius.pill,
                    backgroundColor: isToday ? colors.signal : d ? colors.ink : colors.line,
                  }}
                />
              </View>
              <T variant="small" color={isToday ? colors.ink : colors.stone}>{DAY_LETTERS[i]}</T>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.screen, gap: space.gap * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.gap },
  hero: { alignItems: 'center', paddingVertical: space.gap },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 8, gap: 2 },
  tracked: { flexDirection: 'row', alignItems: 'center', gap: space.gap },
  bars: { flexDirection: 'row', gap: 6 },
  barColumn: { alignItems: 'center', gap: 4 },
  barTrack: { width: 14, height: 44, justifyContent: 'flex-end' },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: space.gap, minHeight: 64, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
});
