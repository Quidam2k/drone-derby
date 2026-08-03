// Regenerate the golden-game fixture:  npm run golden:update
//
// Deliberately a separate command rather than a vitest snapshot. `vitest -u`
// updates every snapshot in the repo as a side effect of a routine command,
// which makes blessing a golden a reflex — and a golden you can bless by
// muscle memory is not a tripwire. Typing this one is a decision.
//
// Before you run it: a failing golden means an engine rule moved. Find out
// WHICH rule and whether the change was intended. Regenerating to get a green
// suite throws away the only warning you were going to get.

import { spawnSync } from 'node:child_process';

console.log('Regenerating src/engine/__tests__/__fixtures__/golden-game.json …');

const run = spawnSync('npx', ['vitest', 'run', 'goldenGame'], {
  stdio: 'inherit',
  shell: process.platform === 'win32', // npx is npx.cmd here
  env: { ...process.env, GOLDEN_UPDATE: '1' },
});

if (run.status !== 0) {
  // The write happens before the assertions, so the fixture is already updated;
  // a non-zero exit means a waypoint failed, and a waypoint names a rule.
  console.error(
    '\nFixture written, but a waypoint assertion failed — that is a rule breaking,\n' +
      'not a stale fixture. Read the failure before committing this.',
  );
  process.exit(run.status ?? 1);
}

console.log('\nFixture updated. Review the diff before committing it.');
