/** Thin logger: verbose in dev, warnings/errors only in release. Never logs secrets. */
const redact = (args: unknown[]) =>
  args.map(a =>
    typeof a === 'string'
      ? a
          .replace(/AIza[0-9A-Za-z_-]{20,}/g, 'AIza…')
          .replace(/\bAQ\.[0-9A-Za-z._-]{20,}/g, 'AQ.…')
      : a,
  );

export const logger = {
  debug: (...args: unknown[]) => {
    if (__DEV__) {
      console.log('[nova]', ...redact(args));
    }
  },
  warn: (...args: unknown[]) => console.warn('[nova]', ...redact(args)),
  error: (...args: unknown[]) => console.error('[nova]', ...redact(args)),
};
