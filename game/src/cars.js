// Cars: the catalogue in the metal. Parked cars fill the lots and curbs,
// traffic cars roam the grid, and every car shares the same arcade physics,
// damage, fire and explosion rules.
import { CAR_TYPES, CITY, roadCentre } from './config.js';
import { collideCircle, dist, turnToward, angleTo } from './physics.js';
import { sfx } from './audio.js';

let nextCarId = 1;

export function createCar(kind, x, y, angle, mode, color) {
  const type = CAR_TYPES[kind];
  return {
    id: nextCarId++,
    kind,
    type,
    x, y, angle,
    speed: 0,
    mode,
    color: color ?? type.colors[0],
    health: type.health,
    maxHealth: type.health,
    wreck: false,
    fireT: 0, // >0: burning, explodes when it runs out
    exploded: false,
    driver: null,
    special: null,
    hitCooldown: 0,
    smokeT: 0,
    // traffic bookkeeping
    heading: 0,
    ti: 0, tj: 0,
    cruise: 240,
  };
}

export function carRadius(car) {
  return car.type.length * 0.40;
}

/** Fill the parking spots with a seeded mix of the catalogue. */
export function spawnParkedCars(state) {
  const rng = state.rng;
  const kinds = ['sedan', 'sedan', 'hatch', 'hatch', 'coupe', 'pickup', 'van', 'taxi'];
  const spots = [...state.city.parkingSpots];
  for (let i = spots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  for (const spot of spots) {
    if (rng.chance(0.24)) continue;
    const kind = rng.pick(kinds);
    const car = createCar(kind, spot.x, spot.y, spot.angle, 'parked', rng.pick(CAR_TYPES[kind].colors));
    state.cars.push(car);
  }
}

/** A fresh traffic car at a random intersection, headed somewhere. */
export function spawnTrafficCar(state, nearX, nearY) {
  const rng = state.rng;
  const kinds = ['sedan', 'hatch', 'coupe', 'pickup', 'van', 'taxi'];
  for (let tries = 0; tries < 8; tries += 1) {
    const i = rng.int(0, CITY.blocks);
    const j = rng.int(0, CITY.blocks);
    const x = roadCentre(i);
    const y = roadCentre(j);
    if (nearX !== undefined && dist(x, y, nearX, nearY) < 620) continue;
    if (state.cars.some((c) => dist(c.x, c.y, x, y) < 90)) continue;
    const kind = rng.pick(kinds);
    const car = createCar(kind, x, y, 0, 'traffic', rng.pick(CAR_TYPES[kind].colors));
    car.heading = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    car.angle = car.heading;
    car.ti = i;
    car.tj = j;
    car.cruise = rng.range(195, 285);
    advanceTrafficTarget(state, car, true);
    state.cars.push(car);
    return car;
  }
  return null;
}

/** Point a traffic car at the next intersection along its heading. */
export function advanceTrafficTarget(state, car, first = false) {
  const rng = state.rng;
  if (!first) {
    // At an intersection: mostly straight on, sometimes a turn, never a U-turn.
    const options = [car.heading];
    if (rng.chance(0.62)) options.push(car.heading);
    options.push(car.heading + Math.PI / 2, car.heading - Math.PI / 2);
    for (let tries = 0; tries < 6; tries += 1) {
      const h = rng.pick(options);
      const ni = car.ti + Math.round(Math.cos(h));
      const nj = car.tj + Math.round(Math.sin(h));
      if (ni >= 0 && ni <= CITY.blocks && nj >= 0 && nj <= CITY.blocks) {
        car.heading = h;
        car.ti = ni;
        car.tj = nj;
        break;
      }
    }
  } else {
    const ni = car.ti + Math.round(Math.cos(car.heading));
    const nj = car.tj + Math.round(Math.sin(car.heading));
    if (ni >= 0 && ni <= CITY.blocks && nj >= 0 && nj <= CITY.blocks) {
      car.ti = ni;
      car.tj = nj;
    } else {
      car.heading += Math.PI / 2;
      car.ti += Math.round(Math.cos(car.heading));
      car.tj += Math.round(Math.sin(car.heading));
    }
  }
}

/** The world point a traffic car is steering for, lane offset included. */
export function trafficTarget(car) {
  const cx = roadCentre(car.ti);
  const cy = roadCentre(car.tj);
  const off = CITY.laneOffset;
  if (car.heading === 0) return { x: cx, y: cy + off };
  if (car.heading === Math.PI) return { x: cx, y: cy - off };
  if (car.heading === Math.PI / 2) return { x: cx - off, y: cy };
  return { x: cx + off, y: cy };
}

/**
 * Steer and roll one AI-driven car toward a point at a wanted speed.
 * Shared by traffic, police and leaving cars; handles its own braking for
 * obstacles when asked.
 */
export function driveToward(state, car, tx, ty, wantSpeed, dt, brakeForObstacles) {
  const targetAngle = angleTo(car.x, car.y, tx, ty);
  car.angle = turnToward(car.angle, targetAngle, car.type.grip * dt);
  let speed = wantSpeed;
  if (brakeForObstacles) {
    const ahead = obstacleAhead(state, car, 118);
    if (ahead) speed = Math.min(speed, Math.max(0, (ahead - 52) * 2.2));
  }
  const accel = speed > car.speed ? car.type.accel : car.type.accel * 2.4;
  car.speed += Math.max(-accel * dt, Math.min(accel * dt, speed - car.speed));
  moveCar(state, car, dt);
}

/** Nearest obstacle distance ahead of a car, or null when the way is clear. */
export function obstacleAhead(state, car, range) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = null;
  const consider = (ox, oy, orad) => {
    const dx = ox - car.x;
    const dy = oy - car.y;
    const along = dx * fx + dy * fy;
    if (along < 4 || along > range + orad) return;
    const side = Math.abs(dx * -fy + dy * fx);
    if (side > orad + car.type.width * 0.55) return;
    const d = along - orad;
    if (best === null || d < best) best = d;
  };
  for (const other of state.cars) {
    if (other === car || other.wreck) continue;
    consider(other.x, other.y, carRadius(other));
  }
  for (const ped of state.peds) {
    if (ped.dead || ped.state === 'passenger') continue;
    consider(ped.x, ped.y, 12);
  }
  if (state.player.car !== car) consider(state.player.x, state.player.y, state.player.car ? carRadius(state.player.car) : 13);
  return best;
}

/** Integrate one car's motion and resolve the world pushing back. */
export function moveCar(state, car, dt) {
  const prevSpeed = car.speed;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const res = collideCircle(state.city, car.x, car.y, carRadius(car));
  car.x = res.x;
  car.y = res.y;
  if (res.hit && Math.abs(prevSpeed) > 130 && car.hitCooldown <= 0) {
    damageCar(state, car, Math.abs(prevSpeed) * 0.055, false);
    car.hitCooldown = 0.35;
    if (dist(car.x, car.y, state.player.x, state.player.y) < 700) sfx.crash(Math.min(1, Math.abs(prevSpeed) / 380));
    car.speed *= -0.25;
    pushEvent(state, { type: 'crash', x: car.x, y: car.y, car, hard: Math.abs(prevSpeed) > 250 });
  } else if (res.hit) {
    car.speed *= 0.55;
  }
}

/** The player's own driving: throttle, brake, reverse and steering. */
export function updatePlayerCar(state, car, input, dt) {
  const axis = input.moveAxis();
  const throttle = -axis.y; // W is up on the keys, forward for the car
  const steer = axis.x;
  if (throttle > 0) {
    car.speed += car.type.accel * dt * (car.speed < 0 ? 2.2 : 1);
  } else if (throttle < 0) {
    car.speed -= car.type.accel * dt * (car.speed > 0 ? 2.2 : 0.62);
  }
  car.speed -= car.speed * 0.55 * dt; // drag and rolling resistance
  if (input.brake()) car.speed -= car.speed * 3.2 * dt;
  const maxReverse = -130;
  car.speed = Math.max(maxReverse, Math.min(car.type.topSpeed, car.speed));
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  const speedFactor = Math.max(-1, Math.min(1, car.speed / 170));
  car.angle += steer * car.type.grip * speedFactor * dt * 0.92;
  moveCar(state, car, dt);
}

/** Hurt a car; burning and exploding are worked out in updateCars. */
export function damageCar(state, car, amount, byPlayer) {
  if (car.wreck) return;
  car.health -= amount;
  if (car.health <= 0 && car.fireT <= 0) {
    car.fireT = 1.5;
    if (byPlayer) pushEvent(state, { type: 'crime', kind: 'arson', x: car.x, y: car.y, amount: 55 });
  }
}

/** Fire, smoke, wrecks and the car-to-car shoving match, once a step. */
export function updateCars(state, dt) {
  for (const car of state.cars) {
    if (car.hitCooldown > 0) car.hitCooldown -= dt;
    if (car.wreck) {
      car.speed = 0;
      if (state.rng.chance(0.05)) pushParticle(state, car, 'smoke');
      continue;
    }
    if (car.fireT > 0) {
      car.fireT -= dt;
      pushParticle(state, car, 'fire');
      if (car.fireT <= 0 && !car.exploded) explodeCar(state, car);
    } else if (car.health < car.maxHealth * 0.38) {
      car.smokeT -= dt;
      if (car.smokeT <= 0) {
        car.smokeT = 0.12;
        pushParticle(state, car, 'smoke');
      }
    }
  }
  // Car against car: circles, a shove, and damage for whoever arrived faster.
  for (let i = 0; i < state.cars.length; i += 1) {
    const a = state.cars[i];
    if (a.wreck) continue;
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const b = state.cars[j];
      if (b.wreck) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = carRadius(a) + carRadius(b);
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const closing = Math.abs(a.speed - b.speed);
      if (closing > 90) {
        const dmg = closing * 0.06;
        damageCar(state, a, dmg, b === state.player.car);
        damageCar(state, b, dmg, a === state.player.car);
        if (dist(a.x, a.y, state.player.x, state.player.y) < 700) sfx.crash(Math.min(1, closing / 320));
        pushEvent(state, { type: 'crash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, car: a, hard: closing > 210 });
      }
      const swap = (a.speed + b.speed) / 2;
      a.speed = swap + (a.speed - swap) * 0.3;
      b.speed = swap + (b.speed - swap) * 0.3;
    }
  }
}

function explodeCar(state, car) {
  car.exploded = true;
  car.wreck = true;
  car.speed = 0;
  sfx.explosion();
  state.shake = Math.min(16, state.shake + 11);
  pushEvent(state, { type: 'explosion', x: car.x, y: car.y });
  for (let i = 0; i < 26; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const sp = state.rng.range(30, 260);
    state.effects.push({ kind: 'particle', x: car.x, y: car.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: state.rng.range(0.3, 0.9), maxLife: 0.9, size: state.rng.range(3, 9), color: state.rng.pick(['#f6a83c', '#e2572b', '#5a5148', '#ffd97a']) });
  }
  // The blast hurts everything close, and can chain into the next car.
  for (const other of state.cars) {
    if (other === car || other.wreck) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 150) damageCar(state, other, 130 * (1 - d / 170), false);
  }
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const d = dist(car.x, car.y, ped.x, ped.y);
    if (d < 80) hurtPed(state, ped, 100);
    else if (d < 150) hurtPed(state, ped, 45);
  }
  const pd = dist(car.x, car.y, state.player.x, state.player.y);
  if (pd < 130 && state.player.car !== car) hurtPlayer(state, 34 * (1 - pd / 150));
}

function pushParticle(state, car, kind) {
  state.effects.push({
    kind: 'particle',
    x: car.x + state.rng.range(-10, 10),
    y: car.y + state.rng.range(-10, 10),
    vx: state.rng.range(-8, 8),
    vy: state.rng.range(-46, -22),
    life: kind === 'fire' ? 0.34 : 1.1,
    maxLife: kind === 'fire' ? 0.34 : 1.1,
    size: kind === 'fire' ? state.rng.range(5, 10) : state.rng.range(6, 13),
    color: kind === 'fire' ? state.rng.pick(['#f6a83c', '#e2572b', '#ffd97a']) : 'rgba(70,66,60,0.5)',
  });
}

// Small shared helpers, kept here so cars.js owns everything with wheels.
// player.js and combat.js define their own hurt functions to avoid a cycle;
// these two are for the blast radius only.
export function hurtPed(state, ped, amount) {
  if (ped.dead) return;
  ped.hp -= amount;
  if (ped.hp <= 0) {
    ped.dead = true;
    ped.state = 'down';
    pushEvent(state, { type: 'pedDown', x: ped.x, y: ped.y, ped });
  } else {
    ped.state = 'flee';
    ped.fleeT = 5;
    ped.fleeX = ped.x + (ped.x - state.player.x);
    ped.fleeY = ped.y + (ped.y - state.player.y);
  }
}

export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.car) amount *= 0.45; // the car takes the worst of it
  p.health -= amount;
  p.lastHurtT = state.time;
  if (amount > 3) sfx.hurt();
}

export function pushEvent(state, event) {
  state.events.push(event);
}
