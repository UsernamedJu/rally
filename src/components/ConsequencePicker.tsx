import { View } from 'react-native';
import { CONSEQUENCE_SUGGESTIONS, offLimitsReason } from '../../shared/copy';
import { Chips, TextField } from '../inputs';
import { space } from '../theme';
import { ErrorText } from '../ui';

export const consequenceProblem = (text: string) => (text.trim() ? offLimitsReason(text) : null);

/** Suggestion chips plus one line for writing your own. Tapping a picked chip again clears it. */
export function ConsequencePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const suggested = CONSEQUENCE_SUGGESTIONS.includes(value);
  return (
    <View style={{ gap: space.gap }}>
      <Chips
        wrap
        options={CONSEQUENCE_SUGGESTIONS.map((s) => ({ key: s, label: s }))}
        value={suggested ? value : null}
        onChange={(v) => onChange(v === value ? '' : v)}
      />
      <TextField placeholder="Or write your own" value={suggested ? '' : value} onChangeText={onChange} maxLength={80} />
      <ErrorText>{consequenceProblem(value)}</ErrorText>
    </View>
  );
}
