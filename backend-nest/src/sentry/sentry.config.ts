import * as Sentry from '@sentry/nestjs';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
    });
  }
}
