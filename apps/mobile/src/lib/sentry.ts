// H7 — Observabilidad Sentry (mobile). No-op sin EXPO_PUBLIC_SENTRY_DSN.
import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
}

export function reportError(error: unknown): void {
  if (!dsn) return;
  if (error instanceof Error) Sentry.captureException(error);
  else Sentry.captureMessage(String(error));
}
