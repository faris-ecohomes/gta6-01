// All sound is synthesised with WebAudio: no audio files, nothing to load.
// Short one-shot blips for shots, crashes and cash, plus two loops — the
// engine, pitched by speed, and the police siren, which only sings while
// the wanted level is up. M mutes the master gain.
let ctx = null;
let master = null;
let muted = false;
let engineNodes = null;
let sirenNodes = null;

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ensure()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, vol, lowFreq) {
  if (!ensure()) return;
  const t = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowFreq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

export const sfx = {
  shot() { noise(0.09, 0.5, 3200); tone(160, 0.08, 'square', 0.18, 60); },
  enemyShot() { noise(0.08, 0.32, 2400); tone(130, 0.07, 'square', 0.12, 55); },
  dryFire() { tone(900, 0.03, 'square', 0.08); },
  crash(strength) { noise(0.16 + strength * 0.2, 0.3 + strength * 0.4, 900); tone(90, 0.18, 'triangle', 0.25, 40); },
  explosion() { noise(0.7, 0.9, 500); tone(70, 0.6, 'sine', 0.6, 28); },
  cash() { tone(880, 0.09, 'sine', 0.22); setTimeout(() => tone(1318, 0.14, 'sine', 0.22), 70); },
  blip() { tone(660, 0.05, 'sine', 0.12); },
  door() { tone(220, 0.06, 'triangle', 0.2, 140); },
  hurt() { tone(200, 0.1, 'sawtooth', 0.16, 90); },
  sting() { tone(392, 0.25, 'triangle', 0.25); setTimeout(() => tone(311, 0.25, 'triangle', 0.25), 200); setTimeout(() => tone(233, 0.5, 'triangle', 0.25), 400); },
  pickup() { tone(523, 0.07, 'sine', 0.2); setTimeout(() => tone(784, 0.1, 'sine', 0.2), 60); },
};

/** Start or update the looping engine and siren for this frame's state. */
export function updateLoops(inCar, speedRatio, stars) {
  if (!ensure()) return;
  if (inCar && !engineNodes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    gain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    osc.connect(filter).connect(gain).connect(master);
    osc.start();
    engineNodes = { osc, gain };
  }
  if (engineNodes) {
    engineNodes.osc.frequency.value = 55 + speedRatio * 165;
    engineNodes.gain.gain.value = inCar ? 0.05 + speedRatio * 0.05 : 0;
    if (!inCar) { engineNodes.osc.stop(); engineNodes = null; }
  }
  if (stars > 0 && !sirenNodes) {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 750;
    lfo.frequency.value = 0.55;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.value = 0.035;
    osc.connect(gain).connect(master);
    osc.start();
    lfo.start();
    sirenNodes = { osc, lfo, gain };
  }
  if (sirenNodes && stars === 0) {
    sirenNodes.osc.stop();
    sirenNodes.lfo.stop();
    sirenNodes = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}
