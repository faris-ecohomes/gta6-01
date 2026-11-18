// Palma Bay itself: a seeded 6x6-block city of pastel towers, named landmarks,
// a marina cut into the south shore, parking, palms and lamps. Everything the
// physics and the renderer need comes out of generateCity as plain data.
import { CITY, blockOrigin, roadCentre } from './config.js';

const ROOF_COLORS = ['#e8dcc8', '#dfc9a8', '#cfe0e2', '#e6c8b8', '#d8d2e8', '#f0e6d2', '#c8d8c0', '#e2b8a0', '#d0e2ec', '#ead9c2'];
const PARK_KIND = 'park';
const MARINA_KIND = 'marina';

// Landmark blocks, by grid position: everything else is housing and shops.
const LANDMARK_BLOCKS = {
  '2,2': 'customs',
  '4,1': 'hospital',
  '3,3': 'bank',
  '5,5': 'warehouse',
  '1,5': 'docks',
  '5,0': 'police',
  '0,3': PARK_KIND,
  '2,5': MARINA_KIND,
  '3,5': MARINA_KIND,
  '4,5': 'pier',
};

function rect(x, y, w, h) {
  return { x, y, w, h };
}

export function generateCity(rng) {
  const buildings = [];
  const solids = [];
  const extras = []; // solids that are not buildings but still drawn: sheds, containers
  const waters = [];
  const decks = [];
  const parkingSpots = [];
  const palms = [];
  const lamps = [];
  const blocks = [];
  const landmarks = {};

  function addBuilding(x, y, w, h, name) {
    const b = { x, y, w, h, roof: rng.pick(ROOF_COLORS), name: name ?? null };
    buildings.push(b);
    solids.push(b);
    return b;
  }

  for (let by = 0; by < CITY.blocks; by += 1) {
    for (let bx = 0; bx < CITY.blocks; bx += 1) {
      const o = blockOrigin(bx, by);
      const kind = LANDMARK_BLOCKS[`${bx},${by}`] ?? 'city';
      blocks.push({ bx, by, x: o.x, y: o.y, kind });

      if (kind === 'city') {
        // Four plots a block; most hold a building, some are parking lots.
        for (let py = 0; py < 2; py += 1) {
          for (let px = 0; px < 2; px += 1) {
            const plotX = o.x + 12 + px * 209;
            const plotY = o.y + 12 + py * 209;
            if (rng.chance(0.22)) {
              for (let s = 0; s < 3; s += 1) {
                parkingSpots.push({ x: plotX + 34 + s * 62, y: plotY + 100, angle: -Math.PI / 2 });
              }
            } else {
              const inset = rng.int(6, 26);
              addBuilding(plotX + inset, plotY + inset, 196 - inset * 2, 196 - inset * 2);
            }
          }
        }
      } else if (kind === PARK_KIND) {
        addBuilding(o.x + 165, o.y + 165, 100, 100, 'Coral Park Pavilion');
        for (let i = 0; i < 9; i += 1) palms.push({ x: o.x + rng.int(30, 400), y: o.y + rng.int(30, 400) });
      } else if (kind === MARINA_KIND) {
        waters.push(rect(o.x - 6, o.y - 6, CITY.blockSize + 12, CITY.blockSize + 12));
        // Three wooden fingers you can walk and drive on, boats between them.
        for (let f = 0; f < 3; f += 1) {
          const dx = o.x + 52 + f * 148;
          decks.push(rect(dx, o.y + 8, 52, CITY.blockSize - 16));
          parkingSpots.push({ x: dx + 26, y: o.y + 40, angle: Math.PI / 2 });
        }
        for (let bn = 0; bn < 3; bn += 1) {
          const boat = rect(o.x + 118 + bn * 148, o.y + rng.int(90, 300), 30, 64);
          buildings.push({ ...boat, roof: '#f4f1ea', name: null, boat: true });
          solids.push(boat);
        }
      } else if (kind === 'pier') {
        for (let i = 0; i < 7; i += 1) palms.push({ x: o.x + 30 + i * 62, y: o.y + 34 });
        decks.push(rect(o.x + 20, o.y + 300, CITY.blockSize - 40, 110));
        addBuilding(o.x + 130, o.y + 90, 170, 90, 'Pier Snack Bar');
      } else {
        buildLandmark(kind, o, { landmarks, addBuilding, parkingSpots, solids, extras });
      }

      // Two cars parked along the south curb of most blocks.
      if (kind !== MARINA_KIND && rng.chance(0.85)) {
        parkingSpots.push({ x: o.x + rng.int(70, 150), y: o.y + CITY.blockSize + 34, angle: 0 });
        parkingSpots.push({ x: o.x + rng.int(260, 350), y: o.y + CITY.blockSize + 34, angle: 0 });
      }
    }
  }

  // Palms and lamps dress the road corners.
  for (let k = 0; k <= CITY.blocks; k += 1) {
    for (let m = 0; m <= CITY.blocks; m += 1) {
      const cx = roadCentre(k);
      const cy = roadCentre(m);
      if (rng.chance(0.7)) palms.push({ x: cx + 52, y: cy + 52 });
      if (rng.chance(0.7)) palms.push({ x: cx - 52, y: cy - 52 });
      lamps.push({ x: cx + 58, y: cy - 58 });
      lamps.push({ x: cx - 58, y: cy + 58 });
    }
  }

  return { buildings, solids, extras, waters, decks, parkingSpots, palms, lamps, blocks, landmarks };
}

function buildLandmark(kind, o, ctx) {
  const { landmarks, addBuilding, parkingSpots, solids, extras } = ctx;
  const cx = o.x + CITY.blockSize / 2;
  if (kind === 'customs') {
    addBuilding(o.x + 55, o.y + 40, 320, 150, 'Palma Customs');
    for (let s = 0; s < 4; s += 1) parkingSpots.push({ x: o.x + 70 + s * 78, y: o.y + 330, angle: -Math.PI / 2 });
    landmarks.customs = {
      name: 'Palma Customs', x: cx, y: o.y + 115,
      spray: { x: cx, y: o.y + 262 }, // drive in here to lose the heat
      meet: { x: cx, y: o.y + 262 },
    };
  } else if (kind === 'hospital') {
    addBuilding(o.x + 65, o.y + 60, 300, 210, 'Palma Bay Hospital');
    landmarks.hospital = {
      name: 'Palma Bay Hospital', x: cx, y: o.y + 165,
      heal: { x: cx, y: o.y + 300 },
      respawn: { x: cx, y: o.y + 330 },
    };
  } else if (kind === 'bank') {
    addBuilding(o.x + 75, o.y + 70, 280, 190, 'Palma Bay Bank');
    landmarks.bank = {
      name: 'Palma Bay Bank', x: cx, y: o.y + 165,
      vault: { x: cx, y: o.y + 292 },
    };
  } else if (kind === 'warehouse') {
    const shed = { x: o.x + 45, y: o.y + 80, w: 340, h: 200, roof: '#9aa4ac', name: 'Sorrento Warehouse', container: false };
    landmarks.warehouse = { name: 'Sorrento Warehouse', x: cx, y: o.y + 180, drop: { x: cx, y: o.y + 322 } };
    solids.push(shed);
    extras.push(shed);
  } else if (kind === 'docks') {
    landmarks.docks = { name: 'Palma Docks', x: cx, y: o.y + 200, pickup: { x: o.x + 110, y: o.y + 330 } };
    for (let c = 0; c < 5; c += 1) {
      const box = { x: o.x + 40 + (c % 3) * 128, y: o.y + 60 + Math.floor(c / 3) * 120, w: 104, h: 44, roof: ['#c96f4a', '#4a7a8c', '#7a9a52'][c % 3], name: null, container: true };
      solids.push(box);
      extras.push(box);
    }
  } else if (kind === 'police') {
    addBuilding(o.x + 65, o.y + 70, 300, 180, 'PBPD Headquarters');
    landmarks.police = { name: 'PBPD Headquarters', x: cx, y: o.y + 160, respawn: { x: cx, y: o.y + 300 } };
  }
}

/** Is the point standing on a deck over the water (piers, marina fingers)? */
export function onDeck(city, x, y) {
  return city.decks.some((d) => x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h);
}

/** Is the point in open water and not on a deck? */
export function inWater(city, x, y) {
  if (onDeck(city, x, y)) return false;
  return city.waters.some((w) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
}
