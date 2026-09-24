import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CheckinData } from '../../shared/api';
import { localDate, longDate } from '../../shared/catalog';
import { useLoad } from '../../src/api';
import { BubbleField } from '../../src/bubbles';
import { LogFlow } from '../../src/components/LogFlow';
import { PulseRing } from '../../src/motion';
import { colors, space } from '../../src/theme';
import { CheckCircle, T, useTabBarSpace } from '../../src/ui';

export default function CheckIn() {
  const { data, reload } = useLoad<CheckinData>('/checkin');
  // Keeps the "Logged" confirmation on screen until Done, even though today now counts as checked in.
  const [holding, setHolding] = useState(false);
  const [round, setRound] = useState(0);
  const top = useSafeAreaInsets().top;
  const tabSpace = useTabBarSpace();

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.paper }} />;

  if (data.checkedIn && !holding) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: top + space.card, paddingHorizontal: space.screen }}>
        <BubbleField scene="checkin" />
        <T variant="small">{longDate(localDate())}</T>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.gap * 2, paddingBottom: tabSpace }}>
          <PulseRing size={120}>
            <CheckCircle size={120} effect="bounce" />
          </PulseRing>
          <T variant="display" center>You're in for today</T>
          <T variant="label" color={colors.stone} center>
            {data.streak === 1 ? '1 day streak' : `${data.streak} day streak`}
          </T>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: top }}>
      <BubbleField scene="checkin" />
      <LogFlow
        key={round}
        data={data}
        bottomSpace={tabSpace + space.gap}
        onLogged={() => setHolding(true)}
        onFinish={async () => {
          await reload();
          setHolding(false);
          setRound((r) => r + 1);
        }}
      />
    </View>
  );
}
