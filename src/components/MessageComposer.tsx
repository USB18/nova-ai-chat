import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LIMITS } from '../config/env';
import {
  PickError,
  captureWithCamera,
  pickFromLibrary,
} from '../lib/media/pickMedia';
import { deleteFile } from '../lib/media/files';
import { useVoiceInput } from '../lib/speech/useVoiceInput';
import { radius, spacing, useTheme } from '../theme/theme';
import type { Attachment } from '../types/chat';
import {
  AttachmentSourceSheet,
  type AttachmentSource,
} from './AttachmentSourceSheet';
import { AttachmentPreview } from './AttachmentPreview';
import { useAlerts } from './alerts/Alerts';
import { Icon } from './Icon';

interface MessageComposerProps {
  apiKey: string;
  busy: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
}

export function MessageComposer({
  apiKey,
  busy,
  onSend,
  onStop,
}: MessageComposerProps) {
  const { colors } = useTheme();
  const { toast } = useAlerts();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSourceSheetOpen, setIsSourceSheetOpen] = useState(false);
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const textBeforeDictationRef = useRef(''); // text typed before dictation started

  const voice = useVoiceInput({
    apiKey,
    onTranscript: (t, final) => {
      const base = textBeforeDictationRef.current;
      setText(t ? (base ? `${base} ${t}` : t) : base);
      if (final) {
        textBeforeDictationRef.current = '';
      }
    },
    onError: msg =>
      toast({ kind: 'error', title: 'Voice input', message: msg }),
  });

  const addAttachmentFrom = useCallback(
    async (choice: AttachmentSource) => {
      setIsSourceSheetOpen(false);
      setIsAddingAttachment(true);
      try {
        // Let the source sheet finish dismissing; iOS can't present a picker over a closing modal.
        await new Promise<void>(r =>
          setTimeout(r, Platform.OS === 'ios' ? 450 : 0),
        );
        const remaining = LIMITS.maxAttachments - attachments.length;
        const picked =
          choice === 'library'
            ? await pickFromLibrary(remaining)
            : await captureWithCamera(choice);
        setAttachments(a => [...a, ...picked].slice(0, LIMITS.maxAttachments));
      } catch (e) {
        toast({
          kind: 'error',
          title: 'Attachment',
          message:
            e instanceof PickError ? e.message : 'Could not add that file.',
        });
      } finally {
        setIsAddingAttachment(false);
      }
    },
    [attachments.length, toast],
  );

  const removeAttachment = (id: string) => {
    setAttachments(a => {
      const gone = a.find(x => x.id === id);
      if (gone) {
        deleteFile(gone.localUri);
      }
      return a.filter(x => x.id !== id);
    });
  };

  const sendMessage = () => {
    if (busy || voice.state !== 'idle') {
      return;
    }
    if (!text.trim() && !attachments.length) {
      return;
    }
    onSend(text, attachments);
    setText('');
    setAttachments([]);
  };

  const toggleVoiceRecording = () => {
    if (voice.state === 'idle') {
      textBeforeDictationRef.current = text.trim();
      voice.start();
    } else if (voice.state === 'recording') {
      voice.stop();
    }
  };

  const canSend =
    !!(text.trim() || attachments.length) && voice.state === 'idle';
  const recordedSeconds = Math.floor(voice.elapsed);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.attachRow}
        >
          {attachments.map(a => (
            <AttachmentPreview
              key={a.id}
              attachment={a}
              onRemove={() => removeAttachment(a.id)}
            />
          ))}
        </ScrollView>
      )}

      {voice.state === 'recording' ? (
        <View style={styles.recRow}>
          <Pressable
            onPress={voice.cancel}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancel recording"
          >
            <Text style={[styles.recCancel, { color: colors.textMuted }]}>
              Cancel
            </Text>
          </Pressable>
          <View
            style={[styles.meterTrack, { backgroundColor: colors.surfaceAlt }]}
          >
            <View
              style={[
                styles.meterFill,
                {
                  backgroundColor: colors.accent,
                  width: `${Math.max(4, voice.level * 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.recTime, { color: colors.text }]}>
            {Math.floor(recordedSeconds / 60)}:
            {String(recordedSeconds % 60).padStart(2, '0')}
          </Text>
        </View>
      ) : (
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={
            voice.state === 'transcribing' ? 'Transcribing…' : 'Message Nova'
          }
          placeholderTextColor={colors.textFaint}
          style={[styles.input, { color: colors.text }]}
          multiline
          maxLength={8000}
          editable={voice.state === 'idle'}
          accessibilityLabel="Message input"
        />
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => setIsSourceSheetOpen(true)}
          disabled={
            busy ||
            isAddingAttachment ||
            voice.state !== 'idle' ||
            attachments.length >= LIMITS.maxAttachments
          }
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add image or video"
        >
          {isAddingAttachment ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Icon name="plus" size={20} color={colors.text} />
          )}
        </Pressable>

        <View style={styles.spacer} />

        <Pressable
          onPress={toggleVoiceRecording}
          disabled={busy || voice.state === 'transcribing'}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor:
                voice.state === 'recording' ? colors.danger : colors.surfaceAlt,
              borderColor:
                voice.state === 'recording' ? colors.danger : colors.border,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            voice.state === 'recording'
              ? 'Stop recording and transcribe'
              : 'Voice input'
          }
        >
          {voice.state === 'transcribing' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Icon
              name={voice.state === 'recording' ? 'stop' : 'mic'}
              size={voice.state === 'recording' ? 16 : 20}
              color={voice.state === 'recording' ? '#fff' : colors.text}
            />
          )}
        </Pressable>

        {busy ? (
          <Pressable
            onPress={onStop}
            style={[
              styles.sendBtn,
              styles.sendGlow,
              { backgroundColor: colors.accent, shadowColor: colors.accent },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Stop generating"
          >
            <View
              style={[
                styles.stopSquare,
                { backgroundColor: colors.accentText },
              ]}
            />
          </Pressable>
        ) : (
          <Pressable
            onPress={sendMessage}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              canSend && styles.sendGlow,
              {
                backgroundColor: canSend ? colors.accent : colors.surfaceAlt,
                shadowColor: colors.accent,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Icon
              name="arrowUp"
              size={20}
              strokeWidth={2.5}
              color={canSend ? colors.accentText : colors.textFaint}
            />
          </Pressable>
        )}
      </View>

      <AttachmentSourceSheet
        visible={isSourceSheetOpen}
        onClose={() => setIsSourceSheetOpen(false)}
        onSelect={addAttachmentFrom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  attachRow: {
    gap: spacing.sm,
    paddingTop: 6,
    paddingHorizontal: 6,
    paddingBottom: spacing.sm,
  },
  input: {
    minHeight: 40,
    maxHeight: 140,
    fontSize: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  recCancel: { fontSize: 14, fontWeight: '600' },
  meterTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3 },
  recTime: {
    fontVariant: ['tabular-nums'],
    fontSize: 14,
    minWidth: 36,
    textAlign: 'right',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spacer: { flex: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendGlow: {
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  stopSquare: { width: 12, height: 12, borderRadius: 2 },
});
