import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { HouseCard } from '../shared/api';
import { api, useLoad } from '../src/api';
import { colors, space } from '../src/theme';
import { Button, Card, ErrorText, Header, Page, T } from '../src/ui';

export default function Join() {
  const { data, error: loadError } = useLoad<HouseCard[]>('/house');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const join = async (h: HouseCard) => {
    setError(null);
    setBusy(h.id);
    try {
      if (!h.joined) await api(`/challenges/${h.id}/join`, { body: {} });
      router.replace(`/challenge/${h.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page header={<Header />}>
      <T variant="display">Join a challenge</T>
      <ErrorText>{error ?? loadError}</ErrorText>
      {data?.map((h) => (
        <Card key={h.id} style={{ gap: 4 }}>
          <T variant="title">{h.name}</T>
          <T color={colors.stone}>{h.targetText}</T>
          <View style={styles.bottom}>
            <T variant="label">
              {h.joined ? "You're in" : h.memberCount === 0 ? 'Be the first one in' : h.memberCount === 1 ? '1 person in' : `${h.memberCount} people in`}
            </T>
            <Button variant="outline" title={h.joined ? 'Open' : 'Join'} busy={busy === h.id} style={styles.button} onPress={() => join(h)} />
          </View>
        </Card>
      ))}
    </Page>
  );
}

const styles = StyleSheet.create({
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.gap },
  button: { minWidth: 112, minHeight: space.touch },
});
