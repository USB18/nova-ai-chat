import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '../theme/theme';
import { Icon, type IconName } from './Icon';

export type AttachmentSource = 'library' | 'photo' | 'video';

const ATTACHMENT_SOURCES: {
  key: AttachmentSource;
  icon: IconName;
  label: string;
  hint: string;
}[] = [
  {
    key: 'library',
    icon: 'image',
    label: 'Photos & videos',
    hint: 'Choose from your library',
  },
  {
    key: 'photo',
    icon: 'camera',
    label: 'Take a photo',
    hint: 'Use the camera',
  },
  {
    key: 'video',
    icon: 'video',
    label: 'Record a video',
    hint: 'Up to 60 seconds',
  },
];

export function AttachmentSourceSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (c: AttachmentSource) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {ATTACHMENT_SOURCES.map(o => (
          <Pressable
            key={o.key}
            onPress={() => onSelect(o.key)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.option,
              pressed && { backgroundColor: colors.surfaceAlt },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: colors.surfaceAlt }]}>
              <Icon name={o.icon} size={22} color={colors.accent} />
            </View>
            <View>
              <Text style={[styles.label, { color: colors.text }]}>
                {o.label}
              </Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                {o.hint}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0006' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 2 },
});
