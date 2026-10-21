import React, { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { toolLabel } from '../lib/tools/registry';
import { fonts, radius, useTheme } from '../theme/theme';
import { Icon } from './Icon';
import type { ToolCallRecord } from '../types/chat';

/**
 * Compact status line for a tool call. Raw arguments and API responses are never
 * shown — the model turns them into the normal reply text below.
 */
function ToolStatusChipImpl({ call }: { call: ToolCallRecord }) {
  const { colors } = useTheme();
  const tone =
    call.status === 'error'
      ? { fg: colors.danger, bg: colors.dangerBg }
      : call.status === 'success'
      ? { fg: colors.success, bg: colors.successSoft }
      : { fg: colors.pending, bg: colors.pendingSoft };

  return (
    <View
      style={[styles.chip, { backgroundColor: tone.bg }]}
      accessible
      accessibilityLabel={`${toolLabel(call.name)}, ${call.status}`}
    >
      {call.status === 'running' ? (
        <ActivityIndicator size="small" color={tone.fg} style={styles.spin} />
      ) : (
        <Icon
          name={call.status === 'error' ? 'close' : 'tick'}
          size={13}
          strokeWidth={2.5}
          color={tone.fg}
        />
      )}
      <Text style={[styles.title, { color: tone.fg }]} numberOfLines={1}>
        {call.status === 'running'
          ? `${toolLabel(call.name)}…`
          : toolLabel(call.name)}
      </Text>
    </View>
  );
}

export const ToolStatusChip = memo(ToolStatusChipImpl);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  spin: { transform: [{ scale: 0.7 }], width: 13, height: 13 },
  title: { fontFamily: fonts.mono, fontSize: 11.5, flexShrink: 1 },
});
