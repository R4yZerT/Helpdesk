// Hook de feedback unificado — reemplaza Alert.alert / alert / window.alert.
// Uso: const fb = useFeedback(); fb.show('Título', 'mensaje', 'error');
//      fb.ask({ title, message, confirmText, onConfirm }); … {fb.modal}
import * as React from 'react';
import { FeedbackModal, type FeedbackVariant } from './FeedbackModal.js';

export type FeedbackShowOpts = {
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
};

type FeedbackState = {
  key: number;
  variant: FeedbackVariant;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
};

export function useFeedback() {
  const [state, setState] = React.useState<FeedbackState | null>(null);

  const close = React.useCallback(() => setState(null), []);

  const show = React.useCallback(
    (title: string, message?: string, variant: FeedbackVariant = 'info', opts?: FeedbackShowOpts) => {
      setState({
        key: Date.now(),
        variant,
        title,
        message,
        confirmText: opts?.confirmText,
        cancelText: opts?.cancelText,
        onConfirm: opts?.onConfirm,
      });
    },
    [],
  );

  const ask = React.useCallback(
    (opts: { title: string; message?: string; confirmText?: string; cancelText?: string; onConfirm: () => void | Promise<void> }) => {
      setState({ key: Date.now(), variant: 'confirm', ...opts });
    },
    [],
  );

  const handleConfirm = React.useCallback(() => {
    const cb = state?.onConfirm;
    setState(null);
    if (cb) void cb();
  }, [state]);

  const modal = state ? (
    <FeedbackModal
      key={state.key}
      visible
      variant={state.variant}
      title={state.title}
      message={state.message}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      onConfirm={handleConfirm}
      onClose={close}
    />
  ) : null;

  return { show, ask, close, modal };
}
