// Pedestrians: they stroll the sidewalks, run from danger, and — the part
// that matters — they watch. A crime seen by a pedestrian is phoned in after
// a short delay, and only then does the heat arrive. Guards are pedestrians
// with a gun and a job; combat.js runs those.
import { CITY, PLAYER, blockOrigin } from './config.js';
import { collideCircle, dist, turnToward, angleTo } from './physics.js';

const SKIN = ['#e8b88a', '#c68863', '#8a5a3b', '#f0c8a0', '#6e4530'];
const SHIRT = ['#d96f4e', '#4e7ad9', '#5da964', '#e3c84f', '#9a6fc0', '#e8e4da', '#4ec2c9', '#c94e7a'];
const PANTS = ['#3a4a5c', '#5c4a3a', '#2e2e34', '#6e6e7a', '#445544'];

export function createPed(state, x, y, kind = 'walker') {
  const rng = state.rng;
  const bx = Math.max(0, Math.min(CITY.blocks - 1, Math.floor((x - CITY.roadSize) / CITY.pitch)));
  const by = Math.max(0, Math.min(CITY.blocks - 1, Math.floor((y - CITY.roadSize) / CITY.pitch)));
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    kind, // walker | guard | passenger
    hp: kind === 'guard' ? 70 : 30,
    dead: false,
    state: 'walk',
    bx, by,
    corner: rng.int(0, 3),
    tx: x, ty: y,
    speed: rng.range(52, 78),
    fleeT: 0, fleeX: 0, fleeY: 0,
    reportT: 0, reportAmt: 0,
    fireT: rng.range(0.5, 1.5),
    strafeDir: rng.chance(0.5) ? 1 : -1,
    car: null,
    walkPhase: rng.range(0, 6),
    skin: rng.pick(SKIN),
    shirt: kind === 'guard' ? '#3c4148' : rng.pick(SHIRT),
    pants: rng.pick(PANTS),
  };
}

/** Sidewalk ring corner of a block: peds walk corner to corner. */
function cornerPoint(bx, by, corner) {
  const o = blockOrigin(bx, by);
  const inset = 16;
  const far = CITY.blockSize - inset;
  const pts = [
    { x: o.x + inset, y: o.y + inset },
    { x: o.x + far, y: o.y + inset },
    { x: o.x + far, y: o.y + far },
    { x: o.x + inset, y: o.y + far },
  ];
  return pts[corner & 3];
}

export function spawnPeds(state, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i += 1) {
    const bx = rng.int(0, CITY.blocks - 1);
    const by = rng.int(0, CITY.blocks - 1);
    const c = cornerPoint(bx, by, rng.int(0, 3));
    const ped = createPed(state, c.x + rng.range(-8, 8), c.y + rng.range(-8, 8));
    ped.bx = bx;
    ped.by = by;
    ped.tx = ped.x;
    ped.ty = ped.y;
    state.peds.push(ped);
  }
}

/**
 * A crime happened at (x, y). Pedestrians close enough to see it start
 * phoning it in; police close enough add the heat on the spot (wanted.js
 * reads the 'instantHeat' this leaves on state). Nobody sees through the
 * whole city: the witness radius is the whole system.
 */
export function witnessCrime(state, x, y, amount) {
  let seen = false;
  for (const ped of state.peds) {
    if (ped.dead || ped.kind !== 'walker') continue;
    if (dist(ped.x, ped.y, x, y) < 300) {
      seen = true;
      if (ped.state !== 'report') {
        ped.state = 'report';
        ped.reportT = 2.2;
        ped.reportAmt = Math.max(ped.reportAmt, amount);
      }
    }
  }
  for (const car of state.cars) {
    if (car.mode === 'police' && dist(car.x, car.y, x, y) < 430) {
      state.wanted.heat = Math.min(760, state.wanted.heat + amount);
      state.wanted.unseenT = 0;
      seen = true;
    }
  }
  return seen;
}

/** Scare every walker near a point into running away from it. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.dead || ped.kind !== 'walker' || ped.state === 'report') continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.fleeT = state.rng.range(2.5, 5);
      ped.fleeX = ped.x + (ped.x - x) * 2.2;
      ped.fleeY = ped.y + (ped.y - y) * 2.2;
    }
  }
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.dead || ped.kind !== 'walker') continue;
    ped.walkPhase += dt * (ped.state === 'flee' ? 13 : 7);

    if (ped.state === 'report') {
      ped.reportT -= dt;
      if (ped.reportT <= 0) {
        state.wanted.heat = Math.min(760, state.wanted.heat + ped.reportAmt);
        state.wanted.unseenT = 0;
        ped.reportAmt = 0;
        ped.state = 'flee';
        ped.fleeT = 3;
        ped.fleeX = ped.x + (ped.x - p.x) * 2;
        ped.fleeY = ped.y + (ped.y - p.y) * 2;
      }
      continue;
    }

    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      movePed(state, ped, ped.fleeX, ped.fleeY, 218, dt);
      if (ped.fleeT <= 0) ped.state = 'walk';
      continue;
    }

    // Stroll: corner to corner around the home block, sometimes crossing
    // the road to the next block over.
    if (dist(ped.x, ped.y, ped.tx, ped.ty) < 9) {
      if (state.rng.chance(0.16)) {
        ped.bx = Math.max(0, Math.min(CITY.blocks - 1, ped.bx + state.rng.int(-1, 1)));
        ped.by = Math.max(0, Math.min(CITY.blocks - 1, ped.by + state.rng.int(-1, 1)));
        ped.corner = state.rng.int(0, 3);
      } else {
        ped.corner = (ped.corner + (state.rng.chance(0.5) ? 1 : 3)) & 3;
      }
      const c = cornerPoint(ped.bx, ped.by, ped.corner);
      ped.tx = c.x;
      ped.ty = c.y;
    }
    movePed(state, ped, ped.tx, ped.ty, ped.speed, dt);

    // A car coming fast and close is worth running from before it arrives.
    const threat = state.player.car;
    if (threat && Math.abs(threat.speed) > 200 && dist(ped.x, ped.y, threat.x, threat.y) < 95) {
      ped.state = 'flee';
      ped.fleeT = 2.2;
      ped.fleeX = ped.x + (ped.x - threat.x) * 2.4;
      ped.fleeY = ped.y + (ped.y - threat.y) * 2.4;
    }
  }
  // The dead stay where they fell; the living keep the count up near you.
  state.peds = state.peds.filter((ped) => !ped.dead || dist(ped.x, ped.y, p.x, p.y) < 900);
}

function movePed(state, ped, tx, ty, speed, dt) {
  const d = dist(ped.x, ped.y, tx, ty);
  if (d < 2) return;
  ped.angle = turnToward(ped.angle, angleTo(ped.x, ped.y, tx, ty), 10 * dt);
  ped.x += Math.cos(ped.angle) * Math.min(speed, d / dt) * dt;
  ped.y += Math.sin(ped.angle) * Math.min(speed, d / dt) * dt;
  const res = collideCircle(state.city, ped.x, ped.y, PLAYER.radius - 3);
  ped.x = res.x;
  ped.y = res.y;
}
