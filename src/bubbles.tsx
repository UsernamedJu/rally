import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from './motion';
import { glow } from './theme';

type Bubble = {
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  /** A single warm hue for this orb — softened into a glow by the blur layer, not a hard shape. */
  color: string;
  opacity: number;
  driftY: number;
  duration: number;
  delay: number;
};

// Soft, translucent versions of the glow palette — the blur pass lightens whatever's underneath,
// so a strong color here still reads as a gentle wash once rendered.
const CORAL = 'rgba(255,138,115,0.5)';
const BLUSH = 'rgba(255,217,206,0.65)';
const PEACH = 'rgba(255,201,168,0.55)';
const SIGNAL_SOFT = 'rgba(232,52,43,0.16)';

/** One scene per screen that wants ambient energy behind its hero content. Kept out of the way
 * of anything readable — cards sitting on top simply cover whatever bubble is behind them.
 * Placed with real distance between orbs so they read as separate glows, not a muddy overlap. */
const SCENES = {
  home: [
    { size: 260, top: -130, right: -90, color: SIGNAL_SOFT, opacity: 1, driftY: 16, duration: 5400, delay: 0 },
    { size: 130, top: 150, left: -60, color: BLUSH, opacity: 0.9, driftY: 12, duration: 4600, delay: 300 },
  ],
  checkin: [
    { size: 280, top: -70, left: -100, color: SIGNAL_SOFT, opacity: 1, driftY: 18, duration: 5800, delay: 0 },
    { size: 120, bottom: 40, right: -50, color: PEACH, opacity: 0.85, driftY: 10, duration: 4200, delay: 500 },
  ],
  me: [
    { size: 240, top: -120, left: -90, color: BLUSH, opacity: 0.95, driftY: 14, duration: 5000, delay: 0 },
    { size: 130, top: 220, right: -60, color: SIGNAL_SOFT, opacity: 1, driftY: 12, duration: 4800, delay: 250 },
  ],
  challenge: [
    { size: 220, top: -110, right: -80, color: CORAL, opacity: 0.5, driftY: 12, duration: 5200, delay: 0 },
  ],
} satisfies Record<string, Bubble[]>;

export type BubbleScene = keyof typeof SCENES;

function useDrift(driftY: number, duration: number, delay: number, enabled: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, duration, delay, v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, driftY] });
}

function FloatingBubble({ b, reduce }: { b: Bubble; reduce: boolean }) {
  const translateY = useDrift(b.driftY, b.duration, b.delay, !reduce);
  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: b.size,
          height: b.size,
          borderRadius: b.size / 2,
          top: b.top,
          bottom: b.bottom,
          left: b.left,
          right: b.right,
          opacity: b.opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {/* No blur here — BlurView is a rectangular frosted pane with its own hard edge (right
          for a tab bar, wrong for a glow), so it only trades one hard edge for another. The
          circular clip plus a gradient that reaches fully transparent well inside its own
          radius is what actually reads as a soft glow with nothing to "cut out" against. */}
      <LinearGradient
        colors={[b.color, b.color, 'transparent']}
        locations={[0, 0.1, 0.28]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.15, y: 0.1 }}
        end={{ x: 0.95, y: 0.95 }}
      />
    </Animated.View>
  );
}

/** Ambient gradient orbs behind a screen's hero area. Purely decorative — pointerEvents none,
 * and static (no drift) when the user has reduced motion on. */
export function BubbleField({ scene }: { scene: BubbleScene }) {
  const reduce = useReducedMotion();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {SCENES[scene].map((b, i) => (
        <FloatingBubble key={i} b={b} reduce={reduce} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', overflow: 'hidden' },
});
