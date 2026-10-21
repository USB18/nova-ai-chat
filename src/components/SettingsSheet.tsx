import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  refreshAvailableModels,
  selectableModels,
} from '../lib/gemini/modelRouter';
import { isPlausibleKey, maskKey } from '../lib/storage/secureKey';
import { useChat } from '../state/ChatContext';
import { fonts, radius, spacing, useTheme } from '../theme/theme';
import { AlertsOverlay, useAlerts } from './alerts/Alerts';
import { CornerGlow } from './CornerGlow';
import { Icon, type IconName } from './Icon';
import { NovaAvatar } from './NovaAvatar';

const CREATIVITY_PRESETS = [
  { l: 'Precise', v: 0.2 },
  { l: 'Balanced', v: 0.7 },
  { l: 'Creative', v: 1.0 },
];

function SettingsRowIcon({ name, tint }: { name: IconName; tint?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.sectionIcon,
        { backgroundColor: tint ? colors.accentSoft : colors.surfaceAlt },
      ]}
    >
      <Icon name={name} size={18} color={tint ? colors.accent : colors.text} />
    </View>
  );
}

function StatusSummaryTile({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.heroTile, { backgroundColor: colors.heroTile }]}>
      <Text style={[styles.heroTileLabel, { color: colors.heroMuted }]}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          styles.heroTileValue,
          mono && styles.mono,
          { color: accent ? colors.heroAccent : colors.heroText },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function SettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { apiKey, settings, updateSettings, setUserApiKey, clearChat } =
    useChat();
  const { toast, confirm } = useAlerts();
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [models, setModels] = useState<string[]>(selectableModels());
  const [isApiKeyExpanded, setIsApiKeyExpanded] = useState(true);
  const [isModelExpanded, setIsModelExpanded] = useState(false);

  useEffect(() => {
    if (visible) {
      setApiKeyDraft('');
      setModels(selectableModels());
      setIsApiKeyExpanded(true);
      setIsModelExpanded(false);
    }
  }, [visible]);

  const saveApiKey = async () => {
    if (!isPlausibleKey(apiKeyDraft)) {
      toast({
        kind: 'error',
        title: 'API key',
        message: 'That does not look like a valid Gemini API key.',
      });
      return;
    }
    try {
      await setUserApiKey(apiKeyDraft);
    } catch {
      toast({
        kind: 'error',
        title: 'API key',
        message: 'Could not save the key to secure storage.',
      });
      return;
    }
    await refreshAvailableModels(apiKeyDraft.trim(), true);
    setModels(selectableModels());
    setApiKeyDraft('');
    toast({ kind: 'success', message: 'API key saved.' });
  };

  const confirmClearConversation = async () => {
    const ok = await confirm({
      title: 'Clear conversation?',
      message: 'This deletes all messages and attachments on this device.',
      confirmLabel: 'Clear',
      destructive: true,
    });
    if (ok) {
      clearChat();
      onClose();
    }
  };

  const creativityIndex = CREATIVITY_PRESETS.findIndex(
    o => o.v === settings.temperature,
  );
  const creativityLabel = CREATIVITY_PRESETS[creativityIndex]?.l ?? 'Custom';
  const modelLabel =
    settings.modelMode === 'auto' ? 'Auto' : settings.modelMode;
  const connectionStatus =
    apiKey.source === 'user'
      ? { title: 'Nova is ready', sub: 'Connected with your key', ok: true }
      : apiKey.source === 'demo'
      ? { title: 'Nova is ready', sub: 'Using the built-in key', ok: true }
      : { title: 'Add an API key', sub: 'Needed to start chatting', ok: false };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close settings"
      />
      <View
        style={[
          styles.root,
          { backgroundColor: colors.bg, shadowColor: colors.shadow },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={[
              styles.closeBtn,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
          >
            <Icon name="chevronDown" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.done, { color: colors.accent }]}>Done</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colors.heroBg,
                borderColor: colors.heroBorder,
              },
            ]}
          >
            <CornerGlow />
            <View style={styles.heroTop}>
              <NovaAvatar size={48} glow />
              <View>
                <Text style={[styles.heroTitle, { color: colors.heroText }]}>
                  {connectionStatus.title}
                </Text>
                <View style={styles.heroStatus}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: connectionStatus.ok
                          ? colors.heroOk
                          : colors.danger,
                      },
                    ]}
                  />
                  <Text style={[styles.heroSub, { color: colors.heroMuted }]}>
                    {connectionStatus.sub}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.heroTiles}>
              <StatusSummaryTile
                label="Key"
                mono={apiKey.source === 'user'}
                value={
                  apiKey.source === 'user'
                    ? `••${apiKey.key.slice(-4)}`
                    : apiKey.source === 'demo'
                    ? 'Built-in'
                    : 'None'
                }
              />
              <StatusSummaryTile label="Model" value={modelLabel} accent />
              <StatusSummaryTile label="Creativity" value={creativityLabel} />
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setIsApiKeyExpanded(o => !o)}
              style={styles.rowHead}
              accessibilityRole="button"
              accessibilityState={{ expanded: isApiKeyExpanded }}
            >
              <SettingsRowIcon name="key" tint />
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Gemini API key
              </Text>
              {!isApiKeyExpanded && apiKey.source === 'user' && (
                <Text
                  style={[
                    styles.rowValue,
                    styles.mono,
                    { color: colors.textMuted },
                  ]}
                >
                  {maskKey(apiKey.key)}
                </Text>
              )}
              <Icon
                name={isApiKeyExpanded ? 'chevronUp' : 'chevronDown'}
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
            {isApiKeyExpanded && (
              <View style={styles.rowBody}>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.inset,
                    },
                  ]}
                >
                  <Icon name="lock" size={16} color={colors.textFaint} />
                  <TextInput
                    value={apiKeyDraft}
                    onChangeText={setApiKeyDraft}
                    placeholder="Paste a key from aistudio.google.com"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
                <View style={styles.row}>
                  <Pressable
                    onPress={saveApiKey}
                    style={({ pressed }) => [
                      styles.button,
                      styles.glow,
                      {
                        backgroundColor: colors.accent,
                        shadowColor: colors.accent,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.buttonText, { color: colors.accentText }]}
                    >
                      Save key
                    </Text>
                  </Pressable>
                  {apiKey.source === 'user' && (
                    <Pressable
                      onPress={() => setUserApiKey(null)}
                      accessibilityRole="button"
                      hitSlop={8}
                      style={styles.ghostButton}
                    >
                      <Text
                        style={[styles.buttonText, { color: colors.danger }]}
                      >
                        Remove
                      </Text>
                    </Pressable>
                  )}
                </View>
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  {apiKey.source === 'demo' &&
                    'Until you add one, the app uses its built-in key. '}
                  Stored in the device Keychain/Keystore. Requests go directly
                  from this device to Google.
                </Text>
              </View>
            )}

            <View
              style={[styles.divider, { backgroundColor: colors.divider }]}
            />

            <Pressable
              onPress={() => setIsModelExpanded(o => !o)}
              style={styles.rowHead}
              accessibilityRole="button"
              accessibilityState={{ expanded: isModelExpanded }}
            >
              <SettingsRowIcon name="cpu" />
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Model
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.rowValue, { color: colors.textMuted }]}
              >
                {modelLabel}
              </Text>
              <Icon
                name={isModelExpanded ? 'chevronUp' : 'chevronDown'}
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
            {isModelExpanded && (
              <View style={styles.rowBody}>
                {['auto', ...models].map(m => {
                  const active = settings.modelMode === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => updateSettings({ modelMode: m })}
                      style={styles.option}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <View
                        style={[
                          styles.radio,
                          active
                            ? {
                                backgroundColor: colors.accent,
                                borderColor: colors.accent,
                              }
                            : { borderColor: colors.border },
                        ]}
                      >
                        {active && (
                          <Icon
                            name="tick"
                            size={12}
                            strokeWidth={3}
                            color={colors.accentText}
                          />
                        )}
                      </View>
                      {m === 'auto' ? (
                        <Text
                          style={[styles.optionText, { color: colors.text }]}
                        >
                          Auto
                        </Text>
                      ) : (
                        <Text
                          style={[
                            styles.optionText,
                            styles.mono,
                            { color: colors.text },
                          ]}
                        >
                          {m}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  Auto uses a fast model for short text and a multimodal model
                  for images, video, audio and complex prompts, with automatic
                  fallback.
                </Text>
              </View>
            )}

            <View
              style={[styles.divider, { backgroundColor: colors.divider }]}
            />

            <View style={styles.rowHead}>
              <SettingsRowIcon name="sliders" />
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Creativity
              </Text>
              <Text
                style={[
                  styles.rowValue,
                  styles.strong,
                  { color: colors.accent },
                ]}
              >
                {creativityLabel}
              </Text>
            </View>
            <View style={styles.slider}>
              <View
                style={[styles.track, { backgroundColor: colors.surfaceAlt }]}
              />
              {creativityIndex >= 0 && (
                <View
                  style={[
                    styles.track,
                    {
                      backgroundColor: colors.accent,
                      right: `${100 - creativityIndex * 50}%`,
                    },
                  ]}
                />
              )}
              {CREATIVITY_PRESETS.map((o, i) => {
                const active = i === creativityIndex;
                const filled = i <= creativityIndex;
                return (
                  <Pressable
                    key={o.l}
                    onPress={() => updateSettings({ temperature: o.v })}
                    hitSlop={14}
                    style={[styles.stopHit, { left: `${i * 50}%` }]}
                    accessibilityRole="radio"
                    accessibilityLabel={o.l}
                    accessibilityState={{ selected: active }}
                  >
                    <View
                      style={
                        active
                          ? [
                              styles.thumb,
                              styles.glow,
                              {
                                backgroundColor: colors.surface,
                                borderColor: colors.accent,
                                shadowColor: colors.accent,
                              },
                            ]
                          : [
                              styles.stop,
                              {
                                backgroundColor: filled
                                  ? colors.accent
                                  : colors.border,
                              },
                            ]
                      }
                    />
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.sliderLabels}>
              {CREATIVITY_PRESETS.map((o, i) => (
                <Pressable
                  key={o.l}
                  onPress={() => updateSettings({ temperature: o.v })}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      styles.sliderLabel,
                      i === creativityIndex && styles.strong,
                      {
                        color:
                          i === creativityIndex
                            ? colors.text
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {o.l}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View
            style={[
              styles.card,
              styles.dangerCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.dangerBorder,
              },
            ]}
          >
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Clear conversation
              </Text>
              <Text
                style={[styles.hint, styles.noTop, { color: colors.textMuted }]}
              >
                Deletes all messages and attachments on this device
              </Text>
            </View>
            <Pressable
              onPress={confirmClearConversation}
              style={({ pressed }) => [
                styles.clearBtn,
                {
                  backgroundColor: colors.dangerBg,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Clear conversation"
            >
              <Text style={[styles.buttonText, { color: colors.danger }]}>
                Clear
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
      {/* Alerts must render inside the Modal, or it would sit underneath it. */}
      <AlertsOverlay topInset={insets.top + spacing.sm} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#0008' },
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '95%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  flex: { flex: 1 },
  mono: { fontFamily: fonts.mono },
  strong: { fontWeight: '700' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700' },
  done: { fontSize: 15.5, fontWeight: '600', paddingHorizontal: spacing.xs },
  hero: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heroTitle: { fontSize: 18, fontWeight: '700' },
  heroStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroSub: { fontSize: 12.5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  heroTiles: { flexDirection: 'row', gap: spacing.sm },
  heroTile: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroTileLabel: { fontSize: 10.5 },
  heroTileValue: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  rowValue: { fontSize: 13.5, maxWidth: 150 },
  rowBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  divider: { height: StyleSheet.hairlineWidth },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 14.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  ghostButton: { paddingHorizontal: spacing.lg, paddingVertical: 10 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  glow: {
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  hint: { fontSize: 12, marginTop: spacing.md, lineHeight: 17 },
  noTop: { marginTop: 2 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { fontSize: 14, flexShrink: 1 },
  slider: {
    height: 28,
    marginHorizontal: spacing.lg + 8,
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
  },
  stopHit: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stop: { width: 12, height: 12, borderRadius: 6 },
  thumb: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  sliderLabel: { fontSize: 12 },
  section: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  clearBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
});
