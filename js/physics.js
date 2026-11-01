// Pixel / second physics for the jar.
// Same-tier pieces skip the bounce and fuse on contact.
// Everything else is a soft, low-bounce stack so the pile can settle.

import { MAX_TIER, TIERS } from "./config.js";

const GRAVITY = 2500;
const MAX_SPEED = 1400;

export function makeBall(x, y, tier, extra = {}) {
  return {
    x,
    y,
    vx: extra.vx || 0,
    vy: extra.vy || 0,
    r: TIERS[tier].r,
    tier,
    age: 0,
    pop: extra.pop || 0,
    spin: extra.spin || 0,
    seed: extra.seed || 0,
  };
}

// A piece is clogging the context window when it sits in the mouth,
// not while it is still falling out of your hand.
export function isClogging(ball, line) {
  if (ball.y - ball.r >= line) return false;
  if (ball.age < 0.45 && ball.vy > 0) return false;
  const speed = Math.hypot(ball.vx, ball.vy);
  return speed < 110 || ball.age > 1;
}

export function step(balls, dt, bounds) {
  const events = [];
  attract(balls, dt);
  integrate(balls, dt);
  walls(balls, bounds);
  collide(balls, 4);
  const born = fuse(balls, events);
  if (born.length) balls.push(...born);
  collide(balls, 6);
  walls(balls, bounds);
  capSpeed(balls);
  return events;
}

function integrate(balls, dt) {
  const drag = Math.exp(-0.55 * dt);
  for (const ball of balls) {
    ball.vy += GRAVITY * dt;
    ball.vx *= drag;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.spin += ball.vx * dt * 0.005;
    ball.spin *= Math.exp(-1.8 * dt);
    ball.age += dt;
    if (ball.pop > 0) ball.pop = Math.max(0, ball.pop - dt * 2.5);
  }
}

function attract(balls, dt) {
  const reach = 12;
  const accel = 260;
  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const a = balls[i];
      const b = balls[j];
      if (a.tier !== b.tier || a.tier >= MAX_TIER) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const gap = dist - (a.r + b.r);
      if (gap <= 0 || gap > reach) continue;
      const aSpeed = Math.hypot(a.vx, a.vy);
      const bSpeed = Math.hypot(b.vx, b.vy);
      if (aSpeed > 220 && bSpeed > 220) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const pull = accel * dt * (1 - gap / reach);
      a.vx += nx * pull;
      a.vy += ny * pull;
      b.vx -= nx * pull;
      b.vy -= ny * pull;
    }
  }
}

function collide(balls, iterations) {
  for (let n = 0; n < iterations; n += 1) {
    for (let i = 0; i < balls.length; i += 1) {
      for (let j = i + 1; j < balls.length; j += 1) {
        const a = balls[i];
        const b = balls[j];
        if (a.tier === b.tier && a.tier < MAX_TIER) continue;
        separate(a, b);
      }
    }
  }
}

function separate(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (dist === 0) {
    dx = 0.01;
    dy = 0;
    dist = 0.01;
  }
  if (dist >= min) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  const ma = a.r * a.r;
  const mb = b.r * b.r;
  const share = 1 / (ma + mb);
  a.x -= nx * overlap * mb * share;
  a.y -= ny * overlap * mb * share;
  b.x += nx * overlap * ma * share;
  b.y += ny * overlap * ma * share;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const relN = rvx * nx + rvy * ny;
  if (relN >= 0) return;

  const restitution = 0.07;
  const impulse = -(1 + restitution) * relN / (1 / ma + 1 / mb);
  a.vx -= (impulse * nx) / ma;
  a.vy -= (impulse * ny) / ma;
  b.vx += (impulse * nx) / mb;
  b.vy += (impulse * ny) / mb;

  const tx = -ny;
  const ty = nx;
  const relT = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
  const friction = Math.max(-impulse * 0.45, Math.min(impulse * 0.45, -relT / (1 / ma + 1 / mb)));
  a.vx -= (tx * friction) / ma;
  a.vy -= (ty * friction) / ma;
  b.vx += (tx * friction) / mb;
  b.vy += (ty * friction) / mb;
}

function fuse(balls, events) {
  const pairs = [];
  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const a = balls[i];
      const b = balls[j];
      if (a.tier !== b.tier || a.tier >= MAX_TIER) continue;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dist <= a.r + b.r + 0.8) pairs.push({ i, j, dist });
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);

  const used = new Set();
  const born = [];
  for (const pair of pairs) {
    if (used.has(pair.i) || used.has(pair.j)) continue;
    used.add(pair.i);
    used.add(pair.j);
    const a = balls[pair.i];
    const b = balls[pair.j];
    const tier = a.tier + 1;
    const ball = makeBall((a.x + b.x) / 2, (a.y + b.y) / 2, tier, {
      vx: (a.vx + b.vx) * 0.22,
      vy: Math.min(-30, (a.vy + b.vy) * 0.22),
      pop: 1,
      seed: (a.seed + b.seed) * 0.5 + tier,
    });
    born.push(ball);
    events.push({ type: "merge", x: ball.x, y: ball.y, tier });
  }

  if (used.size) {
    const kept = balls.filter((_, index) => !used.has(index));
    balls.length = 0;
    balls.push(...kept);
  }
  return born;
}

function walls(balls, bounds) {
  for (const ball of balls) {
    if (ball.x < bounds.left + ball.r) {
      ball.x = bounds.left + ball.r;
      if (ball.vx < 0) ball.vx *= -0.18;
    } else if (ball.x > bounds.right - ball.r) {
      ball.x = bounds.right - ball.r;
      if (ball.vx > 0) ball.vx *= -0.18;
    }
    if (ball.y > bounds.bottom - ball.r) {
      ball.y = bounds.bottom - ball.r;
      if (ball.vy > 0) ball.vy *= -0.1;
      if (Math.abs(ball.vy) < 50) ball.vy = 0;
      ball.vx *= 0.78;
    }
  }
}

function capSpeed(balls) {
  for (const ball of balls) {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }
    if (!Number.isFinite(ball.x)) ball.x = 0;
    if (!Number.isFinite(ball.y)) ball.y = 0;
    if (!Number.isFinite(ball.vx)) ball.vx = 0;
    if (!Number.isFinite(ball.vy)) ball.vy = 0;
  }
}
