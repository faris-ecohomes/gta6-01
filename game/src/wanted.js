// The wanted system: heat, stars, and the PBPD. Heat only rises for crimes
// somebody saw (peds.js phones them in; a nearby officer sees for himself),
// it cools while nobody is looking at you, and every star puts one more
// interceptor on the road, up to six. They chase, they ram, and if they can
// hold you still the bust meter fills.
import { CAR_TYPES, CITY, WANTED, roadCentre } from './config.js';
import { createCar, driveToward } from './cars.js';
import { dist } from './physics.js';

export function createWanted() {
  return { heat: 0, stars: 0, bust: 0, unseenT: 0, spawnT: 0 };
}

export function starsForHeat(heat) {
  let stars = 0;
  for (const at of WANTED.starAt) if (heat >= at) stars += 1;
  return stars;
}

export function addHeat(state, amount) {
  const w = state.wanted;
  w.heat = Math.max(0, Math.min(WANTED.maxHeat, w.heat + amount));
  if (amount > 0) w.unseenT = 0;
}

export function updateWanted(state, dt) {
  const w = state.wanted;
  const p = state.player;
  w.stars = starsForHeat(w.heat);

  // Seen = an officer close, or a phone call still warm.
  let seen = false;
  let nearestCop = Infinity;
  for (const car of state.cars) {
    if (car.mode !== 'police') continue;
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < nearestCop) nearestCop = d;
    if (d < 470) seen = true;
  }
  if (seen) w.unseenT = 0;
  else w.unseenT += dt;
  if (w.unseenT > WANTED.unseenSeconds && w.heat > 0) {
    addHeat(state, -WANTED.decayPerSecond * dt);
    w.stars = starsForHeat(w.heat);
  }

  // Keep one interceptor per star on the road.
  w.spawnT -= dt;
  const cops = state.cars.filter((c) => c.mode === 'police');
  if (w.stars > 0 && cops.length < w.stars && w.spawnT <= 0) {
    w.spawnT = 1.4;
    spawnCop(state);
  }

  // The bust meter: held still near an officer and it fills.
  const playerSlow = !p.car || Math.abs(p.car.speed) < 55;
  if (w.stars > 0 && nearestCop < 125 && playerSlow) {
    w.bust += dt * (0.22 + w.stars * 0.055);
  } else {
    w.bust = Math.max(0, w.bust - dt * 0.45);
  }
  if (w.bust >= 1) {
    w.bust = 0;
    state.events.push({ type: 'busted' });
  }
}

function spawnCop(state) {
  const rng = state.rng;
  const p = state.player;
  for (let tries = 0; tries < 10; tries += 1) {
    const i = rng.int(0, CITY.blocks);
    const j = rng.int(0, CITY.blocks);
    const x = roadCentre(i);
    const y = roadCentre(j);
    const d = dist(x, y, p.x, p.y);
    if (d < 600 || d > 1150) continue;
    if (state.cars.some((c) => dist(c.x, c.y, x, y) < 80)) continue;
    const cop = createCar('police', x, y, rng.range(0, Math.PI * 2), 'police', CAR_TYPES.police.colors[0]);
    state.cars.push(cop);
    return;
  }
  // No junction in range: roll in from the nearest road end.
  const angle = rng.range(0, Math.PI * 2);
  const x = Math.max(70, Math.min(CITY.size - 70, p.x + Math.cos(angle) * 760));
  const y = Math.max(70, Math.min(CITY.size - 70, p.y + Math.sin(angle) * 760));
  state.cars.push(createCar('police', x, y, angle, 'police', CAR_TYPES.police.colors[0]));
}

/** Chase, ram, box in; and when the heat dies, drive off and give up. */
export function updatePolice(state, dt) {
  const p = state.player;
  const w = state.wanted;
  for (const cop of state.cars) {
    if (cop.mode !== 'police' && cop.mode !== 'leave') continue;
    if (cop.wreck) continue;
    if (w.stars === 0 && cop.mode === 'police') cop.mode = 'leave';
    if (cop.mode === 'leave') {
      driveToward(state, cop, cop.x + Math.cos(cop.angle) * 500, cop.y + Math.sin(cop.angle) * 500, 300, dt, true);
      if (dist(cop.x, cop.y, p.x, p.y) > 1250) cop.mode = 'gone';
      continue;
    }
    // Aim where the player is going, not where they are.
    const lead = p.car ? Math.min(0.55, dist(cop.x, cop.y, p.x, p.y) / 700) : 0.15;
    const vx = p.car ? Math.cos(p.car.angle) * p.car.speed : 0;
    const vy = p.car ? Math.sin(p.car.angle) * p.car.speed : 0;
    const tx = p.x + vx * lead;
    const ty = p.y + vy * lead;
    const d = dist(cop.x, cop.y, p.x, p.y);
    let want = cop.type.topSpeed * (0.9 + w.stars * 0.025);
    if (!p.car && d < 130) want = Math.min(want, Math.max(0, (d - 62) * 1.6)); // close in, don't run him down
    driveToward(state, cop, tx, ty, want, dt, false);
  }
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    if (state.cars[i].mode === 'gone') state.cars.splice(i, 1);
  }
}
