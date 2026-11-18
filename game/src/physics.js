// Movement collision: circles against the city's solid boxes, its water and
// its edge. Entities call collideCircle after moving and get pushed back out
// the way they came, with a flag for how hard they hit.
import { CITY } from './config.js';
import { inWater } from './city.js';

/**
 * Push a circle at (x, y) with radius r out of every solid. Returns
 * { x, y, hit } where hit is true when anything had to push back.
 */
export function collideCircle(city, x, y, r) {
  let hit = false;
  const min = r + 2;
  const max = CITY.size - r - 2;
  if (x < min) { x = min; hit = true; }
  if (y < min) { y = min; hit = true; }
  if (x > max) { x = max; hit = true; }
  if (y > max) { y = max; hit = true; }

  for (let i = 0; i < city.solids.length; i += 1) {
    const s = city.solids[i];
    const nearX = Math.max(s.x, Math.min(x, s.x + s.w));
    const nearY = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - nearX;
    const dy = y - nearY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = nearX + (dx / d) * r;
      y = nearY + (dy / d) * r;
    } else {
      // Centre inside the box: leave by the nearest face.
      const left = x - s.x;
      const right = s.x + s.w - x;
      const top = y - s.y;
      const bottom = s.y + s.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = s.x - r;
      else if (m === right) x = s.x + s.w + r;
      else if (m === top) y = s.y - r;
      else y = s.y + s.h + r;
    }
  }

  // Water is a wall unless you are on a deck over it.
  if (inWater(city, x, y)) {
    hit = true;
    for (let i = 0; i < city.waters.length; i += 1) {
      const w = city.waters[i];
      if (x < w.x || x > w.x + w.w || y < w.y || y > w.y + w.h) continue;
      const left = x - w.x;
      const right = w.x + w.w - x;
      const top = y - w.y;
      const bottom = w.y + w.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = w.x - r;
      else if (m === right) x = w.x + w.w + r;
      else if (m === top) y = w.y - r;
      else y = w.y + w.h + r;
    }
  }
  return { x, y, hit };
}

/** Distance between two points. */
export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Angle from one point to another. */
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Shortest signed turn from angle a to angle b, in [-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Move an angle toward a target by at most maxStep. */
export function turnToward(angle, target, maxStep) {
  const d = angleDelta(angle, target);
  if (Math.abs(d) <= maxStep) return target;
  return angle + Math.sign(d) * maxStep;
}
