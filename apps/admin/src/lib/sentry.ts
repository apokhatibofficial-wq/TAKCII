import * as Sentry from '@sentry/react';

// Mirrors apps/driver/src/lib/sentry.ts — same minimal init, no-op until a
// real DSN is set (see .env.example).
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn });
}
