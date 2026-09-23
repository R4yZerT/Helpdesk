// H7 — Observabilidad Sentry (web). No-op sin EXPO_PUBLIC_SENTRY_DSN.
import * as Sentry from '@sentry/react';

declare const process: { env: Record<string, string | undefined> };
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const env = process.env.EXPO_PUBLIC_ENV ?? process.env.NODE_ENV ?? 'development';

if (dsn) {
  Sentry.init({ dsn, environment: env, tracesSampleRate: 0.1 });
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}

export function reportError(error: unknown, context?: Record<string, string>): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // En dev siempre hay traza local aunque no haya DSN.
    // eslint-disable-next-line no-console
    console.error('[reportError]', error, context ?? '');
  }
  if (!dsn) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext('extra', context);
    scope.setTag('plataforma', 'web');
    Sentry.captureException(toError(error));
  });
}

export function reportMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!dsn) return;
  Sentry.captureMessage(message, level);
}
