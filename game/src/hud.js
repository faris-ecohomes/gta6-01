// Everything that floats over the world: health and money, the wanted
// stars and the bust meter, the objective with its distance, the minimap
// with police blips, dialogue, banners — and the title, pause, wasted and
// busted screens.
import { CITY, PLAYER, PRICES } from './config.js';
import { isMuted } from './audio.js';

const GOLD = '#ffd34d';
const PANEL = 'rgba(16,20,28,0.72)';

let titleButtons = [];

export function drawHud(state, ctx) {
  const W = state.viewW;
  const H = state.viewH;
  const p = state.player;

  // Top-left: who you are, how hurt, how rich.
  panel(ctx, 14, 14, 232, p.car ? 104 : 82);
  ctx.fillStyle = '#e8e4da';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('DARIO VENN', 26, 36);
  bar(ctx, 26, 44, 208, 13, Math.max(0, p.health) / PLAYER.maxHealth, p.health > 30 ? '#58c96b' : '#e2574c');
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText(`$${Math.max(0, Math.floor(p.money)).toLocaleString('en-US')}`, 26, 84);
  if (state.storyDone) {
    ctx.fillStyle = '#9fe8d8';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('DEBT: SETTLED', 130, 84);
  } else {
    ctx.fillStyle = '#e8a0a0';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(`DEBT: $${PRICES.debt}`, 130, 84);
  }
  if (p.car) {
    ctx.fillStyle = '#c8ccd2';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(p.car.type.name.toUpperCase(), 26, 102);
    bar(ctx, 118, 94, 116, 8, Math.max(0, p.car.health) / p.car.maxHealth, '#7fb3c8');
  }

  drawStars(state, ctx, W);
  drawMinimap(state, ctx, W);
  drawObjective(state, ctx, W);

  // Bottom-right: the speedo, only with wheels under you.
  if (p.car) {
    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.arc(W - 62, H - 58, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 27px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(Math.abs(p.car.speed) * 0.28)), W - 62, H - 52);
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = '#c8ccd2';
    ctx.fillText('KM/H', W - 62, H - 34);
    ctx.textAlign = 'left';
  }

  // The vault channel, centre screen.
  if (state.channel) {
    const w = 320;
    panel(ctx, W / 2 - w / 2, H * 0.62, w, 52);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.channel.label, W / 2, H * 0.62 + 21);
    bar(ctx, W / 2 - w / 2 + 16, H * 0.62 + 30, w - 32, 10, state.channel.t / state.channel.need, GOLD);
    ctx.textAlign = 'left';
  }

  if (state.banner && state.time < state.banner.until) {
    ctx.font = 'bold 19px system-ui, sans-serif';
    const tw = ctx.measureText(state.banner.text).width;
    panel(ctx, W / 2 - tw / 2 - 18, 66, tw + 36, 40);
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.fillText(state.banner.text, W / 2, 93);
    ctx.textAlign = 'left';
  }

  if (state.dialogue) drawDialogue(state, ctx, W, H);

  // Bottom-left: the quiet print, on a dark strip so it reads on pavement.
  ctx.font = '12px system-ui, sans-serif';
  const hintText = p.car
    ? 'W A S D drive · Space brake · E get out · mouse aim, click fire · Esc pause'
    : 'W A S D walk · Shift sprint · E enter car / talk · mouse aim, click fire · Esc pause';
  const hintFull = isMuted() ? `${hintText} · M sound: OFF` : hintText;
  ctx.fillStyle = 'rgba(16,20,28,0.55)';
  ctx.fillRect(8, H - 26, ctx.measureText(hintFull).width + 14, 19);
  ctx.fillStyle = 'rgba(232,228,218,0.85)';
  ctx.fillText(hintFull, 14, H - 12);

  if (p.health < 30 && state.screen === 'play') {
    const pulse = 0.16 + Math.sin(state.time * 6) * 0.07;
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.85);
    grad.addColorStop(0, 'rgba(200,30,30,0)');
    grad.addColorStop(1, `rgba(200,30,30,${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawStars(state, ctx, W) {
  const w = state.wanted;
  if (w.stars <= 0 && w.heat <= 0.5) return;
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  let text = '';
  for (let i = 0; i < 6; i += 1) text += i < w.stars ? '★' : '☆';
  ctx.fillStyle = 'rgba(16,20,28,0.55)';
  const tw = ctx.measureText(text).width;
  ctx.fillRect(W / 2 - tw / 2 - 10, 10, tw + 20, 38);
  ctx.fillStyle = w.stars > 0 ? GOLD : 'rgba(255,211,77,0.4)';
  ctx.fillText(text, W / 2, 38);
  if (w.bust > 0.02) {
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#ff7a6b';
    ctx.fillText('BUSTED', W / 2, 62);
    bar(ctx, W / 2 - 60, 66, 120, 7, w.bust, '#e2574c');
  }
  ctx.textAlign = 'left';
}

function drawMinimap(state, ctx, W) {
  const size = 188;
  const x0 = W - size - 14;
  const y0 = 14;
  const scale = size / CITY.size;
  ctx.fillStyle = 'rgba(20,52,66,0.88)';
  ctx.fillRect(x0, y0, size, size);
  // Blocks as land, roads show through as the sea-grid colour.
  ctx.fillStyle = 'rgba(217,210,191,0.9)';
  for (const block of state.city.blocks) {
    if (block.kind === 'marina') continue;
    ctx.fillStyle = block.kind === 'park' ? 'rgba(121,178,100,0.95)' : 'rgba(217,210,191,0.9)';
    ctx.fillRect(x0 + block.x * scale, y0 + block.y * scale, CITY.blockSize * scale, CITY.blockSize * scale);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, size, size);
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * scale, y0 + y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const lm = state.city.landmarks;
  if (lm.customs) dot(lm.customs.spray.x, lm.customs.spray.y, '#39c2a5', 3.4);
  if (lm.hospital) dot(lm.hospital.heal.x, lm.hospital.heal.y, '#ff6f61', 3.4);
  for (const car of state.cars) {
    if (car.mode === 'police') dot(car.x, car.y, Math.sin(state.time * 10) > 0 ? '#ff4747' : '#5c8dff', 3);
  }
  const obj = state.objective;
  if (obj && obj.x !== undefined) {
    const pulse = 3.6 + Math.sin(state.time * 5) * 1.1;
    dot(obj.x, obj.y, GOLD, pulse);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x0 + obj.x * scale, y0 + obj.y * scale, pulse + 3.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Dario: a white arrow that turns with him.
  const px = x0 + state.player.x * scale;
  const py = y0 + state.player.y * scale;
  const ang = state.player.car ? state.player.car.angle : state.player.angle;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.6);
  ctx.lineTo(-5, 4.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawObjective(state, ctx, W) {
  const obj = state.objective;
  if (!obj) return;
  const size = 188;
  const x0 = W - size - 14;
  const y0 = 14 + size + 8;
  panel(ctx, x0 - 62, y0, size + 62, 58);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('OBJECTIVE', x0 - 48, y0 + 17);
  ctx.fillStyle = '#f2eee2';
  ctx.font = 'bold 12.5px system-ui, sans-serif';
  const lines = wrap(ctx, obj.text, size + 34);
  lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, x0 - 48, y0 + 34 + i * 15));
  if (obj.x !== undefined) {
    const d = Math.round(Math.hypot(obj.x - state.player.x, obj.y - state.player.y) / 10);
    ctx.fillStyle = '#9fe8d8';
    ctx.font = 'bold 12px system-ui, sans-serif';
    // Right-aligned to the panel's inside edge (panel spans x0-62 .. x0+size).
    ctx.fillText(`${d} m`, x0 + size - 12 - ctx.measureText(`${d} m`).width, y0 + 17);
  }
}

function drawDialogue(state, ctx, W, H) {
  const d = state.dialogue;
  const line = d.lines[d.i];
  const w = Math.min(760, W - 80);
  const x = (W - w) / 2;
  const y = H - 128;
  panel(ctx, x, y, w, 92);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(line.who.toUpperCase(), x + 18, y + 24);
  ctx.fillStyle = '#f2eee2';
  ctx.font = '15.5px system-ui, sans-serif';
  wrap(ctx, line.text, w - 36).slice(0, 3).forEach((text, i) => ctx.fillText(text, x + 18, y + 46 + i * 19));
  ctx.fillStyle = 'rgba(232,228,218,0.6)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('E ▸', x + w - 14, y + 80);
  ctx.textAlign = 'left';
}

// --- full screens ----------------------------------------------------------

export function drawScreen(state, ctx) {
  const W = state.viewW;
  const H = state.viewH;
  if (state.screen === 'title') {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(20,16,40,0.62)');
    grad.addColorStop(0.55, 'rgba(20,16,40,0.25)');
    grad.addColorStop(1, 'rgba(20,16,40,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('PALMA BAY', W / 2, H * 0.3);
    ctx.fillStyle = '#ff8a5c';
    ctx.font = 'bold 27px system-ui, sans-serif';
    ctx.fillText('H E A T   W A V E', W / 2, H * 0.3 + 42);
    ctx.fillStyle = '#f2eee2';
    ctx.font = '16px system-ui, sans-serif';
    const story = [
      'Dario Venn drives for whoever pays. Right now he owes the Sorrento family $2,000,',
      'and their fixer Marta Quill has three jobs that will cover it: a stolen coupe,',
      'a quiet package, and the Palma Bay Bank. Steal, drive, rob — and stay out of the cells.',
    ];
    story.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.44 + i * 23));
    titleButtons = [];
    const bw = 250;
    const bx = W / 2 - bw / 2;
    let by = H * 0.58;
    if (state.hasSave) {
      button(ctx, bx, by, bw, 46, 'CONTINUE', 'continue');
      titleButtons.push({ x: bx, y: by, w: bw, h: 46, id: 'continue' });
      by += 58;
    }
    button(ctx, bx, by, bw, 46, state.hasSave ? 'NEW GAME' : 'START — NEW GAME', 'new');
    titleButtons.push({ x: bx, y: by, w: bw, h: 46, id: 'new' });
    ctx.fillStyle = 'rgba(232,228,218,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('W A S D move / drive · Shift sprint · E interact · mouse aim, click to fire · Space brake · Esc pause · M mute', W / 2, H * 0.9);
    ctx.textAlign = 'left';
    return;
  }
  if (state.screen === 'pause') {
    ctx.fillStyle = 'rgba(12,14,22,0.66)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText('PAUSED', W / 2, H * 0.36);
    ctx.fillStyle = '#f2eee2';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Progress saved.', W / 2, H * 0.36 + 34);
    ctx.fillText('Esc or P to resume · the city waits for no one, except now', W / 2, H * 0.36 + 62);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(232,228,218,0.8)';
    const controls = [
      'On foot: WASD walk, Shift sprint, E enter cars, mouse aim + click to fire',
      'In a car: WASD drive, Space brake, E get out (slow down first)',
      'Palma Customs spray booth: $150 — full repair and the heat forgets you',
      'Hospital door: $50 — back on your feet',
    ];
    controls.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.52 + i * 24));
    ctx.textAlign = 'left';
    return;
  }
  if (state.screen === 'wasted' || state.screen === 'busted') {
    const wasted = state.screen === 'wasted';
    ctx.fillStyle = wasted ? 'rgba(60,8,8,0.68)' : 'rgba(8,14,40,0.68)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = wasted ? '#ff5c48' : '#7fb3ff';
    ctx.font = 'bold 62px system-ui, sans-serif';
    ctx.fillText(wasted ? 'WASTED' : 'BUSTED', W / 2, H * 0.42);
    ctx.fillStyle = '#f2eee2';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(state.endText ?? '', W / 2, H * 0.42 + 40);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(232,228,218,0.8)';
    ctx.fillText('Press Enter to go on', W / 2, H * 0.42 + 72);
    ctx.textAlign = 'left';
  }
}

function button(ctx, x, y, w, h, label, id) {
  void id;
  ctx.fillStyle = 'rgba(255,211,77,0.92)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = '#23202a';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 6);
  ctx.textAlign = 'left';
}

/** Which title button (if any) a click at (x, y) lands on. */
export function titleButtonAt(x, y) {
  for (const b of titleButtons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.fill();
}

function bar(ctx, x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}
