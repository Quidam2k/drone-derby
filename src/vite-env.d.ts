/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Build stamp injected by `define` in vite.config.ts —
 * `pkg.version+<git short hash>+<yyyymmdd>`. Read it through
 * `APP_VERSION` in src/services/telemetry.ts, which guards with `typeof`
 * for contexts where define doesn't run.
 */
declare const __APP_VERSION__: string;
