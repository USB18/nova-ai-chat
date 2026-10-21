import React, { memo, useMemo } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { type Colors, fonts, radius, spacing, useTheme } from '../theme/theme';
import type { AssistantMessage, ChatMessage, UserMessage } from '../types/chat';
import { AttachmentPreview } from './AttachmentPreview';
import { CornerGlow } from './CornerGlow';
import { Icon } from './Icon';
import { NovaAvatar } from './NovaAvatar';
import { ToolStatusChip } from './ToolStatusChip';
import { TypingIndicator } from './TypingIndicator';

interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
  busy: boolean;
  onRetry: (id: string) => void;
}

function MessageBubbleImpl({
  message,
  isLast,
  busy,
  onRetry,
}: MessageBubbleProps) {
  return message.role === 'user' ? (
    <UserMessageBubble message={message} />
  ) : (
    <AssistantMessageCard
      message={message}
      canRetry={isLast && !busy}
      onRetry={onRetry}
    />
  );
}

export const MessageBubble = memo(MessageBubbleImpl);

function UserMessageBubble({ message }: { message: UserMessage }) {
  const { colors } = useTheme();
  return (
    <View style={styles.userRow}>
      {message.attachments.length > 0 && (
        <View style={styles.userMedia}>
          {message.attachments.map(a => (
            <AttachmentPreview
              key={a.id}
              attachment={a}
              size={message.attachments.length === 1 ? 180 : 88}
            />
          ))}
        </View>
      )}
      {!!message.text && (
        <View
          style={[
            styles.userBubble,
            {
              backgroundColor: colors.userBubble,
              borderColor: colors.userBorder,
            },
          ]}
        >
          <CornerGlow opacity={0.45} />
          <Text
            selectable
            style={[styles.userText, { color: colors.userText }]}
          >
            {message.text}
          </Text>
        </View>
      )}
    </View>
  );
}

function AssistantMessageCard({
  message,
  canRetry,
  onRetry,
}: {
  message: AssistantMessage;
  canRetry: boolean;
  onRetry: (id: string) => void;
}) {
  const { colors } = useTheme();
  const markdownStyles = useMemo(() => createMarkdownStyles(colors), [colors]);
  const showTypingIndicator =
    (message.status === 'pending' || message.status === 'streaming') &&
    !message.text &&
    !message.toolCalls.some(t => t.status === 'running');

  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatar}>
        <NovaAvatar />
      </View>
      <Pressable
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onLongPress={() =>
          message.text && Share.share({ message: message.text })
        }
        delayLongPress={350}
      >
        {message.toolCalls.length > 0 && (
          <View style={styles.tools}>
            {message.toolCalls.map(call => (
              <ToolStatusChip key={call.id} call={call} />
            ))}
          </View>
        )}
        {!!message.text && (
          <Markdown style={markdownStyles}>
            {message.text + (message.status === 'streaming' ? ' ▍' : '')}
          </Markdown>
        )}
        {showTypingIndicator && <TypingIndicator />}

        {message.status === 'error' && (
          <View style={[styles.error, { backgroundColor: colors.dangerBg }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {message.error}
            </Text>
            {canRetry && (
              <Pressable
                onPress={() => onRetry(message.id)}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={[styles.retry, { color: colors.danger }]}>
                  Retry
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {(message.status === 'done' || message.status === 'stopped') && (
          <View style={[styles.footer, { borderTopColor: colors.divider }]}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {message.status === 'stopped' ? 'Stopped · ' : ''}
              {message.model ?? ''}
            </Text>
            {canRetry && (
              <Pressable
                onPress={() => onRetry(message.id)}
                accessibilityRole="button"
                accessibilityLabel="Regenerate response"
                hitSlop={8}
                style={styles.regen}
              >
                <Icon name="refresh" size={14} color={colors.textMuted} />
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  Regenerate
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

function createMarkdownStyles(c: Colors) {
  return StyleSheet.create({
    body: { color: c.text, fontSize: 15, lineHeight: 23 },
    heading1: { fontSize: 21, fontWeight: '700', marginVertical: 6 },
    heading2: { fontSize: 18, fontWeight: '700', marginVertical: 6 },
    heading3: { fontSize: 16, fontWeight: '700', marginVertical: 4 },
    code_inline: {
      backgroundColor: c.codeBg,
      color: c.codeText,
      fontFamily: fonts.mono,
      fontSize: 13.5,
      borderRadius: 4,
      paddingHorizontal: 4,
    },
    fence: {
      backgroundColor: c.inset,
      color: c.text,
      fontFamily: fonts.mono,
      fontSize: 13,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: spacing.md,
    },
    code_block: {
      backgroundColor: c.inset,
      color: c.text,
      fontFamily: fonts.mono,
      fontSize: 13,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    blockquote: {
      backgroundColor: c.surfaceAlt,
      borderLeftColor: c.accent,
      borderLeftWidth: 3,
      paddingHorizontal: spacing.md,
    },
    link: { color: c.accent },
    hr: { backgroundColor: c.border },
    table: { borderColor: c.border },
    tr: { borderColor: c.border },
    bullet_list_icon: { color: c.textMuted },
    ordered_list_icon: { color: c.textMuted },
  });
}

const styles = StyleSheet.create({
  userRow: {
    alignItems: 'flex-end',
    marginVertical: spacing.sm,
    paddingLeft: 48,
  },
  userMedia: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 6,
  },
  userBubble: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderBottomRightRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userText: { fontSize: 15, lineHeight: 22 },
  assistantRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: spacing.sm,
  },
  avatar: { paddingTop: 4 },
  card: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    borderTopLeftRadius: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  errorText: { flex: 1, fontSize: 14 },
  retry: { fontWeight: '700', fontSize: 14 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
    paddingTop: 10,
  },
  meta: { fontSize: 12.5 },
  regen: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
