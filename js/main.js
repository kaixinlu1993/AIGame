import {
  DROP_BAG,
  OVERFLOW_LIMIT,
  TIERS,
  WORLD,
  boast,
  formatScore,
  mergeScore,
  metrics,
  rankProgress,
} from "./config.js";
import { isClogging, makeBall, step } from "./physics.js";
import { drawBall, drawFrame } from "./render.js";
import { createSfx } from "./sfx.js";

const BEST_KEY = "hecheng.best";
const MUTE_KEY = "hecheng.mute";
const DROP_COOLDOWN = 0.34;

const canvas = document.querySelector("#game");
const preview = document.querySelector("#preview");
const board = document.querySelector(".board");
const overlay = document.querySelector("#overlay");
const titleCard = document.querySelector("#title-card");
const overCard = document.querySelector("#over-card");
const startBtn = document.querySelector("#start");
const againBtn = document.querySelector("#again");
const muteBtn = document.querySelector("#mute");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const comboEl = document.querySelector("#combo");
const strongestEl = document.querySelector("#strongest");
const rankNameEl = document.querySelector("#rank-name");
const rankNextEl = document.querySelector("#rank-next");
const rankFillEl = document.querySelector("#rank-fill");
const nextNameEl = document.querySelector("#next-name");
const nextSayEl = document.querySelector("#next-say");
const afterEl = document.querySelector("#after");
const boastEl = document.querySelector("#boast");
const finalScoreEl = document.querySelector("#final-score");
const finalTierEl = document.querySelector("#final-tier");
const finalMergesEl = document.querySelector("#final-merges");
const finalComboEl = document.querySelector("#final-combo");
const bestNoteEl = document.querySelector("#best-note");
const sealEl = document.querySelector("#seal");
const titleBestEl = document.querySelector("#title-best");
const liveEl = document.querySelector("#live");

const ctx = canvas.getContext("2d");
const previewCtx = preview.getContext("2d");
const sfx = createSfx();
const jar = metrics();

const state = {
  mode: "title",
  balls: [],
  particles: [],
  floaters: [],
  queue: [0, 1, 2],
  bag: [],
  aimX: WORLD.width / 2,
  targetX: WORLD.width / 2,
  aiming: false,
  wantDrop: false,
  spaceHeld: false,
  keyL: false,
  keyR: false,
  cooldown: 0,
  score: 0,
  best: loadNumber(BEST_KEY),
  bestAtStart: loadNumber(BEST_KEY),
  combo: 0,
  comboTimer: 0,
  maxCombo: 0,
  merges: 0,
  biggest: -1,
  overflow: 0,
  overflowLimit: OVERFLOW_LIMIT,
  slow: 0,
  drops: 0,
  demo: 0.4,
  rank: rankProgress(0).index,
  mute: localStorage.getItem(MUTE_KEY) === "1",
  metrics: jar,
  held: null,
};

const hud = { score: -1, best: -1, strongest: "", rank: "", next: "" };
let last = performance.now();
let acc = 0;
let fitted = "";

sfx.setMuted(state.mute);
paintMute();
seedDemo();
fit();
updateHud(true);
requestAnimationFrame(frame);

window.addEventListener("resize", fit);
if (window.ResizeObserver) new ResizeObserver(fit).observe(board);

startBtn.addEventListener("click", () => {
  unlock();
  startGame();
});
againBtn.addEventListener("click", () => {
  unlock();
  startGame();
});
muteBtn.addEventListener("click", () => {
  state.mute = !state.mute;
  sfx.setMuted(state.mute);
  localStorage.setItem(MUTE_KEY, state.mute ? "1" : "0");
  paintMute();
});

board.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  if (isUi(event)) return;
  unlock();
  state.aiming = true;
  aimFromEvent(event);
});

window.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse" || state.aiming) aimFromEvent(event);
});

window.addEventListener("pointerup", (event) => {
  if (event.button !== 0) return;
  if (isUi(event)) {
    state.aiming = false;
    return;
  }
  const onBoard = event.target.closest && event.target.closest(".board");
  if (!onBoard && !state.aiming) return;
  unlock();
  aimFromEvent(event);
  if (state.mode === "title") {
    state.aiming = false;
    startGame();
    state.wantDrop = true;
    return;
  }
  if (state.mode === "play" && state.aiming) {
    state.aiming = false;
    state.wantDrop = true;
  }
});

board.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    event.preventDefault();
    state.keyL = true;
  } else if (event.code === "ArrowRight" || event.code === "KeyD") {
    event.preventDefault();
    state.keyR = true;
  } else if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    if (state.mode !== "play") {
      if (event.repeat) return;
      unlock();
      startGame();
      if (event.code === "Space") state.wantDrop = true;
      return;
    }
    if (event.code === "Space") state.spaceHeld = true;
    if (event.code === "Enter" && !event.repeat) state.wantDrop = true;
  } else if (event.code === "KeyM" && !event.repeat) {
    muteBtn.click();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") state.keyL = false;
  if (event.code === "ArrowRight" || event.code === "KeyD") state.keyR = false;
  if (event.code === "Space") state.spaceHeld = false;
});

function frame(now) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!document.hidden) {
    const scale = state.slow > 0 ? 0.42 : 1;
    state.slow = Math.max(0, state.slow - real);
    acc += real * scale;
    const stepDt = 1 / 120;
    while (acc >= stepDt) {
      tick(stepDt);
      acc -= stepDt;
    }
    steer(real);
    updateHud(false);
    drawFrame(ctx, state, now / 1000);
    drawPreview(now / 1000);
  }
  requestAnimationFrame(frame);
}

function tick(dt) {
  state.cooldown = Math.max(0, state.cooldown - dt);
  if (state.mode === "play" && (state.wantDrop || state.spaceHeld) && state.cooldown <= 0) {
    drop();
    state.wantDrop = false;
  }
  if (state.mode === "title") runDemo(dt);

  const events = step(state.balls, dt, state.metrics);
  if (events.length) onMerges(events);
  updateJuice(dt);
  if (state.mode === "play") watchOverflow(dt);
  else if (state.mode === "title") watchDemo();
}

function steer(dt) {
  if (state.keyL) state.targetX -= 340 * dt;
  if (state.keyR) state.targetX += 340 * dt;
  const k = 1 - Math.exp(-22 * dt);
  state.aimX += (state.targetX - state.aimX) * k;
  state.held = state.mode === "play" ? heldPose() : null;
}

function heldPose() {
  const tier = state.queue[0];
  const r = TIERS[tier].r;
  const x = clamp(state.aimX, state.metrics.left + r, state.metrics.right - r);
  return {
    tier,
    r,
    x,
    y: state.metrics.line - 18 - r,
    ready: state.cooldown <= 0,
  };
}

function drop() {
  const pose = heldPose();
  const tier = state.queue.shift();
  state.queue.push(pullTier());
  const ball = makeBall(pose.x, pose.y, tier, { vy: 80, pop: 0.4, seed: Math.random() * 10 });
  state.balls.push(ball);
  state.drops += 1;
  state.cooldown = DROP_COOLDOWN;
  noteBiggest(tier);
  sfx.drop();
  if (navigator.vibrate) navigator.vibrate(8);
}

function onMerges(events) {
  let loudest = events[0];
  for (const event of events) {
    burst(event.x, event.y, TIERS[event.tier].color, event.tier >= 8 ? 26 : 12);
    if (event.tier > loudest.tier) loudest = event;
    if (state.mode !== "play") continue;

    state.combo = state.comboTimer > 0 ? Math.min(9, state.combo + 1) : 1;
    state.comboTimer = 1.15;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.merges += 1;
    const gained = mergeScore(event.tier, state.combo);
    state.score += gained;
    noteBiggest(event.tier);
    const label = event.tier >= 3
      ? `${TIERS[event.tier].short} +${formatScore(gained)}`
      : `+${formatScore(gained)}`;
    float(label, event.x + (event.tier % 2 === 0 ? -14 : 14), event.y - 30, TIERS[event.tier].color);
    if (event.tier >= TIERS.length - 1) {
      state.slow = Math.max(state.slow, 1.35);
      sfx.jackpot();
      if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
    }
    const progress = rankProgress(state.score);
    if (progress.index > state.rank) {
      state.rank = progress.index;
      float(`职称：${progress.current}`, state.metrics.jar.x + state.metrics.jar.w / 2, state.metrics.line + 36, "#ffe08a");
      sfx.rank();
      liveEl.textContent = `职称变成${progress.current}，得分 ${formatScore(state.score)}`;
    }
  }
  if (state.mode === "play" && loudest.tier < TIERS.length - 1) sfx.merge(loudest.tier, events.length);
}

function watchOverflow(dt) {
  let danger = false;
  for (const ball of state.balls) {
    if (isClogging(ball, state.metrics.line)) danger = true;
  }
  if (danger) state.overflow += dt;
  else state.overflow = Math.max(0, state.overflow - dt * 0.7);
  if (state.overflow >= OVERFLOW_LIMIT) endGame();
}

function endGame() {
  if (state.mode !== "play") return;
  state.mode = "over";
  state.wantDrop = false;
  state.spaceHeld = false;
  board.classList.remove("is-playing");
  const biggest = state.biggest >= 0 ? TIERS[state.biggest].name : "一堆分词器";
  boastEl.textContent = boast(state.score, biggest, state.merges);
  finalScoreEl.textContent = formatScore(state.score);
  finalTierEl.textContent = biggest;
  finalMergesEl.textContent = String(state.merges);
  finalComboEl.textContent = `×${Math.max(1, state.maxCombo)}`;
  const isNew = state.score > state.bestAtStart;
  if (state.score > state.best) state.best = state.score;
  persistBest();
  sealEl.hidden = !isNew;
  bestNoteEl.textContent = isNew
    ? "新高写进这块浏览器的小本本了。"
    : `这块浏览器记得的最高分是 ${formatScore(state.best)}。`;
  titleCard.hidden = true;
  overCard.hidden = false;
  overlay.hidden = false;
  sfx.over();
  liveEl.textContent = `上下文满了。得分 ${formatScore(state.score)}。${boastEl.textContent}`;
  againBtn.focus();
}

function startGame() {
  state.mode = "play";
  state.balls = [];
  state.particles = [];
  state.floaters = [];
  state.score = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.maxCombo = 0;
  state.merges = 0;
  state.biggest = -1;
  state.overflow = 0;
  state.slow = 0;
  state.drops = 0;
  state.cooldown = 0;
  state.wantDrop = false;
  state.rank = rankProgress(0).index;
  state.bestAtStart = state.best;
  state.bag = [];
  state.queue = [pullTier(), pullTier(), pullTier()];
  board.classList.add("is-playing");
  overlay.hidden = true;
  titleCard.hidden = true;
  overCard.hidden = true;
  updateHud(true);
}

function runDemo(dt) {
  state.demo -= dt;
  if (state.demo > 0) return;
  state.demo = 0.9;
  const tier = [0, 0, 0, 1, 1, 2][(Math.random() * 6) | 0];
  const r = TIERS[tier].r;
  const span = state.metrics.right - state.metrics.left - r * 2;
  const ball = makeBall(state.metrics.left + r + Math.random() * span, state.metrics.line - 18 - r, tier, {
    vy: 40,
    seed: Math.random() * 10,
  });
  state.balls.push(ball);
}

function watchDemo() {
  let crowded = state.balls.length > 14;
  for (const ball of state.balls) {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (ball.y - ball.r < state.metrics.line && speed < 40 && ball.age > 0.8) crowded = true;
  }
  if (crowded) seedDemo();
}

function seedDemo() {
  state.balls = [];
  state.particles = [];
  state.floaters = [];
  state.overflow = 0;
  const spots = [0, 1, 0, 2, 1, 0, 1, 3, 0];
  spots.forEach((tier, index) => {
    const r = TIERS[tier].r;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const gap = (state.metrics.right - state.metrics.left) / 3;
    const ball = makeBall(state.metrics.left + gap * (col + 0.5), state.metrics.bottom - r - 6 - row * 58, tier, {
      seed: index + 1,
    });
    state.balls.push(ball);
  });
}

function updateJuice(dt) {
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer === 0) state.combo = 0;
  for (const bit of state.particles) {
    bit.age += dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.vy += 700 * dt;
  }
  state.particles = state.particles.filter((bit) => bit.age < bit.life);
  for (const note of state.floaters) {
    note.age += dt;
    note.y -= 32 * dt;
  }
  state.floaters = state.floaters.filter((note) => note.age < note.life);
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 180;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.35 + Math.random() * 0.35,
      age: 0,
      color,
      r: 2 + Math.random() * 3,
    });
  }
  if (state.particles.length > 180) state.particles.splice(0, state.particles.length - 180);
}

function float(text, x, y, color) {
  state.floaters.push({ text, x, y, life: 0.85, age: 0, color });
  if (state.floaters.length > 3) state.floaters.shift();
}

function noteBiggest(tier) {
  if (tier > state.biggest) state.biggest = tier;
}

function pullTier() {
  if (!state.bag.length) state.bag = shuffle(DROP_BAG);
  return state.bag.pop();
}

function updateHud(force) {
  if (state.mode === "play" && state.score > state.best) {
    state.best = state.score;
    persistBest();
  }
  if (force || hud.score !== state.score) {
    if (!force && hud.score !== -1 && state.score !== hud.score) bump(scoreEl);
    hud.score = state.score;
    scoreEl.textContent = formatScore(state.score);
  }
  if (force || hud.best !== state.best) {
    hud.best = state.best;
    const text = state.best > 0 ? formatScore(state.best) : "—";
    bestEl.textContent = text;
    titleBestEl.textContent = state.best > 0 ? `最高 ${text}` : "还没有最高分";
  }
  const strong = state.biggest >= 0 ? TIERS[state.biggest].name : "还没有";
  if (force || hud.strongest !== strong) {
    hud.strongest = strong;
    strongestEl.textContent = strong;
  }
  const progress = rankProgress(state.score);
  const rankKey = `${progress.current}:${progress.remaining}`;
  if (force || hud.rank !== rankKey) {
    hud.rank = rankKey;
    rankNameEl.textContent = progress.current;
    rankNextEl.textContent = progress.next ? `距「${progress.next}」还差 ${formatScore(progress.remaining)}` : "职称已封顶";
    rankFillEl.style.width = `${Math.round(progress.p * 100)}%`;
  }
  const comboOn = state.mode === "play" && state.combo >= 2;
  comboEl.classList.toggle("is-on", comboOn);
  comboEl.textContent = comboOn ? `涌现 ×${state.combo}` : "";
  const upcoming = state.mode === "play" ? state.queue[0] : 0;
  const upcomingName = state.mode === "play" ? TIERS[upcoming].name : state.mode === "title" ? "演示中" : "结束";
  if (force || hud.next !== `${state.mode}:${upcomingName}:${state.queue.join(",")}`) {
    hud.next = `${state.mode}:${upcomingName}:${state.queue.join(",")}`;
    nextNameEl.textContent = upcomingName;
    nextSayEl.textContent = state.mode === "play" ? TIERS[upcoming].say : "两个一样的，合成一个更会吹的";
    const after = state.mode === "play" ? state.queue[1] : 1;
    afterEl.style.background = TIERS[after].color;
    afterEl.style.color = TIERS[after].ink;
    afterEl.textContent = TIERS[after].short;
  }
}

function drawPreview(time) {
  const tier = state.mode === "play" ? state.queue[0] : 2;
  const size = 76;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (preview.width !== Math.round(size * dpr)) {
    preview.width = Math.round(size * dpr);
    preview.height = Math.round(size * dpr);
  }
  previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  previewCtx.clearRect(0, 0, size, size);
  drawBall(previewCtx, size / 2, size / 2 + 2, 30, tier, time, 0, 0, 2);
}

function fit() {
  const rect = board.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const scale = Math.min(rect.width / WORLD.width, rect.height / WORLD.height);
  const cssW = Math.max(1, Math.floor(WORLD.width * scale));
  const cssH = Math.max(1, Math.floor(WORLD.height * scale));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const key = `${cssW}x${cssH}x${dpr}`;
  if (key === fitted) return;
  fitted = key;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform((cssW * dpr) / WORLD.width, 0, 0, (cssH * dpr) / WORLD.height, 0, 0);
}

let viewportH = 0;
let viewportW = 0;

function syncViewport(force) {
  const vv = window.visualViewport;
  const nextH = Math.round(vv?.height || window.innerHeight);
  const nextW = Math.round(vv?.width || window.innerWidth);
  const widthChanged = viewportW && Math.abs(nextW - viewportW) >= 2;
  const heightDelta = viewportH ? Math.abs(nextH - viewportH) : Infinity;
  // Phone browser chrome shows and hides by well under 160px and does not
  // change the width. Follow real window resizes; ignore that chrome jitter.
  if (!force && viewportH && !widthChanged && heightDelta < 160) return;
  if (nextH === viewportH && nextW === viewportW) return;
  viewportH = nextH;
  viewportW = nextW;
  document.documentElement.style.setProperty("--app-h", `${nextH}px`);
  requestAnimationFrame(fit);
}

syncViewport(true);
window.addEventListener("resize", () => syncViewport(false));
window.visualViewport?.addEventListener("resize", () => syncViewport(false));
window.addEventListener("orientationchange", () => syncViewport(true));

function aimFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const x = ((event.clientX - rect.left) / rect.width) * WORLD.width;
  if (Number.isFinite(x)) state.targetX = x;
}

function paintMute() {
  muteBtn.setAttribute("aria-pressed", String(state.mute));
  muteBtn.textContent = state.mute ? "静" : "声";
  muteBtn.setAttribute("aria-label", state.mute ? "打开声音" : "关闭声音");
}

function persistBest() {
  try {
    localStorage.setItem(BEST_KEY, String(state.best));
  } catch {
    // Private mode can refuse storage. The run still counts.
  }
}

function loadNumber(key) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : 0;
}

function unlock() {
  sfx.unlock();
}

function isUi(event) {
  return Boolean(event.target.closest && event.target.closest("button, .card"));
}

function bump(el) {
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = (Math.random() * (i + 1)) | 0;
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
