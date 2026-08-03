// Playtest telemetry: every entry goes to a localStorage ring buffer (so
// offline/hot-seat sessions keep their evidence) and, when a backend is
// configured, fire-and-forget to the Convex `telemetry` table
// (convex/telemetry.ts). Service layer only — never import from src/engine/.

import { api } from '../../convex/_generated/api';
import { convex } from './convex';

export type TelemetryKind = 'error' | 'unhandledrejection' | 'react-error' | 'note' | 'flow';

/**
 * Build stamp from `define` in vite.config.ts. The typeof guard covers
 * contexts where define never ran (plain node importing this module).
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

/**
 * Rides along on game mutations so their server-side flow rows carry the same
 * build and page-load id as this tab's client rows. The server cannot derive
 * either one, and without them a crash here cannot be joined to the turn
 * there.
 */
export function clientStamp(): { appVersion: string; sessionId: string } {
  return { appVersion: APP_VERSION, sessionId };
}

export interface TelemetryEntry {
  kind: TelemetryKind;
  message: string;
  data?: unknown;
  context: { href: string; ua: string; sessionId: string; ts: number; appVersion: string };
}

const BUFFER_KEY = 'dd-telemetry';
const BUFFER_MAX = 100;
const DEDUPE_MS = 5_000;

/**
 * Random per page load — groups one session's entries in the sink. Exported
 * so game mutations can stamp it onto their server-side flow rows: without it
 * a client crash cannot be joined to the server turn that caused it.
 */
export const sessionId = Math.random().toString(36).slice(2, 10);

/** dedupe key → last logged ts; stops error loops from flooding. */
const lastLogged = new Map<string, number>();

/**
 * Dedupe key. Errors collapse on kind+message alone — a loop throwing the same
 * error is exactly what the window exists to swallow, and its payload (a stack,
 * a line number) is noise that would defeat the collapse.
 *
 * 'flow' rows additionally key on their data, because flow events are COUNTED:
 * they feed the digest funnels, and a beacon dropped inside the window would
 * silently deflate a rate rather than announce itself. Two hot-seat turns or
 * two route changes inside 5 s are ordinary play, and they differ by {turn} or
 * {name}. A genuine flood — a GPU thrashing `webgl-context-lost`, a retry loop
 * — repeats *identically*, so it still collapses. Narrower rule, same guard.
 */
function dedupeKey(kind: TelemetryKind, message: string, data: unknown): string {
  const base = `${kind}\n${message}`;
  if (kind !== 'flow' || data === undefined) return base;
  try {
    return `${base}\n${JSON.stringify(data)}`;
  } catch {
    // Circular or otherwise unserialisable — fall back to collapsing on the
    // message, which is the safe direction: at worst we drop a duplicate.
    return base;
  }
}

export function logTelemetry(kind: TelemetryKind, message: string, data?: unknown): void {
  try {
    const now = Date.now();
    const key = dedupeKey(kind, message, data);
    const prev = lastLogged.get(key);
    if (prev !== undefined && now - prev < DEDUPE_MS) return;
    lastLogged.set(key, now);

    const entry: TelemetryEntry = {
      kind,
      message: String(message).slice(0, 2_000),
      data,
      context: {
        href: typeof location !== 'undefined' ? location.href : '',
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        sessionId,
        ts: now,
        appVersion: APP_VERSION,
      },
    };

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(BUFFER_KEY);
        const buffer: unknown[] = raw ? JSON.parse(raw) : [];
        buffer.push(entry);
        localStorage.setItem(BUFFER_KEY, JSON.stringify(buffer.slice(-BUFFER_MAX)));
      } catch {
        // Quota or a corrupted buffer — the Convex path below still runs.
      }
    }

    convex?.mutation(api.telemetry.log, entry).catch(() => {});
  } catch {
    // Telemetry must never crash — or recurse into — the app it watches.
  }
}

/**
 * Client-side game-flow breadcrumb (kind 'flow') — mirrors the server's
 * logFlow in convex/helpers.ts. For lifecycle moments the server can't see:
 * renderer fallback, push-subscribe failure, PWA install.
 */
export function logFlowEvent(event: string, data?: unknown): void {
  logTelemetry('flow', event, data);
}

/** The local ring buffer (for console spelunking after an offline session). */
export function dumpTelemetry(): unknown[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(BUFFER_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

declare global {
  interface Window {
    /** Console escape hatch: ddTelemetry.dump() / ddTelemetry.note('...'). */
    ddTelemetry?: { dump(): unknown[]; note(text: string): void };
  }
}

/** Wire window error/rejection capture + the ddTelemetry console handle. */
export function installGlobalTelemetry(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    logTelemetry('error', event.message || 'Unknown error', {
      source: event.filename,
      line: event.lineno,
      col: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    logTelemetry(
      'unhandledrejection',
      reason instanceof Error ? reason.message : String(reason),
      { stack: reason instanceof Error ? reason.stack : undefined },
    );
  });

  window.ddTelemetry = {
    dump: dumpTelemetry,
    note: (text: string) => logTelemetry('note', text),
  };
}
