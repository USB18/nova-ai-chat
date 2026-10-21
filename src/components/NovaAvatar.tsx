import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/theme';
import { Icon } from './Icon';

/** Nova's avatar: a gradient circle with a sparkle, optionally glowing. */
function NovaAvatarImpl({
  size = 28,
  glow = false,
}: {
  size?: number;
  glow?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
        glow && [styles.glow, { shadowColor: colors.orbFrom }],
      ]}
      accessible={false}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="orb" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.orbFrom} />
            <Stop offset="1" stopColor={colors.orbTo} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#orb)" />
      </Svg>
      <Icon name="sparkles" size={size * 0.5} color={colors.orbIcon} />
    </View>
  );
}

export const NovaAvatar = memo(NovaAvatarImpl);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
});
