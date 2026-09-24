import { StyleSheet } from 'react-native';

// One accent. Signal is for the primary action, active tab, progress fills and the live stripe.
export const colors = {
  signal: '#E8342B',
  signalTint: '#FBE4E2',
  paper: '#F7F5F1',
  card: '#FFFFFF',
  ink: '#1B1A19',
  stone: '#7C7873',
  line: '#E6E2DC',
  white: '#FFFFFF',
};

export const fonts = {
  regular: 'Lexend_400Regular',
  medium: 'Lexend_500Medium',
  semibold: 'Lexend_600SemiBold',
};

export const type = StyleSheet.create({
  display: { fontFamily: fonts.semibold, fontSize: 32, lineHeight: 40, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 30, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.ink },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.stone },
});

export const space = { screen: 20, gap: 12, card: 20, touch: 48 };
export const radius = { card: 24, pill: 999 };

// Decorative only — the ambient bubbles behind a hero section. Never used for text, buttons,
// or anything that carries meaning; that stays Signal-only per the one-accent rule above.
export const glow = {
  coral: '#FF8A73',
  peach: '#FFC9A8',
  blush: '#FFD9CE',
  ember: '#F2542D',
};

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_INSET = 8;

// Avatars stay neutral so red keeps its meaning.
export const AVATAR_TONES = [
  { bg: '#E6E2DC', fg: colors.ink },
  { bg: colors.ink, fg: colors.white },
  { bg: '#D3CCC3', fg: colors.ink },
  { bg: '#5E5A55', fg: colors.white },
  { bg: '#EFEBE5', fg: colors.ink },
  { bg: '#3A3836', fg: colors.white },
];
