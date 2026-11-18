// The story: Dario Venn owes the Sorrento family $2,000, and their fixer
// Marta Quill has three jobs that will cover it — steal a coupe, run a
// package past her own family's guards, rob the Palma Bay Bank. After the
// debt dies, the city opens up: endless cab fares for honest money.
import { CITY, PRICES, WANTED, blockOrigin } from './config.js';
import { createCar } from './cars.js';
import { createPed } from './peds.js';
import { dist } from './physics.js';
import { sfx } from './audio.js';

export function createMissions() {
  return {
    index: 0, // job in progress: 0 = none yet, 1..3 = the jobs, 4 = story done
    active: false, // a job (not a cutscene gap) is on the table
    stage: 'intro',
    coupe: null,
    packageTimer: 0,
    hasPackage: false,
    guards: [],
    channelT: 0,
  };
}

export function banner(state, text, seconds = 3.4) {
  state.banner = { text, until: state.time + seconds };
}

export function say(state, lines, tag) {
  state.dialogue = { lines, i: 0, tag, t: 0 };
}

/** Advance the open dialogue; runs its completion when the lines run out. */
export function advanceDialogue(state) {
  const d = state.dialogue;
  if (!d) return;
  sfx.blip();
  d.i += 1;
  d.t = 0;
  if (d.i >= d.lines.length) {
    state.dialogue = null;
    finishDialogue(state, d.tag);
  }
}

function finishDialogue(state, tag) {
  if (tag === 'intro') beginJob1(state);
  else if (tag === 'job1done') beginJob2(state);
  else if (tag === 'job2done') beginJob3(state);
}

/** Restart a job from its beginning (a loaded save picks up at job level). */
export function startJob(state, n) {
  if (n <= 0) startStory(state);
  else if (n === 1) beginJob1(state);
  else if (n === 2) beginJob2(state);
  else beginJob3(state);
}

export function startStory(state) {
  say(state, [
    { who: 'Marta Quill (phone)', text: "Dario, it's Marta. The Sorrento family has been patient about the two thousand you owe. Aldo stops being patient on Friday." },
    { who: 'Dario', text: "I drive, Marta. I don't print money." },
    { who: 'Marta Quill (phone)', text: "Then drive. A gold Solana Coupe is sitting by the marina, and Palma Customs wants it. Bring it in — six hundred, in your pocket." },
    { who: 'Marta Quill (phone)', text: 'And Dario — if the police take an interest, the Customs spray booth wipes a car clean. $150. Cheaper than a cell.' },
  ], 'intro');
}

function setObjective(state, x, y, text) {
  state.objective = { x, y, text };
}

function beginJob1(state) {
  const m = state.missions;
  m.index = 1;
  m.stage = 'steal';
  const coupe = createCar('coupe', 2050, 2836, 0, 'parked', '#d9a441');
  coupe.special = 'mission-coupe';
  m.coupe = coupe;
  state.cars.push(coupe);
  setObjective(state, coupe.x, coupe.y, 'Steal the gold Solana Coupe — the Marina');
  banner(state, 'JOB 1 — BORROWED WHEELS', 3.6);
}

function beginJob2(state) {
  const m = state.missions;
  const docks = state.city.landmarks.docks;
  m.index = 2;
  m.stage = 'pickup';
  setObjective(state, docks.pickup.x, docks.pickup.y, 'Pick up the package — Palma Docks');
  banner(state, 'JOB 2 — THE QUIET PACKAGE', 3.6);
}

function beginJob3(state) {
  const m = state.missions;
  const bank = state.city.landmarks.bank;
  m.index = 3;
  m.stage = 'rob';
  setObjective(state, bank.vault.x, bank.vault.y, 'Rob Palma Bay Bank — hold at the vault doors');
  banner(state, 'JOB 3 — THE SORRENTO SHARE', 3.6);
}

function job1Delivered(state) {
  const m = state.missions;
  const p = state.player;
  p.money += 600;
  sfx.cash();
  if (p.car === m.coupe) {
    p.car = null;
    m.coupe.mode = 'parked';
    m.coupe.special = null;
    p.x = m.coupe.x + 20;
    p.y = m.coupe.y + 52;
  }
  m.coupe = null;
  m.stage = 'between';
  state.objective = null;
  banner(state, 'JOB DONE — +$600', 3.4);
  say(state, [
    { who: 'Marta Quill (phone)', text: 'Clean work. That coupe was sold twice before you even parked it.' },
    { who: 'Marta Quill (phone)', text: "Next: Palma Docks. A package comes off the boats — take it to the family warehouse across town. Eight hundred. The warehouse keeps armed company, so go ready." },
  ], 'job1done');
}

function spawnWarehouseGuards(state) {
  const m = state.missions;
  const drop = state.city.landmarks.warehouse.drop;
  const spots = [
    { x: drop.x - 120, y: drop.y - 60 },
    { x: drop.x + 130, y: drop.y - 40 },
    { x: drop.x + 10, y: drop.y - 150 },
  ];
  for (const s of spots) {
    const guard = createPed(state, s.x, s.y, 'guard');
    guard.hostile = false;
    m.guards.push(guard);
    state.peds.push(guard);
  }
}

function clearGuards(state) {
  const m = state.missions;
  state.peds = state.peds.filter((ped) => !m.guards.includes(ped) || ped.dead);
  m.guards = m.guards.filter((g) => g.dead);
}

function job2Delivered(state) {
  const m = state.missions;
  state.player.money += 800;
  m.hasPackage = false;
  sfx.cash();
  clearGuards(state);
  m.stage = 'between';
  state.objective = null;
  banner(state, 'JOB DONE — +$800', 3.4);
  say(state, [
    { who: 'Marta Quill (phone)', text: "You delivered, and you're breathing. Aldo is pleased, which honestly scares me a little." },
    { who: 'Marta Quill (phone)', text: 'Last job, the big one: Palma Bay Bank. Empty the vault, lose the heat, then bring me my two thousand and we are finished.' },
  ], 'job2done');
}

function settleDebt(state) {
  const m = state.missions;
  const p = state.player;
  const paid = Math.min(PRICES.debt, p.money);
  p.money -= paid;
  m.stage = 'done';
  m.index = 4; // saved games read 1..3 as "that job, from its start", 4 as done
  state.storyDone = true;
  state.objective = null;
  sfx.cash();
  if (paid >= PRICES.debt) {
    banner(state, 'DEBT SETTLED — PALMA BAY IS YOURS', 4.2);
    say(state, [
      { who: 'Marta Quill', text: 'Two thousand, counted twice — because it is you. The debt is dead, Dario.' },
      { who: 'Marta Quill', text: 'The city is yours now. If you ever feel honest again, the cab work around here pays. Try not to enjoy it.' },
    ], 'ending');
  } else {
    banner(state, 'DEBT SETTLED — THE FAMILY TAKES THE REST IN FARES', 4.2);
    say(state, [
      { who: 'Marta Quill', text: `Short by $${PRICES.debt - paid}. The family will take it out of your cab fares instead. The debt is dead either way, Dario.` },
    ], 'ending');
  }
}

// --- taxi fares, the endless work after the story -------------------------

export function createTaxi() {
  return { phase: 'idle', waitT: 5, passenger: null, dest: null, fare: 0, timer: 0 };
}

function randomCorner(state) {
  const bx = state.rng.int(0, CITY.blocks - 1);
  const by = state.rng.int(0, CITY.blocks - 1);
  const o = blockOrigin(bx, by);
  return { x: o.x + 16, y: o.y + 16 };
}

function updateTaxi(state, dt) {
  const taxi = state.taxi;
  const p = state.player;
  if (!state.storyDone) return;
  if (taxi.phase === 'idle') {
    taxi.waitT -= dt;
    if (taxi.waitT <= 0 && p.car) {
      const at = randomCorner(state);
      const passenger = createPed(state, at.x, at.y, 'passenger');
      passenger.state = 'wait';
      state.peds.push(passenger);
      taxi.passenger = passenger;
      taxi.phase = 'pickup';
      setObjective(state, at.x, at.y, 'Cab fare — pick up your passenger');
      banner(state, 'FARE — passenger waiting', 2.6);
    }
    return;
  }
  if (taxi.phase === 'pickup') {
    const passenger = taxi.passenger;
    if (!passenger || passenger.dead) {
      taxi.phase = 'idle';
      taxi.waitT = 6;
      state.objective = null;
      return;
    }
    if (p.car && Math.abs(p.car.speed) < 30 && dist(p.x, p.y, passenger.x, passenger.y) < 66) {
      passenger.state = 'board';
    }
    if (passenger.state === 'board') {
      const d = dist(passenger.x, passenger.y, p.x, p.y);
      passenger.x += ((p.x - passenger.x) / (d || 1)) * 150 * dt;
      passenger.y += ((p.y - passenger.y) / (d || 1)) * 150 * dt;
      if (d < 20) {
        passenger.state = 'riding';
        const dest = randomCorner(state);
        taxi.dest = dest;
        taxi.fare = Math.round(42 + dist(p.x, p.y, dest.x, dest.y) / 16);
        taxi.timer = dist(p.x, p.y, dest.x, dest.y) / 150 + 50;
        taxi.phase = 'dropoff';
        setObjective(state, dest.x, dest.y, `Cab fare — $${taxi.fare} across town`);
        sfx.pickup();
      }
    }
    return;
  }
  if (taxi.phase === 'dropoff') {
    taxi.timer -= dt;
    const passenger = taxi.passenger;
    if (passenger) {
      passenger.x = p.x;
      passenger.y = p.y;
    }
    if (taxi.timer <= 0) {
      if (passenger) {
        passenger.state = 'walk';
        passenger.x = p.x + 30;
        passenger.y = p.y + 10;
      }
      banner(state, 'Fare lost — they walked.', 2.6);
      taxi.phase = 'idle';
      taxi.waitT = 7;
      taxi.passenger = null;
      state.objective = null;
      return;
    }
    if (p.car && Math.abs(p.car.speed) < 30 && dist(p.x, p.y, taxi.dest.x, taxi.dest.y) < 72) {
      p.money += taxi.fare;
      state.stats.fares = (state.stats.fares ?? 0) + 1;
      sfx.cash();
      banner(state, `Fare paid — +$${taxi.fare}`, 2.8);
      if (passenger) {
        passenger.state = 'walk';
        passenger.kind = 'walker';
        passenger.x = taxi.dest.x + 14;
        passenger.y = taxi.dest.y + 8;
      }
      taxi.phase = 'idle';
      taxi.waitT = state.rng.range(6, 13);
      taxi.passenger = null;
      state.objective = null;
    }
  }
}

// --- the per-step story driver ---------------------------------------------

export function updateMissions(state, dt) {
  const m = state.missions;
  const p = state.player;
  const lm = state.city.landmarks;
  m.active = !state.storyDone && m.stage !== 'intro' && m.stage !== 'between' && m.stage !== 'done';

  if (state.dialogue) {
    state.dialogue.t += dt;
    if (state.dialogue.t > 9) advanceDialogue(state);
  }

  updateTaxi(state, dt);
  if (state.storyDone || state.dialogue) return;

  if (m.stage === 'steal' && m.coupe) {
    if (m.coupe.wreck) {
      banner(state, 'The coupe is wrecked — Marta sends another.', 3);
      m.coupe = null;
      beginJob1(state);
      return;
    }
    if (p.car === m.coupe) {
      m.stage = 'deliver';
      setObjective(state, lm.customs.spray.x, lm.customs.spray.y, 'Deliver the coupe — Palma Customs');
    }
  } else if (m.stage === 'deliver' && m.coupe) {
    if (m.coupe.wreck) {
      banner(state, 'The coupe is wrecked — Marta sends another.', 3);
      m.coupe = null;
      beginJob1(state);
      return;
    }
    if (p.car !== m.coupe) setObjective(state, m.coupe.x, m.coupe.y, 'Get back in the gold coupe');
    else setObjective(state, lm.customs.spray.x, lm.customs.spray.y, 'Deliver the coupe — Palma Customs');
    if (p.car === m.coupe && dist(p.x, p.y, lm.customs.spray.x, lm.customs.spray.y) < 84 && Math.abs(p.car.speed) < 45) {
      job1Delivered(state);
    }
  } else if (m.stage === 'pickup') {
    if (dist(p.x, p.y, lm.docks.pickup.x, lm.docks.pickup.y) < 62) {
      m.hasPackage = true;
      m.stage = 'run';
      m.packageTimer = 150;
      spawnWarehouseGuards(state);
      setObjective(state, lm.warehouse.drop.x, lm.warehouse.drop.y, 'Deliver the package — Sorrento Warehouse (2:30)');
      banner(state, 'Package aboard — the clock is running', 3);
      sfx.pickup();
    }
  } else if (m.stage === 'run') {
    m.packageTimer -= dt;
    const left = Math.max(0, Math.ceil(m.packageTimer));
    setObjective(state, lm.warehouse.drop.x, lm.warehouse.drop.y, `Deliver the package — Sorrento Warehouse (${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')})`);
    // The warehouse company turns hostile as the delivery rolls in.
    if (dist(p.x, p.y, lm.warehouse.drop.x, lm.warehouse.drop.y) < 340) {
      for (const guard of m.guards) {
        if (!guard.hostile && !guard.dead) {
          guard.hostile = true;
          banner(state, 'Company at the warehouse — they are shooting!', 3);
        }
      }
    }
    if (m.packageTimer <= 0) {
      m.hasPackage = false;
      m.stage = 'pickup';
      clearGuards(state);
      setObjective(state, lm.docks.pickup.x, lm.docks.pickup.y, 'Too slow — fetch another package, Palma Docks');
      banner(state, 'The package went cold. Fetch another.', 3.2);
    } else if (dist(p.x, p.y, lm.warehouse.drop.x, lm.warehouse.drop.y) < 74) {
      job2Delivered(state);
    }
  } else if (m.stage === 'rob') {
    const atVault = !p.car && dist(p.x, p.y, lm.bank.vault.x, lm.bank.vault.y) < 56;
    if (atVault) {
      m.channelT += dt;
      state.channel = { t: m.channelT, need: 5, label: 'EMPTYING THE VAULT' };
      if (m.channelT >= 5) {
        state.channel = null;
        p.money += 2600;
        state.wanted.heat = Math.max(state.wanted.heat, WANTED.starAt[3] + 15);
        state.wanted.unseenT = 0;
        m.stage = 'escape';
        setObjective(state, lm.customs.spray.x, lm.customs.spray.y, 'Lose the heat — outrun them, or spray at Palma Customs');
        banner(state, 'VAULT EMPTIED — +$2,600. LOSE THE HEAT.', 4);
        sfx.cash();
      }
    } else {
      m.channelT = Math.max(0, m.channelT - dt * 2);
      state.channel = m.channelT > 0 ? { t: m.channelT, need: 5, label: 'EMPTYING THE VAULT' } : null;
    }
  } else if (m.stage === 'escape') {
    if (state.wanted.heat <= 0.5) {
      m.stage = 'settle';
      setObjective(state, lm.customs.meet.x, lm.customs.meet.y, `Settle the $${PRICES.debt} debt — Marta, Palma Customs`);
      banner(state, 'Heat lost. Time to settle.', 3.2);
    }
  } else if (m.stage === 'settle') {
    if (dist(p.x, p.y, lm.customs.meet.x, lm.customs.meet.y) < 84) settleDebt(state);
  }
}
