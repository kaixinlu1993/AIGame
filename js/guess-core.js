export const ROUND_MS = 10 * 60 * 1000;
export const STARTING_COINS = 10;
export const HISTORY_LIMIT = 20;

export const SIDES = [
  { id: "da", label: "大", odds: 2, hint: "和 ≥ 11" },
  { id: "xiao", label: "小", odds: 2, hint: "和 ≤ 10" },
  { id: "dan", label: "单", odds: 2, hint: "和是奇数" },
  { id: "shuang", label: "双", odds: 2, hint: "和是偶数" },
  { id: "baozi", label: "豹子", odds: 10, hint: "三个相同" },
];

const SIDE_IDS = new Set(SIDES.map((side) => side.id));

export function emptyStakes() {
  return { da: 0, xiao: 0, dan: 0, shuang: 0, baozi: 0 };
}

export function stakeTotal(stakes) {
  return SIDES.reduce((sum, side) => sum + (stakes?.[side.id] || 0), 0);
}

export function die(random) {
  const n = Math.floor(Number(random()) * 6) + 1;
  if (n < 1) return 1;
  if (n > 6) return 6;
  return n;
}

export function classify(nums) {
  const clean = nums.map((n) => Math.round(Number(n)));
  const sum = clean[0] + clean[1] + clean[2];
  const tags = [];
  if (clean[0] === clean[1] && clean[1] === clean[2]) tags.push("baozi");
  tags.push(sum >= 11 ? "da" : "xiao");
  tags.push(sum % 2 === 0 ? "shuang" : "dan");
  return { nums: clean, sum, tags };
}

export function tagLabel(id) {
  return SIDES.find((side) => side.id === id)?.label || id;
}

export function payout(stakes, tags) {
  const hits = [];
  let returned = 0;
  for (const side of SIDES) {
    const stake = stakes?.[side.id] || 0;
    if (stake > 0 && tags.includes(side.id)) {
      const got = stake * side.odds;
      returned += got;
      hits.push({ id: side.id, label: side.label, stake, returned: got });
    }
  }
  return { returned, hits };
}

export function createRound(now, random = Math.random) {
  return {
    endsAt: now + ROUND_MS,
    secret: [die(random), die(random), die(random)],
    stakes: emptyStakes(),
  };
}

export function freshState(now, random = Math.random) {
  return {
    coins: STARTING_COINS,
    round: createRound(now, random),
    history: [],
  };
}

function copyStakes(raw) {
  const stakes = emptyStakes();
  for (const side of SIDES) {
    const n = Math.floor(Number(raw?.[side.id]));
    stakes[side.id] = Number.isFinite(n) && n > 0 ? n : 0;
  }
  return stakes;
}

function copyHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const history = [];
  for (const entry of raw) {
    if (!entry || !Array.isArray(entry.nums) || entry.nums.length !== 3) continue;
    const nums = entry.nums.map((n) => Math.round(Number(n)));
    if (nums.some((n) => n < 1 || n > 6)) continue;
    const result = classify(nums);
    history.push({
      nums: result.nums,
      sum: result.sum,
      tags: result.tags,
      staked: Math.max(0, Math.floor(Number(entry.staked) || 0)),
      returned: Math.max(0, Math.floor(Number(entry.returned) || 0)),
    });
    if (history.length >= HISTORY_LIMIT) break;
  }
  return history;
}

export function parseState(raw, now, random = Math.random) {
  if (!raw || typeof raw !== "object") return freshState(now, random);
  const coins = Number.isFinite(Number(raw.coins)) ? Math.max(0, Math.floor(Number(raw.coins))) : STARTING_COINS;
  const stakes = copyStakes(raw.round?.stakes);
  const secret = Array.isArray(raw.round?.secret) ? raw.round.secret.map((n) => Math.round(Number(n))) : [];
  const secretOk = secret.length === 3 && secret.every((n) => n >= 1 && n <= 6);
  const endsAt = Number(raw.round?.endsAt);
  const history = copyHistory(raw.history);
  if (!secretOk || !Number.isFinite(endsAt)) {
    return {
      coins: coins + stakeTotal(stakes),
      round: createRound(now, random),
      history,
    };
  }
  return {
    coins,
    round: { endsAt, secret, stakes },
    history,
  };
}

export function settle(state, now, random = Math.random) {
  if (now < state.round.endsAt) return { state, event: null };
  const result = classify(state.round.secret);
  const { returned, hits } = payout(state.round.stakes, result.tags);
  const staked = stakeTotal(state.round.stakes);
  const event = {
    nums: result.nums,
    sum: result.sum,
    tags: result.tags,
    staked,
    returned,
    hits,
  };
  return {
    state: {
      coins: state.coins + returned,
      round: createRound(now, random),
      history: [event, ...state.history].slice(0, HISTORY_LIMIT),
    },
    event,
  };
}

export function resume(raw, now, random = Math.random) {
  return settle(parseState(raw, now, random), now, random);
}

export function placeBet(state, sideId, now, random = Math.random) {
  const settled = settle(state, now, random);
  if (!SIDE_IDS.has(sideId)) {
    return { ok: false, reason: "unknown", ...settled };
  }
  if (settled.state.coins < 1) {
    return { ok: false, reason: "broke", ...settled };
  }
  const stakes = { ...settled.state.round.stakes, [sideId]: settled.state.round.stakes[sideId] + 1 };
  return {
    ok: true,
    reason: "ok",
    event: settled.event,
    state: {
      ...settled.state,
      coins: settled.state.coins - 1,
      round: { ...settled.state.round, stakes },
    },
  };
}

export function refill(state) {
  if (state.coins > 0 || stakeTotal(state.round.stakes) > 0) return state;
  return { ...state, coins: STARTING_COINS };
}

export function formatRemain(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function describeDraw(entry, balance) {
  const nums = entry.nums.join(" + ");
  const tags = entry.tags.map(tagLabel).join(" · ");
  const head = `${nums} = ${entry.sum}，${tags}`;
  if (!entry.staked) return `开奖 ${head}。`;
  if (entry.returned > 0) {
    const won = entry.hits.map((hit) => hit.label).join("、");
    return `猜中 ${won}，拿回 ${entry.returned} 币。余额 ${balance}。`;
  }
  return `这局没中。余额 ${balance}。`;
}
