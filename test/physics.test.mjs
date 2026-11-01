import assert from "node:assert/strict";
import test from "node:test";
import { MAX_TIER, TIERS, boast, mergeScore, metrics, rankProgress } from "../js/config.js";
import { isClogging, makeBall, step } from "../js/physics.js";

const DT = 1 / 120;

function settle(balls, bounds, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) step(balls, DT, bounds);
}

test("two touching copies fuse into the next model", () => {
  const bounds = { left: 0, right: 400, bottom: 600 };
  const balls = [makeBall(100, 100, 0), makeBall(120, 100, 0)];
  const events = step(balls, DT, bounds);
  assert.equal(events.length, 1);
  assert.equal(events[0].tier, 1);
  assert.equal(balls.length, 1);
  assert.equal(balls[0].tier, 1);
  assert.equal(balls[0].r, TIERS[1].r);
});

test("different models bounce instead of fusing", () => {
  const bounds = { left: 0, right: 400, bottom: 600 };
  const balls = [makeBall(100, 80, 0), makeBall(110, 80, 2)];
  settle(balls, bounds, 0.4);
  assert.equal(balls.length, 2);
  assert.deepEqual(balls.map((ball) => ball.tier).sort(), [0, 2]);
  const dist = Math.hypot(balls[0].x - balls[1].x, balls[0].y - balls[1].y);
  assert.ok(dist >= balls[0].r + balls[1].r - 1.5);
});

test("a singularity does not fuse with another singularity", () => {
  const bounds = { left: 0, right: 800, bottom: 800 };
  const balls = [makeBall(200, 200, MAX_TIER), makeBall(300, 200, MAX_TIER)];
  settle(balls, bounds, 0.5);
  assert.equal(balls.length, 2);
  assert.ok(balls.every((ball) => ball.tier === MAX_TIER));
});

test("a chain of four copies becomes two of the next tier in one step", () => {
  const bounds = { left: -200, right: 600, bottom: 600 };
  const balls = [0, 1, 2, 3].map((i) => makeBall(i * 10, 120, 0));
  step(balls, DT, bounds);
  assert.equal(balls.length, 2);
  assert.ok(balls.every((ball) => ball.tier === 1));
});

test("a dropped model lands inside the jar and settles", () => {
  const bounds = metrics();
  const balls = [makeBall((bounds.left + bounds.right) / 2, bounds.line, 0, { vy: 40 })];
  settle(balls, bounds, 3);
  const ball = balls[0];
  assert.ok(ball.y <= bounds.bottom - ball.r + 0.2);
  assert.ok(ball.x >= bounds.left + ball.r - 0.2);
  assert.ok(ball.x <= bounds.right - ball.r + 0.2);
  assert.ok(Math.hypot(ball.vx, ball.vy) < 80);
  assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y));
});

test("a messy jar stays finite and inside the walls", () => {
  const bounds = metrics();
  const balls = [];
  let merges = 0;
  for (let n = 0; n < 360; n += 1) {
    if (n % 18 === 0) {
      const tier = n % 3;
      const r = TIERS[tier].r;
      const x = bounds.left + r + ((n * 47) % Math.max(1, bounds.right - bounds.left - r * 2));
      balls.push(makeBall(x, bounds.line - r, tier, { vy: 30, seed: n }));
    }
    merges += step(balls, DT, bounds).length;
    for (const ball of balls) {
      assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y));
      assert.ok(ball.x >= bounds.left + ball.r - 1);
      assert.ok(ball.x <= bounds.right - ball.r + 1);
      assert.ok(ball.y <= bounds.bottom - ball.r + 1);
      assert.ok(ball.tier >= 0 && ball.tier <= MAX_TIER);
    }
  }
  assert.ok(merges > 3);
});

test("falling through the mouth is not a clog, resting there is", () => {
  const line = 100;
  const falling = makeBall(50, 70, 0, { vy: 80 });
  assert.equal(isClogging(falling, line), false);
  const resting = makeBall(50, 70, 0);
  resting.age = 1.2;
  assert.equal(isClogging(resting, line), true);
  const safe = makeBall(50, 200, 0);
  safe.age = 5;
  assert.equal(isClogging(safe, line), false);
});

test("score and rank climb, and the boast stays a string", () => {
  assert.equal(mergeScore(1, 1), 35);
  assert.equal(mergeScore(2, 2), 100);
  assert.ok(mergeScore(MAX_TIER, 1) > mergeScore(MAX_TIER - 1, 1) + 3000);
  assert.equal(rankProgress(0).current, "地下室服务器");
  assert.equal(rankProgress(80).current, "会说人话了");
  assert.equal(rankProgress(80).remaining, 220);
  const done = rankProgress(999999);
  assert.equal(done.next, null);
  assert.equal(done.p, 1);
  const line = boast(1280, "幻觉精", 12);
  assert.equal(typeof line, "string");
  assert.ok(line.length > 8);
});
