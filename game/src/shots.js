// The screenshot scenes behind ?shot=cover|chase|bank|marina. Each arranges
// a real moment of the game — the first job on foot, a four-star chase, the
// bank job mid-vault, a cab by the marina — and main.js then steps the true
// simulation forward a little before the frame is taken, so what you see is
// the game playing itself, never a mock-up.
import { createCar } from './cars.js';
import { startStory, advanceDialogue } from './missions.js';

function finishIntro(state) {
  startStory(state);
  let guard = 0;
  while (state.dialogue && guard < 12) {
    advanceDialogue(state);
    guard += 1;
  }
}

export function stageShot(state, name) {
  const lm = state.city.landmarks;
  const p = state.player;
  state.screen = 'play';
  if (name === 'chase') {
    finishIntro(state);
    state.banner = null; // the JOB 1 banner belongs to the cover scene
    state.objective = { x: lm.customs.spray.x, y: lm.customs.spray.y, text: 'Lose the heat — Palma Customs spray booth' };
    const car = createCar('coupe', 2025, 1778, 0, 'player', '#b03a48');
    car.speed = 305;
    state.cars.push(car);
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.money = 720;
    state.wanted.heat = 385; // four stars
    state.wanted.bust = 0.45;
    const copSpots = [
      { x: 1835, y: 1712, a: 0.2 },
      { x: 1800, y: 1850, a: -0.15 },
      { x: 1700, y: 1778, a: 0 },
    ];
    for (const s of copSpots) {
      const cop = createCar('police', s.x, s.y, s.a, 'police');
      cop.speed = 290;
      state.cars.push(cop);
    }
    state.camera.x = p.x + 120;
    state.camera.y = p.y;
    return;
  }
  if (name === 'bank') {
    finishIntro(state);
    state.banner = null; // the JOB 1 banner belongs to the cover scene
    p.x = lm.bank.vault.x;
    p.y = lm.bank.vault.y + 26;
    p.angle = -Math.PI / 2;
    p.money = 1450;
    state.channel = { t: 2.6, need: 5, label: 'EMPTYING THE VAULT' };
    state.wanted.heat = 345;
    state.dialogue = {
      lines: [{ who: 'Marta Quill (phone)', text: 'The vault is open, Dario. Fill the bag, lose the heat, and bring me my two thousand.' }],
      i: 0, tag: 'shot', t: 0,
    };
    state.objective = { x: lm.bank.vault.x, y: lm.bank.vault.y, text: 'Rob Palma Bay Bank — hold at the vault doors' };
    const copA = createCar('police', lm.bank.vault.x - 330, lm.bank.vault.y + 190, 0.5, 'police');
    const copB = createCar('police', lm.bank.vault.x + 300, lm.bank.vault.y + 230, 2.6, 'police');
    state.cars.push(copA, copB);
    state.camera.x = p.x;
    state.camera.y = p.y;
    return;
  }
  if (name === 'marina') {
    state.storyDone = true;
    state.missions.stage = 'done';
    p.money = 2460;
    // On the shore road north of the marina, so the frame holds the water,
    // the decks and the city together instead of open sea.
    const cab = createCar('taxi', 1500, 2898, 0, 'player', '#f2b705');
    cab.speed = 300;
    state.cars.push(cab);
    p.car = cab;
    p.x = cab.x;
    p.y = cab.y;
    state.objective = { x: 2545, y: 2966, text: 'Cab fare — $96 across town' };
    state.camera.x = p.x + 60;
    state.camera.y = p.y - 40;
    return;
  }
  // cover: the first morning of the story, on foot downtown, job 1 live.
  finishIntro(state);
  p.x = 1990;
  p.y = 2270;
  p.angle = -2.2;
  const sedan = createCar('sedan', 1960, 1778, 0, 'traffic', '#5b7fa6');
  sedan.heading = 0;
  sedan.ti = 4;
  sedan.tj = 3;
  sedan.cruise = 230;
  state.cars.push(sedan);
  state.camera.x = p.x;
  state.camera.y = p.y;
}
