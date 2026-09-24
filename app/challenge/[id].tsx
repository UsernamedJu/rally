import { useLocalSearchParams } from 'expo-router';
import type { ChallengeDetail } from '../../shared/api';
import { useLoad } from '../../src/api';
import { ChallengeView } from '../../src/components/ChallengeView';
import { Button, Card, Header, Page, T } from '../../src/ui';

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setData, error, reload } = useLoad<ChallengeDetail>(`/challenges/${id}`);

  if (!data) {
    return (
      <Page header={<Header />}>
        {error ? (
          <Card style={{ gap: 12 }}>
            <T>{error}</T>
            <Button variant="outline" title="Try again" onPress={reload} />
          </Card>
        ) : null}
      </Page>
    );
  }
  return <ChallengeView detail={data} onChange={setData} />;
}
