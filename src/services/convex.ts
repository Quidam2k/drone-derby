import { ConvexReactClient } from 'convex/react';

/**
 * The Convex client, or null when no backend is configured (offline build /
 * tests) — the app then falls back to hot-seat-only mode.
 */
export const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
export const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;
