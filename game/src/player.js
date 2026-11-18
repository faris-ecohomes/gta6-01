// Dario Venn, the wheelman you play: walking, sprinting, and the moment the
// game is about — taking somebody else's car. Stealing a parked car is a
// theft; pulling a driver out of a moving one is a carjacking, and both are
// only crimes if somebody sees them (peds.js decides who saw).
import { PLAYER, PRICES } from './config.js';
import { collideCircle, dist } from './physics.js';
import { createPed, witnessCrime } from './peds.js';
import { sfx } from './audio.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    money: 120,
    car: null,
    walkPhase: 0,
    lastHurtT: -99,
    fireT: 0,
  };
}

export function updatePlayerOnFoot(state, input, dt) {
  const p = state.player;
  const axis = input.moveAxis();
  const moving = axis.x !== 0 || axis.y !== 0;
  if (moving) {
    const len = Math.hypot(axis.x, axis.y);
    const speed = (input.sprint() ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * (state.dialogue ? 0 : 1);
    p.x += (axis.x / len) * speed * dt;
    p.y += (axis.y / len) * speed * dt;
    p.angle = Math.atan2(axis.y, axis.x);
    p.walkPhase += dt * (input.sprint() ? 12 : 8.5);
    const res = collideCircle(state.city, p.x, p.y, PLAYER.radius);
    p.x = res.x;
    p.y = res.y;
  }
  // Out of the fight for a while, Dario catches his breath — up to a point.
  if (state.time - p.lastHurtT > 9 && p.health > 0 && p.health < 40) {
    p.health = Math.min(40, p.health + 3 * dt);
  }
}

/** The E key: climb out, climb in, or take the car — in that order. */
export function tryInteract(state) {
  const p = state.player;
  if (p.car) {
    if (Math.abs(p.car.speed) < 70) exitCar(state);
    return;
  }
  let best = null;
  let bestD = 62;
  for (const car of state.cars) {
    if (car.wreck || car.mode === 'player') continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (best) enterCar(state, best);
}

export function enterCar(state, car) {
  const p = state.player;
  const wasOccupied = car.mode === 'traffic';
  const wasPolice = car.mode === 'police';
  if (wasOccupied) {
    // The driver bails out and runs — and remembers what he saw.
    const driver = createPed(state, car.x + 26, car.y + 10);
    driver.state = 'flee';
    driver.fleeT = 5;
    driver.fleeX = driver.x + (driver.x - p.x) * 3;
    driver.fleeY = driver.y + (driver.y - p.y) * 3;
    state.peds.push(driver);
  }
  car.mode = 'player';
  car.driver = null;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  sfx.door();
  if (wasPolice) witnessCrime(state, car.x, car.y, 95);
  else if (wasOccupied) witnessCrime(state, car.x, car.y, 70);
  else witnessCrime(state, car.x, car.y, 45);
  state.events.push({ type: 'enteredCar', car });
}

export function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.mode = 'parked';
  car.speed = 0;
  p.car = null;
  // Step out on the left side, clear of the bodywork.
  const side = car.angle - Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  const res = collideCircle(state.city, p.x, p.y, PLAYER.radius);
  p.x = res.x;
  p.y = res.y;
  sfx.door();
  state.events.push({ type: 'exitedCar', car });
}

/**
 * The two services, checked every step. Pay'n'spray needs the car inside
 * the customs bay; the hospital needs Dario on foot at its door. Both take
 * their price out of his pocket and say so on the banner.
 */
export function updateServices(state, dt) {
  const p = state.player;
  const lm = state.city.landmarks;
  state.serviceT = Math.max(0, (state.serviceT ?? 0) - dt);
  if (state.serviceT > 0) return;

  // The customs bay is also where jobs are handed in; a delivery or a
  // settlement is not a spray job, so the booth keeps its hands off then.
  const handingIn = state.missions && (state.missions.stage === 'deliver' || state.missions.stage === 'settle');
  if (p.car && lm.customs && !handingIn) {
    const s = lm.customs.spray;
    if (dist(p.x, p.y, s.x, s.y) < 74 && Math.abs(p.car.speed) < 40) {
      if (p.money >= PRICES.spray) {
        p.money -= PRICES.spray;
        p.car.health = p.car.maxHealth;
        p.car.fireT = 0;
        state.wanted.heat = 0;
        state.wanted.bust = 0;
        state.banner = { text: `PALMA CUSTOMS — $${PRICES.spray}. New paint, no past.`, until: state.time + 3.4 };
        sfx.cash();
      } else {
        state.banner = { text: `Palma Customs wants $${PRICES.spray} — you are short.`, until: state.time + 2.6 };
      }
      state.serviceT = 2.5;
    }
  }
  if (!p.car && lm.hospital && p.health < PLAYER.maxHealth) {
    const h = lm.hospital.heal;
    if (dist(p.x, p.y, h.x, h.y) < 52) {
      if (p.money >= PRICES.heal) {
        p.money -= PRICES.heal;
        p.health = PLAYER.maxHealth;
        state.banner = { text: `Patched up — $${PRICES.heal}.`, until: state.time + 2.6 };
        sfx.cash();
      } else {
        state.banner = { text: `The hospital wants $${PRICES.heal} — you are short.`, until: state.time + 2.6 };
      }
      state.serviceT = 2.5;
    }
  }
}
