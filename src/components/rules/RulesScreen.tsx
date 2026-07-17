// #/rules — player-facing how-to-play, reachable from the lobby, the join
// screen, and hot-seat setup. Rewritten for players from
// docs/game_mechanics_md.md (the implementer's spec stays the source of
// truth for the engine). Renders without a backend so invite links can
// point here before sign-in.

import type { ReactNode } from 'react';
import {
  CheckpointSprite,
  ConveyorSprite,
  EmitterSprite,
  GearSprite,
  PitSprite,
  RobotSprite,
  SpawnSprite,
} from '../board/sprites';

/** Back to wherever the player came from (join link, lobby, hot-seat setup). */
function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/';
}

const CARDS: [name: string, effect: string, count: number][] = [
  ['Move 1', 'drive 1 space forward', 18],
  ['Move 2', 'drive 2 spaces forward', 12],
  ['Move 3', 'drive 3 spaces forward', 6],
  ['Back Up', 'reverse 1 space (no turning)', 6],
  ['Turn Left', 'rotate 90° left, stay put', 18],
  ['Turn Right', 'rotate 90° right, stay put', 18],
  ['U-Turn', 'rotate 180°, stay put', 6],
];

function LegendRow({
  sprite,
  name,
  tileClass,
  children,
}: {
  sprite: ReactNode;
  name: string;
  tileClass?: string;
  children: ReactNode;
}) {
  return (
    <div className="rules-legend-row">
      <div className={`rules-tile${tileClass ? ` ${tileClass}` : ''}`}>{sprite}</div>
      <p>
        <strong>{name}</strong> — {children}
      </p>
    </div>
  );
}

export function RulesScreen() {
  return (
    <div className="screen rules-screen">
      <header className="lobby-header">
        <h1 className="title">How to play</h1>
        <button className="quiet" onClick={goBack} data-testid="rules-back">
          ‹ Back
        </button>
      </header>

      <section>
        <h2>The goal</h2>
        <p>
          You pilot a robot on a hazardous factory floor. Tag the numbered checkpoints{' '}
          <strong>in order</strong> — first robot to tag them all wins on the spot.
        </p>
      </section>

      <section>
        <h2>A turn</h2>
        <p>
          Each turn you draw a hand of movement cards (9, minus your damage) and program your
          robot's next <strong>5 moves</strong> by placing cards into registers 1–5. Then you
          submit. This is an async game: once <em>everyone</em> has submitted, the whole turn
          executes at once and you watch the replay. Nobody sees anyone else's program in advance —
          the fun is everyone's plans colliding.
        </p>
      </section>

      <section>
        <h2>What happens each register</h2>
        <ol className="rules-steps">
          <li>
            Everyone's card for that register is revealed. Cards run in{' '}
            <strong>priority order</strong> (the number on the card, highest first) — a Move 3
            usually beats a U-Turn to the punch.
          </li>
          <li>
            Robots move. Driving into another robot <strong>pushes</strong> it (chains push
            through several robots). Walls sit on tile edges and stop movement — yours and the
            whole push chain's. Driving off the board or into a pit destroys you.
          </li>
          <li>
            The floor moves: <strong>express belts pulse first, then all belts pulse</strong> (so
            express carries you 2 spaces), then gears rotate whoever's standing on them 90°.
          </li>
          <li>
            Lasers fire: board lasers first, then every robot fires a laser straight ahead. Each
            hit is 1+ damage.
          </li>
          <li>
            End the register standing on a checkpoint to <strong>touch</strong> it (that's your
            new respawn point). If it's the next one in your sequence, you <strong>claim</strong>{' '}
            it. Driving over one mid-move doesn't count — you have to finish on it.
          </li>
        </ol>
      </section>

      <section>
        <h2>The cards</h2>
        <p>Your personal deck has 84 cards:</p>
        <table className="rules-cards">
          <thead>
            <tr>
              <th>Card</th>
              <th>Effect</th>
              <th>In deck</th>
            </tr>
          </thead>
          <tbody>
            {CARDS.map(([name, effect, count]) => (
              <tr key={name}>
                <td>
                  <strong>{name}</strong>
                </td>
                <td>{effect}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="setup-hint">
          Multi-space moves resolve one step at a time — a Move 3 into a pit stops at the pit.
        </p>
      </section>

      <section>
        <h2>What's on the board</h2>
        <div className="rules-legend">
          <LegendRow sprite={<ConveyorSprite dir="N" express={false} />} name="Conveyor belt" tileClass="rules-tile-conveyor">
            carries a robot standing on it 1 space when the floor moves. Belts never push — if the
            destination is occupied, you stay put.
          </LegendRow>
          <LegendRow sprite={<ConveyorSprite dir="N" express />} name="Express belt" tileClass="rules-tile-conveyor">
            pulses twice — carries you 2 spaces per register. Great for travel, terrible when it's
            aimed at a pit.
          </LegendRow>
          <LegendRow sprite={<GearSprite cw />} name="Gear">
            rotates the robot standing on it 90° (clockwise or counter-clockwise) every register.
          </LegendRow>
          <LegendRow sprite={<PitSprite />} name="Pit" tileClass="rules-tile-pit">
            fall in — walk, get pushed, or get conveyed — and you're destroyed. Costs a life.
          </LegendRow>
          <LegendRow sprite={<CheckpointSprite n={1} />} name="Checkpoint">
            tag these in numbered order to win. Any checkpoint you touch becomes your respawn
            point, even out of order.
          </LegendRow>
          <LegendRow sprite={<SpawnSprite n={1} />} name="Spawn dock">
            where you start, facing north. Your respawn point until you touch a checkpoint.
          </LegendRow>
          <LegendRow sprite={<EmitterSprite facing="E" />} name="Board laser">
            wall-mounted; fires every register. The first robot in the beam takes the damage.
          </LegendRow>
          <LegendRow
            sprite={
              <div className="rules-robot-body">
                <RobotSprite seat={0} />
              </div>
            }
            name="Robot"
          >
            everyone else on the floor. They block, they push, and they all fire a 1-damage laser
            straight ahead every register.
          </LegendRow>
        </div>
        <p className="setup-hint">
          Walls sit on tile edges (bright edge lines on the board) and block movement, pushes,
          belts, and lasers.
        </p>
      </section>

      <section>
        <h2>Damage</h2>
        <p>
          Every laser hit sticks — there are no repair stations. Damage shrinks next turn's hand
          (9 − damage cards). At <strong>5 damage your registers start locking</strong>, from
          register 5 downward: a locked register repeats whatever card is stuck in it every turn.
          At <strong>10 damage you're destroyed</strong>.
        </p>
      </section>

      <section>
        <h2>Lives &amp; respawn</h2>
        <p>
          You have <strong>3 lives</strong>. Pits, driving off the board, and 10 damage each cost
          one. A destroyed robot sits out the rest of the turn, then respawns at its last touched
          checkpoint (or its spawn dock) facing north — with 2 damage as a souvenir. Out of lives,
          out of the game; if everyone else is eliminated, the last robot standing wins.
        </p>
      </section>

      <section>
        <h2>The boards</h2>
        <ul className="rules-boards">
          <li>
            <strong>Proving Grounds</strong> — the starter track: every element once, learn
            pushing and walls without much peril.
          </li>
          <li>
            <strong>Spin Cycle</strong> — a big conveyor loop with express feeders. Ride the belts
            instead of fighting them.
          </li>
          <li>
            <strong>The Gauntlet</strong> — laser corridors. The short route hurts, the safe route
            is slow; pick your poison.
          </li>
          <li>
            <strong>Vortex Arena</strong> — an express whirlpool around a gear-gated core. Ride
            the current, or thread the middle and hope.
          </li>
          <li>
            <strong>Pit Archipelago</strong> — islands split by pit channels. Thread the narrow
            causeways (one push is a life) or ride the laser-taxed bridges.
          </li>
        </ul>
      </section>

      <p>
        <button className="primary-link rules-back-bottom" onClick={goBack}>
          ‹ Back
        </button>
      </p>
    </div>
  );
}
