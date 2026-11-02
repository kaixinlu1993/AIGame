import assert from "node:assert/strict";
import test from "node:test";
import { coinCount, createWorld, solidAt, step } from "../js/pixel-core.js";
import { LEVELS } from "../js/pixel-levels.js";

const idle = { left: false, right: false, jump: false, jumpPressed: false };

function settle(world, frames = 40) {
  for (let i = 0; i < frames; i += 1) step(world, idle, 1 / 60);
  return world;
}

function makeBot() {
  let hold = 0;
  return (world) => {
    const player = world.player;
    if (world.rideId != null) {
      const platform = world.platforms[world.rideId];
      const docked = platform.x >= platform.maxX - 2;
      const nearFront = player.x + player.w > platform.x + platform.w - 8;
      hold = 0;
      return { left: false, right: docked || !nearFront, jump: false, jumpPressed: false };
    }
    const floorY = player.y + player.h + 4;
    const aheadX = player.x + player.w + 12;
    const platformThere = world.platforms.some((platform) => (
      platform.x < aheadX && aheadX < platform.x + platform.w && Math.abs(platform.y - (player.y + player.h)) < 10
    ));
    const pit = !solidAt(world.solid, aheadX, floorY) && !platformThere;
    const waiting = world.platforms.find((platform) => Math.abs(platform.y - (player.y + player.h)) < 10 && platform.maxX > player.x);
    if (pit && waiting && player.x + player.w > waiting.minX - 20) {
      const ready = waiting.x <= waiting.minX + 2;
      return { left: false, right: ready, jump: false, jumpPressed: false };
    }
    const wall = solidAt(world.solid, player.x + player.w + 2, player.y + 4);
    const spike = world.spikes.some((item) => item.x < player.x + player.w + 30 && item.x + item.w > player.x && item.y < player.y + player.h + 20);
    const enemy = world.enemies.some((item) => item.alive && item.x < player.x + player.w + 28 && item.x + item.w > player.x && Math.abs(item.y - player.y) < 22);
    const need = player.onGround && (pit || wall || spike || enemy);
    let pressed = false;
    if (need && hold <= 0) {
      hold = 0.34;
      pressed = true;
    }
    hold = Math.max(0, hold - 1 / 60);
    return { left: false, right: true, jump: hold > 0, jumpPressed: pressed };
  };
}

test("a runner lands, picks up a coin, and reaches the flag", () => {
  const world = settle(createWorld({
    name: "flat",
    rows: ["P..o..F", "#######"],
  }));
  assert.equal(world.player.onGround, true);
  for (let i = 0; i < 180 && !world.won && !world.dead; i += 1) {
    step(world, { left: false, right: true, jump: false, jumpPressed: false }, 1 / 60);
  }
  assert.equal(world.dead, false);
  assert.equal(world.won, true);
  assert.equal(coinCount(world), 1);
});

test("full jump clears a gap and a tap does not", () => {
  const world = settle(createWorld({
    name: "gap",
    rows: ["P......F", "###..###", "###..###"],
  }));
  const start = world.player.y;
  let peak = start;
  for (let i = 0; i < 40; i += 1) {
    step(world, { left: false, right: false, jump: true, jumpPressed: i === 0 }, 1 / 60);
    peak = Math.min(peak, world.player.y);
  }
  assert.ok(start - peak > 48, `jump rose ${start - peak}`);

  const short = settle(createWorld({
    name: "gap",
    rows: ["P......F", "###..###", "###..###"],
  }));
  const shortStart = short.player.y;
  let shortPeak = shortStart;
  for (let i = 0; i < 40; i += 1) {
    step(short, { left: false, right: false, jump: false, jumpPressed: i === 0 }, 1 / 60);
    shortPeak = Math.min(shortPeak, short.player.y);
  }
  assert.ok(shortStart - shortPeak < 36, `short hop rose ${shortStart - shortPeak}`);
  for (let i = 0; i < 240 && !short.won && !short.dead; i += 1) {
    step(short, { left: false, right: true, jump: false, jumpPressed: false }, 1 / 60);
  }
  assert.equal(short.dead, true);
});

test("spikes, walls, and a stomp behave", () => {
  const spiked = settle(createWorld({
    name: "spike",
    rows: ["P...F", "##^##"],
  }));
  for (let i = 0; i < 90 && !spiked.dead; i += 1) step(spiked, { left: false, right: true, jump: false, jumpPressed: false }, 1 / 60);
  assert.equal(spiked.dead, true);

  const walled = settle(createWorld({
    name: "wall",
    rows: ["P#..F", "#####"],
  }));
  const before = walled.player.x;
  for (let i = 0; i < 30; i += 1) step(walled, { left: false, right: true, jump: false, jumpPressed: false }, 1 / 60);
  assert.ok(walled.player.x <= before + 2);
  assert.equal(walled.player.x + walled.player.w <= 16, true);

  const stomp = createWorld({
    name: "bug",
    rows: ["P.E.F", "#####"],
  });
  settle(stomp);
  stomp.player.x = stomp.enemies[0].x - 2;
  stomp.player.y = stomp.enemies[0].y - 8;
  stomp.player.vy = 160;
  stomp.player.onGround = false;
  step(stomp, idle, 1 / 60);
  assert.equal(stomp.enemies[0].alive, false);
  assert.ok(stomp.player.vy < 0);
  assert.equal(stomp.dead, false);
});

test("a moving floor docks against the far side and can be ridden", () => {
  const world = createWorld(LEVELS[2]);
  assert.equal(world.platforms.length, 1);
  const platform = world.platforms[0];
  assert.ok(platform.maxX > platform.minX);
  assert.equal(platform.maxX + platform.w, 22 * 16);
  world.player.x = platform.x + 4;
  world.player.y = platform.y - world.player.h;
  world.player.vy = 20;
  step(world, idle, 1 / 60);
  assert.equal(world.rideId, 0);
  const x = world.player.x;
  step(world, idle, 0.2);
  assert.ok(world.player.x > x);
  assert.equal(world.dead, false);
});

test("all three levels can be cleared by jumping the gaps", () => {
  for (const level of LEVELS) {
    const world = settle(createWorld(level));
    const brain = makeBot();
    for (let i = 0; i < 60 * 50 && !world.won && !world.dead; i += 1) step(world, brain(world), 1 / 60);
    assert.equal(world.dead, false, `${level.name} died at ${world.player.x},${world.player.y}`);
    assert.equal(world.won, true, `${level.name} did not finish, at ${world.player.x},${world.player.y}`);
  }
});
