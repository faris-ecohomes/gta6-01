// Palma Bay: Heat Wave — shared numbers. The city grid, the car catalogue and
// every price in the game live here so the rest of the code reads them by name.
export const STEP = 1 / 60;
export const SAVE_KEY = 'palma-bay-heat-wave-save-v1';

// The city is 6 by 6 blocks of 430 px with 130 px roads between and around
// them: 6 * 430 + 7 * 130 = 3490 px square.
export const CITY = {
  blocks: 6,
  blockSize: 430,
  roadSize: 130,
  pitch: 560,
  size: 3490,
  laneOffset: 33,
};

/** Centreline coordinate of the k-th road (0..6), same on both axes. */
export function roadCentre(k) {
  return CITY.roadSize / 2 + k * CITY.pitch;
}

/** Top-left corner of block (bx, by). */
export function blockOrigin(bx, by) {
  return { x: CITY.roadSize + bx * CITY.pitch, y: CITY.roadSize + by * CITY.pitch };
}

// Invented Palma Bay car models. topSpeed is px/s, accel px/s^2, grip is how
// fast the nose follows the steering, health is hit points before it burns.
export const CAR_TYPES = {
  coupe: { name: 'Solana Coupe', topSpeed: 430, accel: 300, grip: 3.4, health: 130, width: 44, length: 92, colors: ['#d9a441', '#b03a48', '#3f6fb5', '#2e2a26'] },
  sedan: { name: 'Bayside Sedan', topSpeed: 340, accel: 230, grip: 2.8, health: 150, width: 46, length: 96, colors: ['#c8ccd2', '#5b7fa6', '#7a4a56', '#3d4a42', '#22262b'] },
  hatch: { name: 'Palma Hatch', topSpeed: 300, accel: 210, grip: 3.0, health: 120, width: 42, length: 82, colors: ['#e0e4e8', '#d9704a', '#6aa84f', '#4a6fa5', '#c2b280'] },
  pickup: { name: 'Dune Pickup', topSpeed: 320, accel: 220, grip: 2.5, health: 190, width: 48, length: 102, colors: ['#8a6f4d', '#546e7a', '#704214', '#d6cfc4'] },
  van: { name: 'Cargo Van', topSpeed: 280, accel: 180, grip: 2.2, health: 220, width: 50, length: 108, colors: ['#e8e8e6', '#9db2c8', '#c8b8a2'] },
  taxi: { name: 'Palma Cab', topSpeed: 350, accel: 240, grip: 2.9, health: 150, width: 46, length: 96, colors: ['#f2b705'] },
  police: { name: 'PBPD Interceptor', topSpeed: 445, accel: 320, grip: 3.3, health: 210, width: 46, length: 98, colors: ['#20242c'] },
};

export const PRICES = {
  spray: 150, // pay'n'spray: full repair and a clean slate
  heal: 50, // hospital: back to full health
  bustedBase: 150, // plus per star
  bustedPerStar: 90,
  wastedFee: 100, // hospital bill when you wake up there
  debt: 2000, // what Dario owes the Sorrento family
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  sprintSpeed: 265,
  maxHealth: 100,
};

export const WANTED = {
  // Heat thresholds at which each star lights up.
  starAt: [40, 115, 210, 330, 470, 640],
  maxHeat: 760,
  decayPerSecond: 13,
  unseenSeconds: 4, // stay unseen this long and the heat starts to fall
};
