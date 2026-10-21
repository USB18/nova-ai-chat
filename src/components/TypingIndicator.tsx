import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/theme';

export function TypingIndicator() {
  const { colors } = useTheme();
  const dotOpacities = useRef(
    [0, 1, 2].map(() => new Animated.Value(0.3)),
  ).current;

  useEffect(() => {
    const pulseLoops = dotOpacities.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 150),
        ]),
      ),
    );
    pulseLoops.forEach(l => l.start());
    return () => pulseLoops.forEach(l => l.stop());
  }, [dotOpacities]);

  return (
    <View style={styles.row} accessibilityLabel="Assistant is thinking">
      {dotOpacities.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { backgroundColor: colors.accent, opacity: v }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, paddingVertical: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
