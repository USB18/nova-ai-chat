import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/theme';

/**
 * Soft accent glow from the top-right corner. Place as the first child of a
 * container with `overflow: 'hidden'` and a `heroBg` background.
 */
function CornerGlowImpl({ opacity = 0.4 }: { opacity?: number }) {
  const { colors } = useTheme();
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="heroGlow" cx="90%" cy="0%" rx="60%" ry="80%">
          <Stop offset="0" stopColor={colors.heroGlow} stopOpacity={opacity} />
          <Stop offset="1" stopColor={colors.heroGlow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#heroGlow)" />
    </Svg>
  );
}

export const CornerGlow = memo(CornerGlowImpl);
