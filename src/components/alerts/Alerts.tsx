import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '../../theme/theme';
import { Icon, type IconName } from '../Icon';

/**
 * In-app alerts: toasts and confirm dialogs, replacing the native Alert.
 *
 *   const { toast, confirm } = useAlerts();
 *   toast({ kind: 'error', title: 'Voice input', message: '…' });
 *   if (await confirm({ title: 'Delete?', destructive: true })) { … }
 *
 * A native <Modal> draws above everything in the root view, so any screen
 * rendered inside a Modal must also render a <AlertsOverlay />. Only the most
 * recently mounted host draws, so alerts always appear on the top layer.
 */

export type ToastKind = 'error' | 'success' | 'info';

export interface ToastOptions {
  message: string;
  title?: string;
  kind?: ToastKind;
  durationMs?: number;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface AlertsApi {
  toast: (opts: ToastOptions) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

interface ActiveToast extends Required<Omit<ToastOptions, 'title'>> {
  id: number;
  title?: string;
}

interface ActiveDialog extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

interface AlertsState {
  toast: ActiveToast | null;
  dialog: ActiveDialog | null;
  activeHost: number | undefined;
  registerHost: (id: number) => () => void;
  dismissToast: () => void;
  closeDialog: (ok: boolean) => void;
}

const AlertActionsContext = createContext<AlertsApi | null>(null);
const AlertStateContext = createContext<AlertsState | null>(null);

let nextToastId = 0;
let nextHostId = 0;

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [toastState, setToast] = useState<ActiveToast | null>(null);
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const [hosts, setHosts] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dialogRef = useRef<ActiveDialog | null>(null);
  dialogRef.current = dialog;

  const dismissToast = useCallback(() => {
    clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const toast = useCallback((opts: ToastOptions) => {
    const next: ActiveToast = {
      id: ++nextToastId,
      title: opts.title,
      message: opts.message,
      kind: opts.kind ?? 'info',
      durationMs: opts.durationMs ?? (opts.kind === 'error' ? 5000 : 3000),
    };
    clearTimeout(timerRef.current);
    setToast(next);
    timerRef.current = setTimeout(() => setToast(null), next.durationMs);
    AccessibilityInfo.announceForAccessibility(
      next.title ? `${next.title}. ${next.message}` : next.message,
    );
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>(resolve => {
        dialogRef.current?.resolve(false); // a newer dialog cancels an open one
        setDialog({ ...opts, resolve });
      }),
    [],
  );

  const closeDialog = useCallback((ok: boolean) => {
    dialogRef.current?.resolve(ok);
    setDialog(null);
  }, []);

  const registerHost = useCallback((id: number) => {
    setHosts(h => [...h, id]);
    return () => setHosts(h => h.filter(x => x !== id));
  }, []);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      dialogRef.current?.resolve(false);
    },
    [],
  );

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const state = useMemo<AlertsState>(
    () => ({
      toast: toastState,
      dialog,
      activeHost: hosts[hosts.length - 1],
      registerHost,
      dismissToast,
      closeDialog,
    }),
    [toastState, dialog, hosts, registerHost, dismissToast, closeDialog],
  );

  return (
    <AlertActionsContext.Provider value={api}>
      <AlertStateContext.Provider value={state}>
        {children}
      </AlertStateContext.Provider>
    </AlertActionsContext.Provider>
  );
}

export function useAlerts(): AlertsApi {
  const ctx = useContext(AlertActionsContext);
  if (!ctx) {
    throw new Error('useAlerts must be used inside <AlertsProvider>');
  }
  return ctx;
}

/** Overlay that draws the current toast/dialog. Render as the last child of a full-screen container. */
export function AlertsOverlay({ topInset }: { topInset?: number }) {
  const state = useContext(AlertStateContext);
  const idRef = useRef<number | null>(null);
  if (idRef.current === null) {
    idRef.current = ++nextHostId;
  }
  const register = state?.registerHost;
  useEffect(() => register?.(idRef.current!), [register]);

  if (!state || state.activeHost !== idRef.current) {
    return null;
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {state.dialog && (
        <ConfirmDialog dialog={state.dialog} onClose={state.closeDialog} />
      )}
      {state.toast && (
        <ToastBanner
          key={state.toast.id}
          toast={state.toast}
          topInset={topInset}
          onDismiss={state.dismissToast}
        />
      )}
    </View>
  );
}

const TOAST_ICON: Record<ToastKind, IconName> = {
  error: 'alert',
  success: 'check',
  info: 'info',
};

function ToastBanner({
  toast,
  topInset,
  onDismiss,
}: {
  toast: ActiveToast;
  topInset?: number;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [anim]);

  const accent =
    toast.kind === 'error'
      ? colors.danger
      : toast.kind === 'success'
      ? colors.success
      : colors.accent;

  return (
    <Animated.View
      style={[
        styles.toastWrap,
        {
          top: (topInset ?? insets.top) + spacing.sm,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-24, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityHint="Tap to dismiss"
        style={[
          styles.toast,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Icon name={TOAST_ICON[toast.kind]} size={20} color={accent} />
        <View style={styles.toastBody}>
          {!!toast.title && (
            <Text style={[styles.toastTitle, { color: colors.text }]}>
              {toast.title}
            </Text>
          )}
          <Text style={[styles.toastMsg, { color: colors.textMuted }]}>
            {toast.message}
          </Text>
        </View>
        <Icon name="close" size={16} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

function ConfirmDialog({
  dialog,
  onClose,
}: {
  dialog: ActiveDialog;
  onClose: (ok: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.backdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => onClose(false)}
        accessibilityLabel="Dismiss dialog"
      />
      <View
        style={[styles.dialog, { backgroundColor: colors.surface }]}
        accessibilityViewIsModal
        accessibilityRole="alert"
      >
        <Text style={[styles.dialogTitle, { color: colors.text }]}>
          {dialog.title}
        </Text>
        {!!dialog.message && (
          <Text style={[styles.dialogMsg, { color: colors.textMuted }]}>
            {dialog.message}
          </Text>
        )}
        <View style={styles.dialogActions}>
          <Pressable
            onPress={() => onClose(false)}
            accessibilityRole="button"
            style={[styles.dialogBtn, { backgroundColor: colors.surfaceAlt }]}
          >
            <Text style={[styles.dialogBtnText, { color: colors.text }]}>
              {dialog.cancelLabel ?? 'Cancel'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onClose(true)}
            accessibilityRole="button"
            style={[
              styles.dialogBtn,
              {
                backgroundColor: dialog.destructive
                  ? colors.danger
                  : colors.accent,
              },
            ]}
          >
            <Text
              style={[
                styles.dialogBtnText,
                {
                  color: dialog.destructive
                    ? colors.surface
                    : colors.accentText,
                },
              ]}
            >
              {dialog.confirmLabel ?? 'OK'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    width: '100%',
    maxWidth: 480,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastBody: { flex: 1 },
  toastTitle: { fontSize: 14.5, fontWeight: '700', marginBottom: 2 },
  toastMsg: { fontSize: 13.5, lineHeight: 19 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0008',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  dialogTitle: { fontSize: 18, fontWeight: '700' },
  dialogMsg: { fontSize: 14.5, lineHeight: 20, marginTop: spacing.sm },
  dialogActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  dialogBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: radius.pill,
  },
  dialogBtnText: { fontSize: 15, fontWeight: '700' },
});
