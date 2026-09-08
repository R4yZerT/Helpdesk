// Modal unificado de feedback — éxito / error / confirmación
// Uso: reemplaza Alert/window.alert y banners inline en CRUDs críticos
import * as React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme.js';

export type FeedbackVariant = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export function FeedbackModal({
  visible,
  variant = 'info',
  title,
  message,
  confirmText,
  cancelText,
  loading,
  onConfirm,
  onClose,
  onCancel,
}: {
  visible: boolean;
  variant?: FeedbackVariant;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
  onCancel?: () => void;
}) {
  const isConfirm = variant === 'confirm';
  const accent = (() => {
    if (variant === 'success') return { bg: '#ECFDF5', border: '#A7F3D0', fg: '#065F46', icon: '✓' };
    if (variant === 'error') return { bg: '#FEF2F2', border: '#FECACA', fg: '#991B1B', icon: '✕' };
    if (variant === 'warning') return { bg: '#FFFBEB', border: '#FDE68A', fg: '#92400E', icon: '!' };
    if (variant === 'confirm') return { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1E40AF', icon: '?' };
    return { bg: theme.colors.surfaceAlt, border: theme.colors.border, fg: theme.colors.textSoft, icon: 'i' };
  })();

  const primaryLabel = confirmText ?? (isConfirm ? 'Confirmar' : 'Entendido');
  const secondaryLabel = cancelText ?? 'Cancelar';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar modal" />
        <View style={s.card}>
          <View style={[s.iconWrap, { backgroundColor: accent.bg, borderColor: accent.border }]}>
            <Text style={[s.iconText, { color: accent.fg }]}>{accent.icon}</Text>
          </View>
          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.message}>{message}</Text> : null}
          <View style={s.actions}>
            {isConfirm ? (
              <>
                <Pressable onPress={onCancel ?? onClose} style={s.btnGhost} accessibilityRole="button" accessibilityLabel={secondaryLabel}>
                  <Text style={s.btnGhostText}>{secondaryLabel}</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirm ?? onClose}
                  disabled={!!loading}
                  style={[s.btnPrimary, loading && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={primaryLabel}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>{primaryLabel}</Text>}
                </Pressable>
              </>
            ) : (
              <Pressable onPress={onConfirm ?? onClose} style={[s.btnPrimary, variant === 'error' && s.btnDanger]} accessibilityRole="button">
                <Text style={s.btnPrimaryText}>{primaryLabel}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18, fontWeight: '800' },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  message: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6, alignSelf: 'stretch', justifyContent: 'center' },
  btnPrimary: {
    flex: 1,
    maxWidth: 200,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnDanger: { backgroundColor: theme.colors.danger },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  btnGhost: {
    flex: 1,
    maxWidth: 200,
    height: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnGhostText: { color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 },
});
