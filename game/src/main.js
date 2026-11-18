// Palma Bay: Heat Wave — boot and the one loop. The world advances in fixed
// 1/60 s steps; screens (title, play, pause, wasted, busted) gate what a
// step may do. ?seed=N fixes the city; ?shot=<scene>&seed=N stages a
// screenshot scene instead of running the loop.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { generateCity } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE } from './input.js';
import { createPlayer, updatePlayerOnFoot, tryInteract, updateServices } from './player.js';
import { spawnParkedCars, updateCars, updatePlayerCar, moveCar } from './cars.js';
import { updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds, witnessCrime, scarePeds } from './peds.js';
import { createWanted, updateWanted, updatePolice } from './wanted.js';
import { updatePlayerFire, updateGuards } from './combat.js';
import { createMissions, createTaxi, updateMissions, advanceDialogue, startStory, startJob, banner } from './missions.js';
import { createRenderer, updateEffects } from './render.js';
import { drawHud, drawScreen, titleButtonAt } from './hud.js';
import { stageShot } from './shots.js';
import { sfx, updateLoops, toggleMute } from './audio.js';
import { PRICES } from './config.js';

const MAX_FRAME = 0.25;
const SPAWN = { x: 1465, y: 1655 }; // the sidewalk south of Palma Customs

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.v === 1 ? data : null;
  } catch {
    return null;
  }
}

function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      job: state.missions.index,
      money: Math.floor(state.player.money),
      storyDone: state.storyDone,
      stats: state.stats,
    }));
  } catch {
    // Storage can be off; the run then lasts this visit only.
  }
}

function createState(seed) {
  const rng = createRandom(seed);
  const city = generateCity(rng);
  const state = {
    rng,
    city,
    time: 0,
    screen: 'title',
    cars: [],
    peds: [],
    effects: [],
    events: [],
    player: createPlayer(SPAWN.x, SPAWN.y),
    wanted: createWanted(),
    missions: createMissions(),
    taxi: createTaxi(),
    stats: { fares: 0 },
    camera: { x: SPAWN.x, y: SPAWN.y },
    viewW: 1280,
    viewH: 720,
    shake: 0,
    banner: null,
    dialogue: null,
    objective: null,
    channel: null,
    storyDone: false,
    hasSave: Boolean(readSave()),
    endText: '',
    trafficT: 0,
    serviceT: 0,
  };
  spawnParkedCars(state);
  spawnPeds(state, 26);
  return state;
}

let state = createState(Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296));
let lastJobSaved = -1;

function newGame() {
  const seed = Math.floor(Math.random() * 4294967296);
  state = createState(seed);
  state.screen = 'play';
  startStory(state);
  announce('Palma Bay. Marta Quill is on the phone.');
}

function continueGame() {
  const save = readSave();
  if (!save) {
    newGame();
    return;
  }
  const seed = Math.floor(Math.random() * 4294967296);
  state = createState(seed);
  state.screen = 'play';
  state.player.money = save.money ?? state.player.money;
  state.stats = save.stats ?? { fares: 0 };
  if (save.storyDone) {
    state.storyDone = true;
    state.missions.stage = 'done';
    state.missions.index = 4;
    banner(state, 'Welcome back to Palma Bay.', 3);
  } else {
    startJob(state, save.job ?? 0);
  }
  announce('Welcome back to Palma Bay.');
}

function announce(message) {
  if (status) status.textContent = message;
}

// --- one simulation step ----------------------------------------------------

function drainEvents() {
  for (const event of state.events) {
    if (event.type === 'crash' && event.hard) {
      witnessCrime(state, event.x, event.y, 30);
      scarePeds(state, event.x, event.y, 130);
    } else if (event.type === 'explosion') {
      witnessCrime(state, event.x, event.y, 85);
      scarePeds(state, event.x, event.y, 330);
    } else if (event.type === 'busted') {
      onBusted();
    }
  }
  state.events.length = 0;
}

function onBusted() {
  const w = state.wanted;
  const fine = Math.min(state.player.money, PRICES.bustedBase + w.stars * PRICES.bustedPerStar);
  state.player.money -= fine;
  state.endText = `The PBPD took $${fine} in fines. You walk out of headquarters with lighter pockets.`;
  state.screen = 'busted';
  sfx.sting();
  announce('Busted.');
}

function onWasted() {
  const fee = Math.min(state.player.money, PRICES.wastedFee);
  state.player.money -= fee;
  state.endText = `You wake up at Palma Bay Hospital, stitched and billed $${fee}.`;
  state.screen = 'wasted';
  sfx.sting();
  announce('Wasted.');
}

function respawn(atHospital) {
  const p = state.player;
  const lm = state.city.landmarks;
  const spot = atHospital ? lm.hospital.respawn : lm.police.respawn;
  if (p.car) {
    p.car.mode = 'parked';
    p.car.speed = 0;
    p.car = null;
  }
  p.x = spot.x;
  p.y = spot.y;
  p.health = 100;
  state.wanted.heat = 0;
  state.wanted.bust = 0;
  for (const car of state.cars) if (car.mode === 'police') car.mode = 'leave';
  state.screen = 'play';
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) toggleMute();
  if (state.screen === 'title') {
    if (actions & ACTION_CONFIRM) {
      const hit = titleButtonAt(input.mouse.x, input.mouse.y);
      if (hit === 'new') newGame();
      else if (hit === 'continue') continueGame();
      else if (state.hasSave) continueGame();
      else newGame();
    }
    return;
  }
  if (state.screen === 'pause') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) state.screen = 'play';
    return;
  }
  if (state.screen === 'wasted') {
    if (actions & ACTION_CONFIRM) respawn(true);
    return;
  }
  if (state.screen === 'busted') {
    if (actions & ACTION_CONFIRM) respawn(false);
    return;
  }
  // screen === 'play'
  if (actions & ACTION_PAUSE) {
    state.screen = 'pause';
    writeSave(state);
    announce('Paused. Progress saved.');
    return;
  }
  if (state.dialogue) {
    if (actions & (ACTION_INTERACT | ACTION_CONFIRM)) advanceDialogue(state);
    return;
  }
  if (actions & ACTION_INTERACT) tryInteract(state);
}

function step(dt) {
  state.time += dt;
  if (state.screen !== 'play') return;
  const p = state.player;
  if (p.car) {
    if (state.dialogue) {
      // A phone call is no time to drive: coast to a stop while it lasts.
      p.car.speed -= p.car.speed * 2.4 * dt;
      moveCar(state, p.car, dt);
    } else {
      updatePlayerCar(state, p.car, input, dt);
    }
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
  } else {
    updatePlayerOnFoot(state, input, dt);
  }
  updateTraffic(state, dt);
  updatePolice(state, dt);
  updateWanted(state, dt);
  updateCars(state, dt);
  updatePeds(state, dt);
  updateGuards(state, dt);
  if (!state.dialogue) updatePlayerFire(state, input, dt);
  updateMissions(state, dt);
  updateServices(state, dt);
  updateEffects(state, dt);
  drainEvents();
  if (state.missions.index !== lastJobSaved) {
    lastJobSaved = state.missions.index;
    writeSave(state);
  }
  if (p.health <= 0 && state.screen === 'play') onWasted();
}

// --- frame ------------------------------------------------------------------

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  state.viewW = window.innerWidth;
  state.viewH = window.innerHeight;
  canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);

function updateCamera(dt) {
  const cam = state.camera;
  if (state.screen === 'title') {
    // A slow drift over downtown while the title is up.
    cam.x = 1745 + Math.cos(state.time * 0.05) * 320;
    cam.y = 1745 + Math.sin(state.time * 0.037) * 320;
    return;
  }
  const tx = state.player.x;
  const ty = state.player.y;
  const k = Math.min(1, dt * 5.5);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

function frame(now, last, accumulator) {
  requestAnimationFrame((t) => frame(t, now, accumulator));
  let acc = accumulator + Math.min((now - last) / 1000, MAX_FRAME);
  handleActions();
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  updateCamera(1 / 60);
  renderer.draw(state);
  if (state.screen === 'play' || state.screen === 'pause') drawHud(state, canvas.getContext('2d'));
  drawScreen(state, canvas.getContext('2d'));
  const p = state.player;
  updateLoops(Boolean(p.car) && state.screen === 'play', p.car ? Math.abs(p.car.speed) / p.car.type.topSpeed : 0, state.screen === 'play' ? state.wanted.stars : 0);
}

// --- screenshot mode ----------------------------------------------------------

const IDLE_INPUT = {
  moveAxis: () => ({ x: 0, y: 0 }),
  sprint: () => false,
  brake: () => false,
  mouse: { down: false, x: 0, y: 0 },
  takeActions: () => 0,
  mouseWorld: () => ({ x: 0, y: 0 }),
};

function runShot(name) {
  state = createState(Number.isInteger(seedParam) ? seedParam : 7);
  stageShot(state, name);
  resize();
  // Let the staged moment breathe: traffic rolls, witnesses wander, the
  // chase closes in — the frame is the game mid-motion.
  void IDLE_INPUT;
  for (let i = 0; i < 100; i += 1) {
    state.time += STEP;
    const p = state.player;
    if (p.car) {
      // Nobody is at the wheel in a staged scene: the car coasts.
      p.car.speed -= p.car.speed * 0.35 * STEP;
      moveCar(state, p.car, STEP);
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
    }
    updateTraffic(state, STEP);
    updatePolice(state, STEP);
    updateWanted(state, STEP);
    updateCars(state, STEP);
    updatePeds(state, STEP);
    updateGuards(state, STEP);
    updateEffects(state, STEP);
    state.events.length = 0;
    // The camera keeps up with the staged moment, as it does in play.
    state.camera.x += (state.player.x - state.camera.x) * 0.12;
    state.camera.y += (state.player.y - state.camera.y) * 0.12;
  }
  let painted = 0;
  function paint() {
    renderer.draw(state);
    drawHud(state, canvas.getContext('2d'));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// A small handle for the game's own smoke tests (and curious players).
window.__palma = {
  get state() { return state; },
  get screen() { return state.screen; },
  newGame,
  continueGame,
};

resize();
if (shotName) runShot(shotName);
else requestAnimationFrame((t) => frame(t, t, 0));

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'play') {
    state.screen = 'pause';
    writeSave(state);
  }
});
