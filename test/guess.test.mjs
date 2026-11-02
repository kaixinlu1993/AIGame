import assert from "node:assert/strict";
import test from "node:test";
import {
  ROUND_MS,
  STARTING_COINS,
  classify,
  describeDraw,
  formatRemain,
  freshState,
  placeBet,
  refill,
  resume,
  settle,
} from "../js/guess-core.js";

function randomFrom(values) {
  const queue = [...values];
  return () => {
    const next = queue.shift();
    if (next === undefined) throw new Error("random exhausted");
    return (next - 1) / 6;
  };
}

test("three numbers add up into big, small, odd, even, and triples", () => {
  assert.deepEqual(classify([4, 5, 2]).tags, ["da", "dan"]);
  assert.equal(classify([4, 5, 2]).sum, 11);
  assert.deepEqual(classify([1, 2, 3]).tags, ["xiao", "shuang"]);
  assert.deepEqual(classify([1, 1, 1]).tags, ["baozi", "xiao", "dan"]);
  assert.deepEqual(classify([6, 6, 6]).tags, ["baozi", "da", "shuang"]);
  assert.deepEqual(classify([1, 4, 5]).tags, ["xiao", "shuang"]);
});

test("a fresh player receives 10 coins and a 10 minute round", () => {
  const now = 1_700_000_000_000;
  const state = freshState(now, randomFrom([1, 2, 3]));
  assert.equal(state.coins, STARTING_COINS);
  assert.equal(state.round.endsAt - now, ROUND_MS);
  assert.deepEqual(state.round.secret, [1, 2, 3]);
  assert.equal(state.history.length, 0);
  assert.equal(formatRemain(ROUND_MS), "10:00");
  assert.equal(formatRemain(1), "00:01");
  assert.equal(formatRemain(0), "00:00");
});

test("one heart costs one coin and stacks on the chosen side", () => {
  const now = 1_700_000_000_000;
  let state = freshState(now, randomFrom([4, 4, 4]));
  const first = placeBet(state, "da", now + 10, randomFrom([1, 1, 1]));
  assert.equal(first.ok, true);
  assert.equal(first.state.coins, 9);
  assert.equal(first.state.round.stakes.da, 1);
  const second = placeBet(first.state, "da", now + 20, randomFrom([2, 2, 2]));
  assert.equal(second.state.coins, 8);
  assert.equal(second.state.round.stakes.da, 2);
  state = second.state;
  for (let i = 0; i < 8; i += 1) state = placeBet(state, "xiao", now + 30, randomFrom([3, 3, 3])).state;
  assert.equal(state.coins, 0);
  const broke = placeBet(state, "dan", now + 40, randomFrom([5, 5, 5]));
  assert.equal(broke.ok, false);
  assert.equal(broke.reason, "broke");
  assert.equal(broke.state.coins, 0);
});

test("normal hits pay 2 coins back and a triple pays 10", () => {
  const now = 1_700_000_000_000;
  let state = freshState(now, randomFrom([4, 5, 2]));
  state = placeBet(state, "da", now + 1, randomFrom([1, 1, 1])).state;
  state = placeBet(state, "da", now + 2, randomFrom([1, 1, 1])).state;
  state = placeBet(state, "dan", now + 3, randomFrom([1, 1, 1])).state;
  state = placeBet(state, "baozi", now + 4, randomFrom([1, 1, 1])).state;
  const settled = settle(state, now + ROUND_MS, randomFrom([6, 6, 6]));
  assert.deepEqual(settled.event.nums, [4, 5, 2]);
  assert.deepEqual(settled.event.tags, ["da", "dan"]);
  assert.equal(settled.event.returned, 2 * 2 + 1 * 2);
  assert.equal(settled.state.coins, 6 + 6);
  assert.equal(settled.state.history[0].sum, 11);
  assert.equal(settled.state.round.endsAt - (now + ROUND_MS), ROUND_MS);

  let triple = freshState(now, randomFrom([2, 2, 2]));
  triple = placeBet(triple, "baozi", now + 1, randomFrom([1, 1, 1])).state;
  triple = placeBet(triple, "xiao", now + 2, randomFrom([1, 1, 1])).state;
  const jackpot = settle(triple, now + ROUND_MS, randomFrom([3, 3, 3]));
  assert.equal(jackpot.event.returned, 10 + 2);
  assert.equal(jackpot.state.coins, 8 + 12);
  assert.equal(describeDraw(jackpot.event, jackpot.state.coins), "猜中 小、豹子，拿回 12 币。余额 20。");
});

test("a miss returns the balance without paying the stake back", () => {
  const now = 1_700_000_000_000;
  let state = freshState(now, randomFrom([1, 1, 2]));
  state = placeBet(state, "da", now + 1, randomFrom([4, 4, 4])).state;
  const settled = settle(state, now + ROUND_MS, randomFrom([5, 5, 5]));
  assert.equal(settled.event.returned, 0);
  assert.equal(settled.state.coins, 9);
  assert.equal(describeDraw(settled.event, settled.state.coins), "这局没中。余额 9。");
});

test("coming back after the draw settles once and starts a new 10 minutes", () => {
  const now = 1_700_000_000_000;
  const started = freshState(now, randomFrom([6, 5, 5]));
  const bet = placeBet(started, "da", now + 5, randomFrom([1, 1, 1]));
  const saved = bet.state;
  const back = resume(saved, now + ROUND_MS + 30_000, randomFrom([1, 2, 3]));
  assert.equal(back.event.returned, 2);
  assert.equal(back.state.coins, 9 + 2);
  assert.deepEqual(back.state.history[0].nums, [6, 5, 5]);
  assert.equal(back.state.round.endsAt - (now + ROUND_MS + 30_000), ROUND_MS);
  assert.equal(back.state.round.stakes.da, 0);
  const again = resume(back.state, now + ROUND_MS + 40_000, randomFrom([4, 4, 4]));
  assert.equal(again.event, null);
  assert.equal(again.state.coins, back.state.coins);
});

test("empty pockets can be refilled only when nothing is still on the table", () => {
  const now = 1_700_000_000_000;
  let state = freshState(now, randomFrom([1, 2, 3]));
  for (let i = 0; i < 10; i += 1) state = placeBet(state, "da", now + i, randomFrom([1, 1, 1])).state;
  assert.equal(refill(state).coins, 0);
  const settled = settle(state, now + ROUND_MS, randomFrom([6, 6, 6]));
  assert.equal(settled.state.coins, 0);
  assert.equal(refill(settled.state).coins, 10);
});

test("a broken save gives the stake back instead of eating it", () => {
  const now = 1_700_000_000_000;
  const back = resume({ coins: 4, round: { endsAt: now + 1000, secret: [9], stakes: { da: 3 } }, history: [] }, now, randomFrom([2, 2, 2]));
  assert.equal(back.state.coins, 7);
  assert.equal(back.event, null);
});
