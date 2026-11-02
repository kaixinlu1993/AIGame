import { VIEW_H, VIEW_W, cameraFor, coinCount, createWorld, step } from "./pixel-core.js";
import { LEVELS } from "./pixel-levels.js";

const canvas = document.querySelector("#view");
const ctx = canvas.getContext("2d");
const kickerEl = document.querySelector("#level-kicker");
const coinsEl = document.querySelector("#coins");
const noteEl = document.querySelector("#note");
const cardEl = document.querySelector("#card");
const cardKickerEl = document.querySelector("#card-kicker");
const cardTitleEl = document.querySelector("#card-title");
const cardCopyEl = document.querySelector("#card-copy");
const cardGoEl = document.querySelector("#card-go");

const keys = { left: false, right: false, jump: false };
const held = { left: false, right: false, jump: false };
let jumpQueued = false;
let mode = "title";
let levelIndex = 0;
let bank = 0;
let world = createWorld(LEVELS[0]);
let respawn = 0;
let last = performance.now();
let audio = null;

canvas.width = VIEW_W;
canvas.height = VIEW_H;

for (const button of document.querySelectorAll("[data-hold]")) {
  const name = button.dataset.hold;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    held[name] = true;
    if (name === "jump") jumpQueued = true;
    button.setPointerCapture(event.pointerId);
  });
  const release = () => {
    held[name] = false;
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    keys.left = true;
    event.preventDefault();
  } else if (event.code === "ArrowRight" || event.code === "KeyD") {
    keys.right = true;
    event.preventDefault();
  } else if (event.code === "ArrowUp" || event.code === "Space" || event.code === "KeyK" || event.code === "KeyW") {
    keys.jump = true;
    jumpQueued = true;
    event.preventDefault();
  } else if (event.code === "Enter" && !cardEl.hidden) {
    cardGoEl.click();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = false;
  if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = false;
  if (event.code === "ArrowUp" || event.code === "Space" || event.code === "KeyK" || event.code === "KeyW") keys.jump = false;
});

cardGoEl.addEventListener("click", () => {
  unlock();
  if (mode === "title") {
    mode = "play";
    cardEl.hidden = true;
    return;
  }
  if (levelIndex >= LEVELS.length - 1 && mode === "card") {
    levelIndex = 0;
    bank = 0;
  } else if (mode === "card") {
    levelIndex += 1;
  }
  world = createWorld(LEVELS[levelIndex]);
  mode = "play";
  cardEl.hidden = true;
  paintHud();
});

paintHud();
requestAnimationFrame(frame);

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === "play") play(dt);
  else if (mode === "dead") {
    respawn -= dt;
    if (respawn <= 0) {
      world = createWorld(LEVELS[levelIndex]);
      mode = "play";
      noteEl.textContent = LEVELS[levelIndex].hint;
    }
  }
  drawWorld(world);
  const liveCoins = mode === "play" || mode === "dead" ? bank + coinCount(world) : bank;
  coinsEl.textContent = String(liveCoins);
  requestAnimationFrame(frame);
}

function play(dt) {
  const beforeCoins = coinCount(world);
  const beforeAlive = world.enemies.filter((enemy) => enemy.alive).length;
  const pressed = jumpQueued;
  jumpQueued = false;
  step(world, {
    left: keys.left || held.left,
    right: keys.right || held.right,
    jump: keys.jump || held.jump,
    jumpPressed: pressed,
  }, dt);
  if (coinCount(world) > beforeCoins) beep(880, 0.05, "square", 0.03);
  if (world.enemies.filter((enemy) => enemy.alive).length < beforeAlive) beep(180, 0.08, "square", 0.04);
  if (pressed && world.player.vy < 0) beep(520, 0.04, "square", 0.025);
  if (world.won) {
    bank += coinCount(world);
    mode = "card";
    showClear();
    beep(660, 0.12, "square", 0.04);
    beep(880, 0.14, "square", 0.03);
  } else if (world.dead) {
    mode = "dead";
    respawn = 0.55;
    noteEl.textContent = "掉下去了";
    beep(110, 0.12, "square", 0.04);
  }
}

function showClear() {
  const lastLevel = levelIndex >= LEVELS.length - 1;
  cardEl.hidden = false;
  cardKickerEl.textContent = lastLevel ? "通关" : `第 ${levelIndex + 1} 关`;
  cardTitleEl.textContent = lastLevel ? "三关都送到了" : LEVELS[levelIndex].clear;
  cardCopyEl.textContent = lastLevel
    ? `代币一共 ${bank}。可以再走一遍。`
    : `这一关拿到 ${coinCount(world)} 个代币。`;
  cardGoEl.textContent = lastLevel ? "再玩一次" : "下一关";
  paintHud();
}

function paintHud() {
  const level = LEVELS[levelIndex];
  kickerEl.textContent = `第 ${levelIndex + 1} 关 · ${level.name}`;
  if (mode !== "dead") noteEl.textContent = level.hint;
}

function drawWorld(current) {
  const cam = cameraFor(current);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#241833";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (const [x, y] of [[18, 16], [54, 28], [96, 12], [140, 22], [188, 14], [230, 30], [274, 18], [304, 26]]) {
    ctx.fillStyle = "#f4ecde";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  for (let y = 0; y < current.h; y += 1) {
    for (let x = 0; x < current.w; x += 1) {
      if (!current.solid.has(`${x},${y}`)) continue;
      drawBrick(x * 16, y * 16, !current.solid.has(`${x},${y - 1}`));
    }
  }
  for (const spike of current.spikes) drawSpike(spike);
  for (const platform of current.platforms) drawPlatform(platform);
  for (const coin of current.coins) {
    if (!coin.taken) drawCoin(coin, current.time);
  }
  drawFlag(current.flag, current.time);
  for (const enemy of current.enemies) {
    if (enemy.alive) drawEnemy(enemy, current.time);
  }
  drawPlayer(current.player, current.time);
  ctx.restore();
}

function drawBrick(x, y, top) {
  ctx.fillStyle = "#6b4632";
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = "#8d5a3c";
  ctx.fillRect(x, y + 4, 16, 1);
  ctx.fillRect(x + 8, y, 1, 16);
  if (top) {
    ctx.fillStyle = "#d7c07a";
    ctx.fillRect(x, y, 16, 3);
    ctx.fillStyle = "#8fbe6a";
    ctx.fillRect(x, y, 16, 2);
  }
}

function drawSpike(spike) {
  ctx.fillStyle = "#d5dbe6";
  ctx.fillRect(spike.x + 1, spike.y + 6, 3, 6);
  ctx.fillRect(spike.x + 4, spike.y + 2, 3, 10);
  ctx.fillRect(spike.x + 7, spike.y + 6, 3, 6);
}

function drawPlatform(platform) {
  ctx.fillStyle = "#c9864a";
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  ctx.fillStyle = "#f0c48a";
  ctx.fillRect(platform.x, platform.y, platform.w, 3);
  ctx.fillStyle = "#8a4e28";
  ctx.fillRect(platform.x, platform.y + platform.h - 3, platform.w, 3);
}

function drawCoin(coin, time) {
  const bob = Math.round(Math.sin(time * 5 + coin.x) * 1);
  ctx.fillStyle = "#ffb15a";
  ctx.fillRect(coin.x, coin.y + bob, 8, 8);
  ctx.fillStyle = "#fff1c9";
  ctx.fillRect(coin.x + 2, coin.y + 2 + bob, 2, 2);
}

function drawFlag(flag, time) {
  const wave = Math.round(Math.sin(time * 6) * 1);
  ctx.fillStyle = "#f4ecde";
  ctx.fillRect(flag.x + 2, flag.y, 2, 16);
  ctx.fillStyle = "#e85d4c";
  ctx.fillRect(flag.x + 4, flag.y + 1 + wave, 8, 6);
}

function drawEnemy(enemy, time) {
  const step = Math.floor(time * 6) % 2;
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  ctx.fillStyle = "#c46bba";
  ctx.fillRect(x, y + 2, 12, 8);
  ctx.fillStyle = "#f4ecde";
  ctx.fillRect(x + 2, y + 4, 2, 2);
  ctx.fillRect(x + 8, y + 4, 2, 2);
  ctx.fillStyle = "#241c14";
  ctx.fillRect(x + 2, y + 5, 2, 1);
  ctx.fillRect(x + 8, y + 5, 2, 1);
  ctx.fillStyle = "#8d4e86";
  ctx.fillRect(x + 1, y + 10, 3, 2 + step);
  ctx.fillRect(x + 8, y + 10, 3, 3 - step);
}

function drawPlayer(player, time) {
  const walk = Math.abs(player.vx) > 8 && player.onGround ? Math.floor(time * 10) % 2 : 0;
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const flip = player.facing < 0;
  const px = (localX, width) => (flip ? x + 12 - localX - width : x + localX);
  ctx.fillStyle = "#e85d4c";
  ctx.fillRect(px(2, 8), y + 6, 8, 6);
  ctx.fillStyle = "#f6e39a";
  ctx.fillRect(px(1, 10), y, 10, 8);
  ctx.fillStyle = "#241c14";
  ctx.fillRect(px(3, 2), y + 3, 2, 2);
  ctx.fillRect(px(7, 2), y + 3, 2, 2);
  ctx.fillRect(px(4, 4), y + 6, 4, 1);
  ctx.fillStyle = "#a43328";
  ctx.fillRect(px(2, 3), y + 12, 3, 2 + walk);
  ctx.fillRect(px(7, 3), y + 12, 3, 3 - walk);
}

function unlock() {
  try {
    audio = audio || new AudioContext();
    if (audio.state === "suspended") audio.resume();
  } catch {
    audio = null;
  }
}

function beep(freq, dur, type, gain) {
  if (!audio) return;
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
