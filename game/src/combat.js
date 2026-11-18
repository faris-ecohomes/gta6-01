// Combat: a pistol that fires hitscan rounds toward the mouse, on foot or
// through a car window, and the Sorrento guards who shoot back. Every shot
// is a crime if a pedestrian sees it, and every shot scares the street.
import { dist } from './physics.js';
import { damageCar, hurtPed, hurtPlayer, carRadius } from './cars.js';
import { witnessCrime, scarePeds } from './peds.js';
import { sfx } from './audio.js';

const RANGE = 560;
const FIRE_COOLDOWN = 0.21;
const BULLET_DAMAGE = 34;

export function tracer(state, x1, y1, x2, y2, color) {
  state.effects.push({ kind: 'tracer', x1, y1, x2, y2, life: 0.07, maxLife: 0.07, color });
}

/** Fire one round from (sx, sy) toward (tx, ty); returns what was hit. */
function hitscan(state, sx, sy, tx, ty, fromPlayer) {
  const angle = Math.atan2(ty - sy, tx - sx);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = null;
  let bestAlong = RANGE;
  const consider = (ox, oy, orad, target) => {
    const relX = ox - sx;
    const relY = oy - sy;
    const along = relX * dx + relY * dy;
    if (along < 8 || along > RANGE) return;
    const perp = Math.abs(relX * -dy + relY * dx);
    if (perp > orad + 4) return;
    if (along < bestAlong) {
      bestAlong = along;
      best = target;
    }
  };
  if (fromPlayer) {
    for (const ped of state.peds) {
      if (ped.dead || ped.state === 'passenger') continue;
      consider(ped.x, ped.y, 14, { kind: 'ped', ped });
    }
    for (const car of state.cars) {
      if (car === state.player.car || car.wreck) continue;
      consider(car.x, car.y, carRadius(car), { kind: 'car', car });
    }
  } else {
    // A guard's round: it can hit Dario or the car he is sitting in.
    if (state.player.car) consider(state.player.car.x, state.player.car.y, carRadius(state.player.car), { kind: 'playerCar' });
    else consider(state.player.x, state.player.y, 14, { kind: 'player' });
  }
  const endX = sx + dx * (best ? bestAlong : RANGE);
  const endY = sy + dy * (best ? bestAlong : RANGE);
  return { hit: best, endX, endY };
}

/** The player's pistol, fired while the mouse is held. */
export function updatePlayerFire(state, input, dt) {
  const p = state.player;
  p.fireT -= dt;
  if (!input.mouse.down || state.dialogue || p.fireT > 0) return;
  p.fireT = FIRE_COOLDOWN;
  const aim = input.mouseWorld(state.camera, state.viewW, state.viewH);
  const sx = p.x;
  const sy = p.y;
  p.angle = Math.atan2(aim.y - sy, aim.x - sx);
  const { hit, endX, endY } = hitscan(state, sx, sy, aim.x, aim.y, true);
  tracer(state, sx, sy, endX, endY, '#ffe9a8');
  state.effects.push({ kind: 'particle', x: sx + Math.cos(p.angle) * 20, y: sy + Math.sin(p.angle) * 20, vx: 0, vy: 0, life: 0.05, maxLife: 0.05, size: 9, color: '#ffd34d' });
  sfx.shot();
  state.shake = Math.min(6, state.shake + 0.7);
  scarePeds(state, sx, sy, 250);
  if (!hit) {
    witnessCrime(state, sx, sy, 40);
    return;
  }
  if (hit.kind === 'ped') {
    const wasAlive = !hit.ped.dead;
    hurtPed(state, hit.ped, BULLET_DAMAGE);
    if (hit.ped.kind === 'guard' && !hit.ped.dead) hit.ped.state = 'fight';
    witnessCrime(state, sx, sy, wasAlive && hit.ped.dead ? 95 : 65);
    if (hit.ped.dead) state.stats.shots = (state.stats.shots ?? 0) + 1;
  } else if (hit.kind === 'car') {
    damageCar(state, hit.car, 13, true);
    witnessCrime(state, sx, sy, 45);
  }
}

/** Guards: hold a firing line, strafe, and shoot to kill. */
export function updateGuards(state, dt) {
  const p = state.player;
  for (const guard of state.peds) {
    if (guard.kind !== 'guard' || guard.dead) continue;
    const d = dist(guard.x, guard.y, p.x, p.y);
    if (!guard.hostile) {
      if (d < 200) guard.angle = Math.atan2(p.y - guard.y, p.x - guard.x);
      continue;
    }
    guard.state = 'fight';
    guard.angle = Math.atan2(p.y - guard.y, p.x - guard.x);
    // Keep the firing line: close in past 300, back off inside 150.
    let mx = 0;
    let my = 0;
    if (d > 300) { mx = Math.cos(guard.angle); my = Math.sin(guard.angle); }
    else if (d < 150) { mx = -Math.cos(guard.angle); my = -Math.sin(guard.angle); }
    const strafe = Math.sin(state.time * 0.7 + guard.walkPhase) * guard.strafeDir;
    mx += -Math.sin(guard.angle) * strafe * 0.6;
    my += Math.cos(guard.angle) * strafe * 0.6;
    const ml = Math.hypot(mx, my) || 1;
    guard.x += (mx / ml) * 92 * dt;
    guard.y += (my / ml) * 92 * dt;
    guard.walkPhase += dt * 8;

    guard.fireT -= dt;
    if (guard.fireT <= 0 && d < 430) {
      guard.fireT = state.rng.range(0.85, 1.6);
      const accuracy = Math.max(0.22, 0.6 - d / 1100);
      const willHit = state.rng.chance(accuracy);
      const tx = p.x + (willHit ? 0 : state.rng.range(-70, 70));
      const ty = p.y + (willHit ? 0 : state.rng.range(-70, 70));
      const { hit, endX, endY } = hitscan(state, guard.x, guard.y, tx, ty, false);
      tracer(state, guard.x, guard.y, endX, endY, '#ff9d5c');
      sfx.enemyShot();
      if (hit && willHit) {
        if (hit.kind === 'playerCar') {
          damageCar(state, state.player.car, 6, false);
          hurtPlayer(state, 3.5);
        } else {
          hurtPlayer(state, 8);
        }
      }
    }
  }
}
