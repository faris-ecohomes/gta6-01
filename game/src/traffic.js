// Traffic: Palma Bay's own drivers. Each follows the lane grid from
// intersection to intersection, braking for whatever is in front of them,
// and the city keeps about a dozen of them rolling near the player.
import { advanceTrafficTarget, driveToward, spawnTrafficCar, trafficTarget } from './cars.js';
import { dist } from './physics.js';

const TRAFFIC_COUNT = 13;
const DESPAWN_DIST = 1550;
const SPAWN_EVERY = 0.8;

export function updateTraffic(state, dt) {
  const p = state.player;
  state.trafficT -= dt;
  let count = 0;
  for (const car of state.cars) {
    if (car.mode !== 'traffic') continue;
    count += 1;
    if (dist(car.x, car.y, p.x, p.y) > DESPAWN_DIST) {
      car.mode = 'gone';
      continue;
    }
    const target = trafficTarget(car);
    if (dist(car.x, car.y, target.x, target.y) < 34) advanceTrafficTarget(state, car);
    const fresh = trafficTarget(car);
    // Ease off on the approach to a junction, cruise between them.
    const nearTurn = dist(car.x, car.y, fresh.x, fresh.y) < 120;
    driveToward(state, car, fresh.x, fresh.y, nearTurn ? car.cruise * 0.55 : car.cruise, dt, true);
  }
  if (state.trafficT <= 0 && count < TRAFFIC_COUNT) {
    state.trafficT = SPAWN_EVERY;
    spawnTrafficCar(state, p.x, p.y);
  }
  // Sweep out the despawned.
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    if (state.cars[i].mode === 'gone') state.cars.splice(i, 1);
  }
}
