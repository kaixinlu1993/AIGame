import {
  SIDES,
  describeDraw,
  formatRemain,
  placeBet,
  refill,
  resume,
  stakeTotal,
  tagLabel,
} from "./guess-core.js";

const KEY = "caidaxiao.wallet";

const coinsEl = document.querySelector("#coins");
const clockEl = document.querySelector("#clock");
const stageLabelEl = document.querySelector("#stage-label");
const diceEl = document.querySelector("#dice");
const sumEl = document.querySelector("#sum");
const bannerEl = document.querySelector("#banner");
const liveEl = document.querySelector("#live");
const betsEl = document.querySelector("#bets");
const refillEl = document.querySelector("#refill");
const historyEl = document.querySelector("#history");
const faces = [...diceEl.children];
const stakeEls = Object.fromEntries(SIDES.map((side) => [side.id, document.querySelector(`[data-stake="${side.id}"]`)]));

let resumed = resume(readRaw(), Date.now());
let state = resumed.state;
let banner = resumed.event ? describeDraw(resumed.event, state.coins) : "选一边，送出一个爱心。";
let historyKey = null;
save(state);

betsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-side]");
  if (!button) return;
  const now = Date.now();
  const placed = placeBet(state, button.dataset.side, now);
  state = placed.state;
  if (placed.event) showDraw(placed.event);
  if (!placed.ok && placed.reason === "broke") {
    banner = placed.event ? `${banner}币不够再押了。` : "币不够了。";
    liveEl.textContent = banner;
  }
  if (placed.ok) {
    button.classList.remove("pop");
    void button.offsetWidth;
    button.classList.add("pop");
  }
  save(state);
  render(now);
});

refillEl.addEventListener("click", () => {
  state = refill(state);
  if (state.coins > 0) {
    banner = "又领了 10 个币。";
    liveEl.textContent = banner;
  }
  save(state);
  render(Date.now());
});

window.setInterval(() => {
  const now = Date.now();
  const stepped = resume(state, now);
  if (stepped.event) {
    state = stepped.state;
    showDraw(stepped.event);
    save(state);
  }
  render(now);
}, 200);

render(Date.now());

function showDraw(event) {
  banner = describeDraw(event, state.coins);
  liveEl.textContent = banner;
}

function render(now) {
  coinsEl.textContent = String(state.coins);
  clockEl.textContent = formatRemain(state.round.endsAt - now);
  const latest = state.history[0];
  if (latest) {
    stageLabelEl.textContent = "上期开奖";
    faces.forEach((face, index) => {
      face.textContent = String(latest.nums[index]);
    });
    sumEl.textContent = `和 ${latest.sum} · ${latest.tags.map(tagLabel).join(" · ")}`;
  } else {
    stageLabelEl.textContent = "等待开奖";
    faces.forEach((face) => {
      face.textContent = "?";
    });
    sumEl.textContent = "三个 1 到 6 的数字，加起来再看结果";
  }
  bannerEl.textContent = banner;
  for (const side of SIDES) {
    const count = state.round.stakes[side.id];
    stakeEls[side.id].textContent = count > 0 ? `♥ ${count}` : "送爱心";
  }
  const broke = state.coins < 1;
  for (const button of betsEl.querySelectorAll("button")) button.disabled = broke;
  const waiting = stakeTotal(state.round.stakes) > 0;
  refillEl.hidden = state.coins > 0 || waiting;
  const key = state.history.map((entry) => `${entry.nums.join("")}:${entry.returned}`).join("|");
  if (key !== historyKey) {
    historyKey = key;
    renderHistory(state.history);
  }
}

function renderHistory(entries) {
  historyEl.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "还没有开奖。这局结束就会记在这里。";
    historyEl.append(empty);
    return;
  }
  for (const entry of entries) {
    const row = document.createElement("li");
    const nums = document.createElement("span");
    nums.className = "hist-nums";
    nums.textContent = entry.nums.join("  ");
    const result = document.createElement("span");
    result.className = "hist-result";
    result.textContent = `${entry.sum} · ${entry.tags.map(tagLabel).join(" · ")}`;
    row.append(nums, result);
    if (entry.returned > 0) {
      const won = document.createElement("span");
      won.className = "hist-won";
      won.textContent = `拿回 ${entry.returned}`;
      row.append(won);
    }
    historyEl.append(row);
  }
}

function readRaw() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

function save(next) {
  localStorage.setItem(KEY, JSON.stringify(next));
}
