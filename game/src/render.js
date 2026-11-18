// The look of Palma Bay: a sun-soaked island city drawn in flat colour —
// teal water, sand sidewalks, pastel roofs, palm shadows — from a camera
// that hovers over Dario. Everything is canvas 2D, nothing is an image.
import { CITY, roadCentre } from './config.js';
import { dist } from './physics.js';

const WATER = '#2e8fa3';
const WATER_DEEP = '#257487';
const ASPHALT = '#494950';
const ASPHALT_EDGE = '#3c3c42';
const SIDEWALK = '#d9d2bf';
const GRASS = '#79b264';
const SAND = '#ecd9a8';
const CONCRETE = '#b7b0a0';
const DECK = '#a9805a';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function draw(state) {
    const viewW = state.viewW;
    const viewH = state.viewH;
    const cam = state.camera;
    const shakeX = state.shake > 0 ? state.rng.range(-state.shake, state.shake) : 0;
    const shakeY = state.shake > 0 ? state.rng.range(-state.shake, state.shake) : 0;
    const left = cam.x - viewW / 2 + shakeX;
    const top = cam.y - viewH / 2 + shakeY;

    ctx.fillStyle = WATER_DEEP;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.save();
    ctx.translate(-left, -top);
    const view = { l: left - 60, t: top - 60, r: left + viewW + 60, b: top + viewH + 60 };
    drawWater(state, view);
    drawGround(state, view);
    drawRoads(state, view);
    drawDecks(state, view);
    drawProps(state, view);
    drawBuildings(state, view);
    drawMarkers(state, view);
    for (const car of state.cars) if (!car.wreck) drawCar(state, car);
    for (const car of state.cars) if (car.wreck) drawCar(state, car);
    for (const ped of state.peds) drawPed(state, ped);
    if (!state.player.car) drawPlayer(state);
    drawEffects(state);
    ctx.restore();
    // Golden-hour warmth over everything.
    const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.42, viewW / 2, viewH / 2, viewH * 0.95);
    grad.addColorStop(0, 'rgba(255,190,90,0.05)');
    grad.addColorStop(1, 'rgba(70,30,60,0.16)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  function visible(view, x, y, w, h) {
    return x + w >= view.l && x <= view.r && y + h >= view.t && y <= view.b;
  }

  function drawWater(state, view) {
    ctx.fillStyle = WATER;
    for (const w of state.city.waters) {
      if (!visible(view, w.x, w.y, w.w, w.h)) continue;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      const off = (state.time * 24) % 46;
      ctx.beginPath();
      for (let x = w.x + off - 46; x < w.x + w.w; x += 46) {
        for (let y = w.y + 22; y < w.y + w.h; y += 52) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + 18, y);
        }
      }
      ctx.stroke();
    }
    // The sea around the island, with a sand rim.
    ctx.fillStyle = SAND;
    ctx.fillRect(-90, -90, CITY.size + 180, 90);
    ctx.fillRect(-90, CITY.size, CITY.size + 180, 90);
    ctx.fillRect(-90, 0, 90, CITY.size);
    ctx.fillRect(CITY.size, 0, 90, CITY.size);
  }

  function drawGround(state, view) {
    for (const block of state.city.blocks) {
      if (!visible(view, block.x, block.y, CITY.blockSize, CITY.blockSize)) continue;
      let fill = SIDEWALK;
      if (block.kind === 'park') fill = GRASS;
      else if (block.kind === 'marina') fill = WATER;
      else if (block.kind === 'docks' || block.kind === 'warehouse') fill = CONCRETE;
      else if (block.kind === 'pier') fill = SAND;
      ctx.fillStyle = fill;
      ctx.fillRect(block.x, block.y, CITY.blockSize, CITY.blockSize);
      if (block.kind === 'park') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(block.x + 20, block.y + CITY.blockSize / 2);
        ctx.lineTo(block.x + CITY.blockSize - 20, block.y + CITY.blockSize / 2);
        ctx.moveTo(block.x + CITY.blockSize / 2, block.y + 20);
        ctx.lineTo(block.x + CITY.blockSize / 2, block.y + CITY.blockSize - 20);
        ctx.stroke();
      }
    }
  }

  function drawRoads(state, view) {
    ctx.fillStyle = ASPHALT;
    for (let k = 0; k <= CITY.blocks; k += 1) {
      const c = roadCentre(k);
      ctx.fillRect(c - CITY.roadSize / 2, 0, CITY.roadSize, CITY.size);
      ctx.fillRect(0, c - CITY.roadSize / 2, CITY.size, CITY.roadSize);
    }
    ctx.fillStyle = ASPHALT_EDGE;
    for (let k = 0; k <= CITY.blocks; k += 1) {
      const c = roadCentre(k);
      ctx.fillRect(c - CITY.roadSize / 2, 0, 4, CITY.size);
      ctx.fillRect(c + CITY.roadSize / 2 - 4, 0, 4, CITY.size);
      ctx.fillRect(0, c - CITY.roadSize / 2, CITY.size, 4);
      ctx.fillRect(0, c + CITY.roadSize / 2 - 4, CITY.size, 4);
    }
    // Dashed centre lines.
    ctx.fillStyle = 'rgba(240,230,190,0.75)';
    for (let k = 0; k <= CITY.blocks; k += 1) {
      const c = roadCentre(k);
      for (let d = 12; d < CITY.size; d += 56) {
        // Leave the intersections unpainted.
        let inCross = false;
        for (let m = 0; m <= CITY.blocks; m += 1) {
          if (Math.abs(d + 14 - roadCentre(m)) < CITY.roadSize / 2 + 8) inCross = true;
        }
        if (!inCross) {
          if (visible(view, c - 3, d, 6, 28)) ctx.fillRect(c - 3, d, 6, 28);
          if (visible(view, d, c - 3, 28, 6)) ctx.fillRect(d, c - 3, 28, 6);
        }
      }
    }
    // Crosswalks at every junction.
    ctx.fillStyle = 'rgba(235,235,235,0.5)';
    for (let i = 0; i <= CITY.blocks; i += 1) {
      for (let j = 0; j <= CITY.blocks; j += 1) {
        const cx = roadCentre(i);
        const cy = roadCentre(j);
        if (!visible(view, cx - 70, cy - 70, 140, 140)) continue;
        for (let s = -52; s <= 52; s += 17) {
          ctx.fillRect(cx + s - 5, cy - CITY.roadSize / 2 + 3, 10, 15);
          ctx.fillRect(cx + s - 5, cy + CITY.roadSize / 2 - 18, 10, 15);
          ctx.fillRect(cx - CITY.roadSize / 2 + 3, cy + s - 5, 15, 10);
          ctx.fillRect(cx + CITY.roadSize / 2 - 18, cy + s - 5, 15, 10);
        }
      }
    }
  }

  function drawDecks(state, view) {
    ctx.fillStyle = DECK;
    for (const d of state.city.decks) {
      if (!visible(view, d.x, d.y, d.w, d.h)) continue;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = 'rgba(70,45,25,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const step = d.w > d.h ? 14 : 14;
      if (d.w > d.h) {
        for (let x = d.x + step; x < d.x + d.w; x += step) { ctx.moveTo(x, d.y); ctx.lineTo(x, d.y + d.h); }
      } else {
        for (let y = d.y + step; y < d.y + d.h; y += step) { ctx.moveTo(d.x, y); ctx.lineTo(d.x + d.w, y); }
      }
      ctx.stroke();
    }
  }

  function drawProps(state, view) {
    for (const lamp of state.city.lamps) {
      if (!visible(view, lamp.x - 6, lamp.y - 6, 12, 12)) continue;
      ctx.fillStyle = '#6a6f76';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const palm of state.city.palms) {
      if (!visible(view, palm.x - 30, palm.y - 30, 60, 60)) continue;
      // Shadow first, then the fronds: a green star over a short trunk.
      ctx.fillStyle = 'rgba(30,60,30,0.25)';
      ctx.beginPath();
      ctx.ellipse(palm.x + 10, palm.y + 13, 24, 10, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2e7d46';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let f = 0; f < 6; f += 1) {
        const a = (f / 6) * Math.PI * 2 + 0.4;
        ctx.moveTo(palm.x, palm.y);
        ctx.quadraticCurveTo(
          palm.x + Math.cos(a) * 15, palm.y + Math.sin(a) * 15 - 4,
          palm.x + Math.cos(a) * 27, palm.y + Math.sin(a) * 27 + 5,
        );
      }
      ctx.stroke();
      ctx.fillStyle = '#7a5a38';
      ctx.beginPath();
      ctx.arc(palm.x, palm.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBuildings(state, view) {
    const drawOne = (b) => {
      if (!visible(view, b.x - 20, b.y - 20, b.w + 40, b.h + 40)) return;
      ctx.fillStyle = 'rgba(40,30,50,0.28)';
      ctx.fillRect(b.x + 11, b.y + 15, b.w, b.h);
      if (b.boat) {
        ctx.fillStyle = '#f4f1ea';
        roundRect(b.x, b.y, b.w, b.h, 12);
        ctx.fill();
        ctx.fillStyle = '#7fb3c8';
        roundRect(b.x + 7, b.y + b.h * 0.3, b.w - 14, b.h * 0.36, 6);
        ctx.fill();
        return;
      }
      if (b.container) {
        ctx.fillStyle = b.roof;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        for (let x = b.x + 12; x < b.x + b.w; x += 14) {
          ctx.beginPath();
          ctx.moveTo(x, b.y + 3);
          ctx.lineTo(x, b.y + b.h - 3);
          ctx.stroke();
        }
        return;
      }
      ctx.fillStyle = shade(b.roof, -28);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.strokeStyle = 'rgba(90,70,50,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 14, b.y + 14, b.w - 28, b.h - 28);
      // Roof furniture — air-con boxes and a skylight — placed by a hash of
      // the building's corner so every frame (and every screenshot) agrees.
      if (b.w > 92 && b.h > 92) {
        const h1 = hash2(b.x, b.y);
        const h2 = hash2(b.y, b.x);
        ctx.fillStyle = 'rgba(105,95,85,0.55)';
        ctx.fillRect(b.x + 20 + h1 * (b.w - 90), b.y + 20 + h2 * (b.h - 90), 34, 24);
        ctx.fillStyle = 'rgba(140,180,200,0.5)';
        ctx.fillRect(b.x + b.w - 66 - h2 * 30, b.y + b.h - 58 - h1 * 26, 40, 30);
        ctx.fillStyle = 'rgba(105,95,85,0.4)';
        ctx.beginPath();
        ctx.arc(b.x + b.w * (0.3 + h1 * 0.4), b.y + b.h * (0.3 + h2 * 0.4), 9, 0, Math.PI * 2);
        ctx.fill();
      }
      if (b.name) {
        ctx.fillStyle = 'rgba(50,40,35,0.85)';
        ctx.font = `bold ${Math.max(13, Math.min(21, b.w / 11))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2, b.w - 26);
      }
    };
    for (const b of state.city.buildings) drawOne(b);
    for (const e of state.city.extras) drawOne(e);
    // The hospital's cross and the bank's columns get their own marks.
    const lm = state.city.landmarks;
    if (lm.hospital) {
      const h = lm.hospital;
      ctx.fillStyle = '#d33f2e';
      ctx.fillRect(h.x - 8, h.y - 26, 16, 52);
      ctx.fillRect(h.x - 26, h.y - 8, 52, 16);
    }
  }

  function drawMarkers(state, view) {
    const lm = state.city.landmarks;
    // Service pads: spray booth and hospital door.
    if (lm.customs) pad(lm.customs.spray.x, lm.customs.spray.y, '#39c2a5', 'S');
    if (lm.hospital) pad(lm.hospital.heal.x, lm.hospital.heal.y, '#e2574c', '+');
    // The live objective gets a pillar of light you can see across town.
    const obj = state.objective;
    if (obj && obj.x !== undefined) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.12;
      const grad = ctx.createLinearGradient(0, obj.y - 330, 0, obj.y);
      grad.addColorStop(0, 'rgba(255,209,77,0)');
      grad.addColorStop(1, 'rgba(255,209,77,0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(obj.x - 15, obj.y - 330, 30, 330);
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, 27 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      const bob = Math.sin(state.time * 4) * 6;
      ctx.moveTo(obj.x, obj.y - 58 + bob);
      ctx.lineTo(obj.x - 11, obj.y - 78 + bob);
      ctx.lineTo(obj.x + 11, obj.y - 78 + bob);
      ctx.closePath();
      ctx.fill();
    }
    void view;
  }

  function pad(x, y, color, label) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 1);
  }

  function drawCar(state, car) {
    const t = car.type;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = t.length;
    const W = t.width;
    ctx.fillStyle = 'rgba(30,25,35,0.3)';
    roundRect(-L / 2 + 4, -W / 2 + 6, L, W, 9);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#17181c';
    const wy = W / 2 - 3;
    for (const [wx, wyy] of [[-L / 2 + 15, -wy], [L / 2 - 15, -wy], [-L / 2 + 15, wy], [L / 2 - 15, wy]]) {
      ctx.fillRect(wx - 8, wyy - 4, 16, 8);
    }
    ctx.fillStyle = car.wreck ? '#2b2724' : car.color;
    roundRect(-L / 2, -W / 2, L, W, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    roundRect(-L / 2, -W / 2, L, W, 9);
    ctx.stroke();
    if (!car.wreck) {
      // Glasshouse and windshield.
      ctx.fillStyle = 'rgba(24,32,44,0.9)';
      roundRect(-L * 0.08, -W / 2 + 6, L * 0.34, W - 12, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,180,210,0.55)';
      roundRect(L * 0.2, -W / 2 + 7, L * 0.09, W - 14, 3);
      ctx.fill();
      if (car.kind === 'taxi') {
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.fillStyle = '#22252b';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('T', 0, 1);
      }
      if (car.kind === 'police') {
        ctx.fillStyle = '#eef1f4';
        ctx.fillRect(-L * 0.05, -W / 2 + 3, L * 0.3, 7);
        ctx.fillRect(-L * 0.05, W / 2 - 10, L * 0.3, 7);
        const flash = Math.sin(state.time * 10) > 0;
        ctx.fillStyle = flash ? '#ff4747' : '#4779ff';
        ctx.fillRect(-7, -W / 2 + 4, 14, 6);
        ctx.fillStyle = flash ? '#4779ff' : '#ff4747';
        ctx.fillRect(-7, W / 2 - 10, 14, 6);
      }
      if (car.special === 'mission-coupe') {
        ctx.strokeStyle = '#ffe98a';
        ctx.lineWidth = 3;
        roundRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 11);
        ctx.stroke();
      }
      // Headlights when it moves.
      if (Math.abs(car.speed) > 20) {
        ctx.fillStyle = 'rgba(255,244,190,0.85)';
        ctx.fillRect(L / 2 - 3, -W / 2 + 5, 4, 7);
        ctx.fillRect(L / 2 - 3, W / 2 - 12, 4, 7);
      }
    }
    ctx.restore();
    void state;
  }

  function drawPed(state, ped) {
    if (ped.state === 'riding') return;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.dead) {
      ctx.fillStyle = 'rgba(120,30,30,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.shirt;
      roundRect(-14, -7, 28, 14, 6);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(17, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(30,25,35,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(ped.angle);
    const stride = Math.sin(ped.walkPhase) * 6;
    ctx.strokeStyle = ped.pants;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-4, stride * 0.6 + 4);
    ctx.moveTo(0, 0);
    ctx.lineTo(-4, -stride * 0.6 - 4);
    ctx.stroke();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(4.5, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (ped.kind === 'guard') {
      ctx.fillStyle = '#22252b';
      ctx.beginPath();
      ctx.arc(4.5, 0, 6, Math.PI * 0.9, Math.PI * 1.9);
      ctx.fill();
      ctx.strokeStyle = '#22252b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(19, 0);
      ctx.stroke();
    }
    ctx.restore();
    if (ped.state === 'report') {
      // A witness on the phone: the little bubble that means trouble.
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ped.x + 13, ped.y - 17, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d33f2e';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', ped.x + 13, ped.y - 16);
    }
    void state;
  }

  function drawPlayer(state) {
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(30,25,35,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 12, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(p.angle);
    const stride = Math.sin(p.walkPhase) * 6.5;
    ctx.strokeStyle = '#2c3440';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-4, stride * 0.6 + 4);
    ctx.moveTo(0, 0);
    ctx.lineTo(-4, -stride * 0.6 - 4);
    ctx.stroke();
    ctx.fillStyle = '#0f7d8c'; // Dario's teal jacket
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(5, 0, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEffects(state) {
    for (const e of state.effects) {
      const lifeRatio = e.maxLife ? e.life / e.maxLife : 1;
      if (e.kind === 'tracer') {
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = Math.max(0, lifeRatio);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(e.x1, e.y1);
        ctx.lineTo(e.x2, e.y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.kind === 'particle') {
        ctx.globalAlpha = Math.max(0, lifeRatio) * 0.9;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * (e.color.includes('rgba') ? 2 - lifeRatio : lifeRatio), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return { draw };
}

/** A stable 0..1 hash of two coordinates, for decoration that must not flicker. */
function hash2(a, b) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Darken or lighten a #rrggbb colour by an amount. */
function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

export function updateEffects(state, dt) {
  for (let i = state.effects.length - 1; i >= 0; i -= 1) {
    const e = state.effects[i];
    e.life -= dt;
    if (e.kind === 'particle') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
    if (e.life <= 0) state.effects.splice(i, 1);
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
  void dist;
}
