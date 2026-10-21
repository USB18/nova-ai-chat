import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { MessageComposer } from '../components/MessageComposer';
import { Icon } from '../components/Icon';
import { MessageBubble } from '../components/MessageBubble';
import { NovaAvatar } from '../components/NovaAvatar';
import { SettingsSheet } from '../components/SettingsSheet';
import { useChat } from '../state/ChatContext';
import { radius, spacing, useTheme } from '../theme/theme';
import type { ChatMessage } from '../types/chat';

const STARTER_PROMPTS = [
  "What's the weather in Hyderabad for the next 3 days?",
  'What is (17.5% of 2,340) + sqrt(1764)?',
  'Explain how black holes form in 3 bullet points',
  'Attach a photo and ask me what is in it',
];

export function ChatScreen() {
  const { colors, dark } = useTheme();
  const {
    ready,
    messages,
    busy,
    activity,
    apiKey,
    send,
    stop,
    retry,
    clearChat,
  } = useChat();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Inverted list: newest at the bottom, keeps scroll pinned while streaming.
  const messagesNewestFirst = useMemo(
    () => [...messages].reverse(),
    [messages],
  );
  const lastId = messages[messages.length - 1]?.id;

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageBubble
        message={item}
        isLast={item.id === lastId}
        busy={busy}
        onRetry={retry}
      />
    ),
    [lastId, busy, retry],
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <HeaderGlow color={colors.accent} />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={clearChat}
          disabled={busy || !messages.length}
          hitSlop={10}
          style={({ pressed }) => [
            styles.newBtn,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="New chat"
        >
          <Text
            style={[
              styles.headerBtn,
              {
                color:
                  messages.length && !busy ? colors.text : colors.textFaint,
              },
            ]}
          >
            New
          </Text>
          <Icon
            name="plus"
            size={16}
            color={messages.length && !busy ? colors.text : colors.textFaint}
          />
        </Pressable>
        <View style={styles.titleRow}>
          <NovaAvatar glow />
          <Text style={[styles.title, { color: colors.text }]}>Nova</Text>
        </View>
        <Pressable
          onPress={() => setIsSettingsOpen(true)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Icon name="settings" size={18} color={colors.text} />
        </Pressable>
      </View>

      {apiKey.source === 'none' && ready && (
        <Pressable
          onPress={() => setIsSettingsOpen(true)}
          style={[styles.banner, { backgroundColor: colors.dangerBg }]}
          accessibilityRole="button"
        >
          <Icon name="alert" size={16} color={colors.danger} />
          <Text style={[styles.bannerText, { color: colors.danger }]}>
            Add your Gemini API key in Settings to start chatting
          </Text>
          <Icon name="chevronRight" size={16} color={colors.danger} />
        </Pressable>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {ready && messages.length === 0 ? (
          <View style={styles.empty}>
            <NovaAvatar size={44} glow />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              How can I help?
            </Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Type, talk, or attach photos and videos.
            </Text>
            <View style={styles.suggestions}>
              {STARTER_PROMPTS.map(s => (
                <Pressable
                  key={s}
                  onPress={() => !s.startsWith('Attach') && send(s, [])}
                  style={({ pressed }) => [
                    styles.suggestion,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.suggestionText, { color: colors.text }]}>
                    {s}
                  </Text>
                  <Icon
                    name="chevronRight"
                    size={16}
                    color={colors.textFaint}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={messagesNewestFirst}
            inverted
            keyExtractor={m => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={11}
          />
        )}

        {!!activity && (
          <View style={styles.activityRow}>
            {[1, 0.6, 0.3].map(o => (
              <View
                key={o}
                style={[
                  styles.activityDot,
                  { backgroundColor: colors.accent, opacity: o },
                ]}
              />
            ))}
            <Text style={[styles.activity, { color: colors.textMuted }]}>
              {activity}
            </Text>
          </View>
        )}
        <MessageComposer
          apiKey={apiKey.key}
          busy={busy}
          onSend={send}
          onStop={stop}
        />
      </KeyboardAvoidingView>

      <SettingsSheet
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </SafeAreaView>
  );
}

/** Soft accent glow behind the header. */
function HeaderGlow({ color }: { color: string }) {
  return (
    <Svg style={styles.glow} pointerEvents="none">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="0%" rx="70%" ry="100%">
          <Stop offset="0" stopColor={color} stopOpacity={0.14} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#glow)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: { fontSize: 13.5, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bannerText: { flex: 1, fontSize: 13.5 },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: spacing.lg,
  },
  emptySub: { fontSize: 15, marginTop: spacing.xs, marginBottom: spacing.xl },
  suggestions: { gap: spacing.sm },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  suggestionText: { flex: 1, fontSize: 14.5, lineHeight: 20 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  activityDot: { width: 6, height: 6, borderRadius: 3 },
  activity: { fontSize: 12.5, marginLeft: 4 },
});
