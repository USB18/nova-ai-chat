import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, useTheme } from '../theme/theme';
import type { Attachment } from '../types/chat';
import { Icon } from './Icon';

function formatDuration(secs?: number) {
  if (!secs) {
    return '';
  }
  const s = Math.round(secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function AttachmentPreviewImpl({
  attachment,
  size = 64,
  onRemove,
}: {
  attachment: Attachment;
  size?: number;
  onRemove?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {attachment.kind === 'image' ? (
        <Image
          source={{ uri: attachment.localUri }}
          style={[styles.media, { backgroundColor: colors.surfaceAlt }]}
          resizeMode="cover"
          accessibilityLabel={`Image ${attachment.fileName}`}
        />
      ) : (
        <View
          style={[styles.media, styles.video]}
          accessibilityLabel={`Video ${attachment.fileName}`}
        >
          <Icon name="play" size={22} color="#fff" />
          <Text style={styles.dur}>
            {formatDuration(attachment.durationSecs)}
          </Text>
        </View>
      )}
      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={styles.remove}
          accessibilityRole="button"
          accessibilityLabel="Remove attachment"
        >
          <Icon name="close" size={12} strokeWidth={3} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

export const AttachmentPreview = memo(AttachmentPreviewImpl);

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, overflow: 'visible' },
  media: { width: '100%', height: '100%', borderRadius: radius.md },
  video: {
    backgroundColor: '#1d1f24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dur: {
    color: '#ddd',
    fontSize: 10,
    position: 'absolute',
    bottom: 4,
    right: 6,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#000c',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
