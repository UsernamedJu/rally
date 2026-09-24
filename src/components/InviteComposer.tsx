import { useState } from 'react';
import { View } from 'react-native';
import type { TargetSpec, Tone } from '../../shared/catalog';
import { TONES, inviteMessage } from '../../shared/copy';
import { inviteLink } from '../api';
import { Chips } from '../inputs';
import { canPickContacts, sendText, textContact } from '../share';
import { colors, space } from '../theme';
import { Button, Card, ErrorText, T, TextLink } from '../ui';

type Options = {
  spec: TargetSpec & { name: string; consequence: string | null };
  /** Resolves the invite token. The create flow makes the challenge here, on the first send. */
  getToken: () => Promise<string>;
  onFinish: () => void;
  onSkip?: () => void;
  onSheet?: boolean;
};

/** Returns the message picker and its buttons separately, so screens can pin the buttons at the bottom. */
export function useInviteComposer({ spec, getToken, onFinish, onSkip, onSheet }: Options) {
  const [tone, setTone] = useState<Tone>('friendly');
  const [busy, setBusy] = useState<'text' | 'contacts' | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (how: 'text' | 'contacts') => {
    setBusy(how);
    setError(null);
    try {
      const message = inviteMessage(tone, spec, inviteLink(await getToken()));
      const outcome = how === 'text' ? await sendText(message) : await textContact(message);
      if (outcome === 'sent') onFinish();
      if (outcome === 'copied') setCopied(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const content = (
    <View style={{ gap: space.gap }}>
      <Chips options={TONES} value={tone} onChange={setTone} />
      <Card style={onSheet ? { backgroundColor: colors.paper } : null}>
        {/* The real link is only made when the user actually sends, so the preview shows a
            placeholder in its place — the same one the plan's own examples use. */}
        <T>{inviteMessage(tone, spec, '[link]')}</T>
      </Card>
      {copied ? <T variant="label">Invite copied. Paste it into a text to your crew.</T> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );

  const actions = (
    <>
      {copied ? (
        <Button title="Done" onPress={onFinish} />
      ) : (
        <Button title="Send by text" busy={busy === 'text'} disabled={!!busy} onPress={() => send('text')} />
      )}
      {canPickContacts ? (
        <Button variant="outline" title="Pick from contacts" busy={busy === 'contacts'} disabled={!!busy} onPress={() => send('contacts')} />
      ) : null}
      {onSkip ? <TextLink title="Start without inviting yet" onPress={onSkip} /> : null}
    </>
  );

  return { content, actions };
}
