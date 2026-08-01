// Pretty-print the playtest telemetry digest.
//
//   node scripts/telemetry-digest.mjs [--prod] [--hours 48]
//
// Shells to `npx convex run telemetry:digest` (internalQuery in
// convex/telemetry.ts) and formats the result for a terminal. Requires the
// same setup as any convex CLI call: .env.local for dev, CONVEX_DEPLOYMENT /
// --prod for the production deployment.

import { execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
const hoursIdx = argv.indexOf('--hours');
const hours = hoursIdx >= 0 ? Number(argv[hoursIdx + 1]) : 48;
if (!Number.isFinite(hours) || hours <= 0) {
  console.error('--hours wants a positive number');
  process.exit(1);
}

// One shell string (npx is npx.cmd on Windows, which node won't exec
// directly); the only interpolated value is our own JSON, quoted per shell.
const json = JSON.stringify({ hours });
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
line('sessions seen', d.sessionsSeen);
line('games touched', d.gamesTouched);
line('versions seen', d.versionsSeen.length ? d.versionsSeen.join(', ') : '(none)');

console.log('\nGame funnel');
line('created', d.funnel.created);
line('joined', d.funnel.joined);
line('started', d.funnel.started);
line('programs submitted', d.funnel.programsSubmitted);
line('turns executed', d.funnel.turnsExecuted);
line('turn ERRORS', d.funnel.turnErrors);
line('finished', d.funnel.finished);
line('nudges', d.funnel.nudges);

console.log('\nClient flow');
line('renderer fallbacks', d.clientFlow.rendererFallbacks);
line('push subscribe fails', d.clientFlow.pushSubscribeFailures);
line('PWA installs', d.clientFlow.pwaInstalls);

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
