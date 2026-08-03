// Pretty-print the playtest telemetry digest.
//
//   node scripts/telemetry-digest.mjs [--prod] [--hours 48] [--stalled-after 24]
//
// Shells to `npx convex run telemetry:digest` (internalQuery in
// convex/telemetry.ts) and formats the result for a terminal. Requires the
// same setup as any convex CLI call: .env.local for dev, CONVEX_DEPLOYMENT /
// --prod for the production deployment.

import { execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
const num = (flag, fallback) => {
  const i = argv.indexOf(flag);
  if (i < 0) return fallback;
  const value = Number(argv[i + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`${flag} wants a positive number`);
    process.exit(1);
  }
  return value;
};
const hours = num('--hours', 48);
// How quiet an unfinished game must go before it counts as abandoned. Separate
// from --hours: the telemetry window and "how long is too long" are different
// questions, and tying them together would make a 1-hour digest call every
// game abandoned.
const stalledAfterHours = num('--stalled-after', 24);

// One shell string (npx is npx.cmd on Windows, which node won't exec
// directly); the only interpolated value is our own JSON, quoted per shell.
const json = JSON.stringify({ hours, stalledAfterHours });
const jsonArg = process.platform === 'win32' ? `"${json.replace(/"/g, '\\"')}"` : `'${json}'`;
const cmd = `npx convex run telemetry:digest ${jsonArg}${prod ? ' --prod' : ''}`;

let out;
try {
  out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
} catch {
  console.error('convex run failed — is `npx convex dev` configured (or use --prod)?');
  process.exit(1);
}

// convex run prints the result as JSON; tolerate any log lines around it.
const start = out.indexOf('{');
const end = out.lastIndexOf('}');
if (start < 0 || end < start) {
  console.error('Could not find JSON in convex run output:\n' + out);
  process.exit(1);
}
const d = JSON.parse(out.slice(start, end + 1));

const line = (label, value) => console.log(`  ${label.padEnd(24)} ${value}`);

console.log(`\nTelemetry digest — last ${d.hours}h (${prod ? 'prod' : 'dev'})`);
console.log(`${'='.repeat(48)}`);
line('rows scanned', `${d.rowsScanned}${d.truncated ? ' (TRUNCATED — narrow --hours)' : ''}`);
line('app opens', d.appOpens ?? 0);
// Deliberately beside app opens rather than instead of it: a gap between the
// two means rows are arriving from sessions whose opening beacon never landed.
line('sessions seen', d.sessionsSeen);
line('games touched', d.gamesTouched);
line('versions seen', d.versionsSeen.length ? d.versionsSeen.join(', ') : '(none)');

console.log('\nOnline funnel');
line('created', d.funnel.created);
line('joined', d.funnel.joined);
line('started', d.funnel.started);
line('programs submitted', d.funnel.programsSubmitted);
line('turns executed', d.funnel.turnsExecuted);
line('turn ERRORS', d.funnel.turnErrors);
line('finished', d.funnel.finished);
line('nudges', d.funnel.nudges);

const hot = d.hotseatFunnel;
if (hot) {
  console.log('\nHot-seat funnel');
  line('started', hot.started);
  line('turns executed', hot.turnsExecuted);
  line('turn ERRORS', hot.turnErrors);
  line('replays watched', hot.replaysWatched);
  line('finished', hot.finished);
}

const ab = d.abandonment;
if (ab) {
  console.log(`\nAbandonment (no activity for ${ab.stalledAfterHours}h)`);
  line('unfinished scanned', `${ab.scanned}${ab.truncated ? ' (TRUNCATED)' : ''}`);
  line('lobby, never started', ab.lobbyNeverStarted);
  line('active, stalled', ab.activeStalled);
  line('active, healthy', ab.activeHealthy);
  for (const g of ab.sample) {
    console.log(`      ${g.status} turn ${g.turn} — ${g.boardName} — last ${g.lastActivity}`);
  }
}

const screens = Object.entries(d.screens ?? {}).sort((a, b) => b[1] - a[1]);
if (screens.length) {
  console.log('\nScreens');
  for (const [name, count] of screens) line(name, count);
}

console.log('\nClient flow');
line('renderer fallbacks', d.clientFlow.rendererFallbacks);
line('push subscribe fails', d.clientFlow.pushSubscribeFailures);
line('PWA installs', d.clientFlow.pwaInstalls);
line('sw updates applied', d.clientFlow.swUpdatesApplied ?? 0);
line('webgl context lost', d.clientFlow.webglContextLost ?? 0);

console.log('\nCounts by kind');
for (const [kind, count] of Object.entries(d.countsByKind).sort((a, b) => b[1] - a[1])) {
  line(kind, count);
}

const dump = (title, rows) => {
  console.log(`\n${title} (${rows.length}${rows.length === 25 ? '+, newest 25' : ''})`);
  if (rows.length === 0) console.log('  (none)');
  for (const r of rows) {
    const version = r.context?.appVersion ? ` [${r.context.appVersion}]` : '';
    const where = r.context?.href ?? (r.context?.gameId ? `game ${r.context.gameId}` : '');
    console.log(`  ${r.at} ${r.kind}${version} — ${r.message}`);
    if (where) console.log(`      at ${where}`);
    if (r.data !== undefined && r.data !== null) {
      const json = JSON.stringify(r.data);
      console.log(`      ${json.length > 400 ? json.slice(0, 400) + '…' : json}`);
    }
  }
};

dump('Errors', d.errors);
dump('🐞 Notes', d.notes);
console.log();
