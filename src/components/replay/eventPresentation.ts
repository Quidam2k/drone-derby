// How an EngineEvent presents itself: how long it holds the screen, and what
// the caption says.
//
// Lifted VERBATIM out of ReplayPlayer.tsx in Phase 3D-6 — no behaviour change,
// a cut and paste. It moved because it now has three consumers rather than one:
//
//   - ReplayPlayer, the normal replay clock.
//   - HighlightReel, whose clock is `reelMath.reelDuration` — built ON TOP of
//     this table (peaks stretched, connective tissue squeezed) rather than a
//     second copy of it, so the reel and the replay cannot drift apart about
//     what a laser is worth.
//   - board3d/directorTurn.test.ts, which measures the camera against real
//     replay seconds and used to keep a hand-copy of the table because this
//     lived in a .tsx a node test has no business loading.
//
// A .ts, not a .tsx: nothing here renders, and that is what lets the node tests
// import it directly.

import type { EngineEvent } from '../../engine';
import { CARD_LABEL } from '../cards';

/** Milliseconds each event holds the screen at 1× speed. */
export function eventDuration(e: EngineEvent): number {
  switch (e.type) {
    case 'turn-started':
    case 'turn-ended':
      return 400;
    case 'register-started':
      return 550;
    case 'card-revealed':
      return 450;
    case 'robot-moved':
    case 'conveyor-moved':
      return 420;
    case 'robot-teleported':
      return 550;
    case 'repulsed':
      return 450;
    case 'robot-rotated':
    case 'gear-rotated':
    case 'conveyor-rotated':
      return 380;
    case 'robot-blocked':
      return 450;
    case 'pusher-fired':
    case 'crusher-crushed':
      return 450;
    case 'laser-fired':
      return 550;
    case 'damage':
    case 'repair':
      return 300;
    case 'register-locked':
    case 'register-unlocked':
      return 600;
    case 'robot-fell':
    case 'robot-destroyed':
    case 'player-eliminated':
      return 750;
    case 'life-lost':
      return 400;
    case 'robot-respawned':
      return 550;
    case 'robot-powered-down':
    case 'robot-powered-up':
      return 500;
    case 'checkpoint-claimed':
      return 650;
    case 'game-won':
      return 900;
  }
}

export function caption(e: EngineEvent): string {
  switch (e.type) {
    case 'turn-started':
      return `Turn ${e.turn} begins`;
    case 'register-started':
      return `Register ${e.register}`;
    case 'card-revealed':
      return `${e.player} reveals ${CARD_LABEL[e.card.type]} (${e.card.priority})`;
    case 'robot-moved':
      return e.pushed ? `${e.player} is pushed` : `${e.player} moves`;
    case 'robot-blocked':
      return `${e.player} bumps into a wall`;
    case 'robot-rotated':
      return `${e.player} rotates`;
    case 'conveyor-moved':
      return e.express ? `Express conveyor carries ${e.player}` : `Conveyor carries ${e.player}`;
    case 'gear-rotated':
      return `Gear spins ${e.player}`;
    case 'conveyor-rotated':
      return `The bend swings ${e.player} around`;
    case 'pusher-fired':
      return `Pusher shoves ${e.player}`;
    case 'crusher-crushed':
      return `Crusher slams down on ${e.player}!`;
    case 'robot-teleported':
      return e.via === 'portal'
        ? `${e.player} slips through the portal`
        : `Teleporter hurls ${e.player} forward`;
    case 'repulsed':
      return `Repulsor field flings ${e.player} back`;
    case 'laser-fired': {
      const source = e.source === 'board' ? 'Board laser' : `${e.shooter} fires and`;
      return e.hit ? `${source} hits ${e.hit}` : e.source === 'board' ? 'Board laser fires' : `${e.shooter} fires`;
    }
    case 'damage':
      return `${e.player} takes ${e.amount} damage (${e.total}/10)`;
    case 'repair':
      return `${e.player} repairs ${e.amount} damage (${e.total}/10)`;
    case 'register-locked':
      return `${e.player}'s register ${e.register} locks!`;
    case 'register-unlocked':
      return `${e.player}'s register ${e.register} unlocks!`;
    case 'robot-fell':
      return e.cause === 'pit' ? `${e.player} falls into a pit!` : `${e.player} falls off the board!`;
    case 'robot-destroyed':
      return `${e.player} is destroyed!`;
    case 'life-lost':
      return `${e.player} loses a life (${e.remaining} left)`;
    case 'player-eliminated':
      return `${e.player} is eliminated!`;
    case 'robot-respawned':
      return `${e.player} respawns`;
    case 'robot-powered-down':
      return `${e.player} powers down — all systems off`;
    case 'robot-powered-up':
      return `${e.player} powers back up`;
    case 'checkpoint-claimed':
      return `${e.player} claims checkpoint ${e.checkpoint}!`;
    case 'game-won':
      return e.reason === 'checkpoints'
        ? `${e.player} wins — all checkpoints claimed!`
        : `${e.player} wins — last robot standing!`;
    case 'turn-ended':
      return `Turn ${e.turn} complete`;
  }
}
