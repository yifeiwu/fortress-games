import test from "node:test";
import assert from "node:assert/strict";
import { chooseBotAbility, chooseBotParts } from "@/lib/game/bots/frankenbeasts-bot";
import { mulberry32, stringToSeed } from "@/lib/game/rng";
import { FB_PARTS_BY_ID, getBeastAbilities } from "@/lib/game/plugins/frankenbeasts-data";
import type { FBCombatStatus } from "@/lib/types";

test("bot always assembles a valid beast (one part per slot)", () => {
  for (let i = 0; i < 100; i += 1) {
    const { headId, bodyId, tailId } = chooseBotParts();
    assert.equal(FB_PARTS_BY_ID[headId]?.slot, "head");
    assert.equal(FB_PARTS_BY_ID[bodyId]?.slot, "body");
    assert.equal(FB_PARTS_BY_ID[tailId]?.slot, "tail");
  }
});

test("bot only chooses abilities its beast actually has", () => {
  const status = {
    headId: "bear_head",
    bodyId: "muscle_body",
    tailId: "club_tail",
    hp: 40,
    maxHp: 40,
    poisonDamage: 0,
    poisonTurns: 0,
    damageBuff: { bonus: 0, turnsRemaining: 0 }
  } satisfies FBCombatStatus;

  const valid = new Set(getBeastAbilities(status.headId, status.bodyId, status.tailId).map((a) => a.id));
  assert.ok(valid.has("pass"));

  for (let i = 0; i < 100; i += 1) {
    assert.ok(valid.has(chooseBotAbility(status)));
  }
});

test("bot prefers a lethal damage ability when available", () => {
  const attacker = {
    headId: "bear_head",
    bodyId: "muscle_body",
    tailId: "club_tail",
    hp: 24,
    maxHp: 24,
    poisonDamage: 0,
    poisonTurns: 0,
    damageBuff: { bonus: 0, turnsRemaining: 0 }
  } satisfies FBCombatStatus;
  const defender = {
    headId: "goldfish_head",
    bodyId: "wet_cardboard_body",
    tailId: "decorative_tail",
    hp: 5,
    maxHp: 11,
    poisonDamage: 0,
    poisonTurns: 0,
    damageBuff: { bonus: 0, turnsRemaining: 0 }
  } satisfies FBCombatStatus;
  const ability = chooseBotAbility(attacker, defender, () => 0);
  assert.notEqual(ability, "pass");
  assert.ok(["maul", "power_strike", "smash"].includes(ability));
});

test("bot prefers a strong heal when critically low", () => {
  const attacker = {
    headId: "bear_head",
    bodyId: "slime_body",
    tailId: "decorative_tail",
    hp: 2,
    maxHp: 19,
    poisonDamage: 0,
    poisonTurns: 0,
    damageBuff: { bonus: 0, turnsRemaining: 0 }
  } satisfies FBCombatStatus;
  const defender = {
    headId: "dragon_head",
    bodyId: "dragon_scales",
    tailId: "armored_tail",
    hp: 30,
    maxHp: 30,
    poisonDamage: 0,
    poisonTurns: 0,
    damageBuff: { bonus: 0, turnsRemaining: 0 }
  } satisfies FBCombatStatus;
  const ability = chooseBotAbility(attacker, defender, () => 0.2);
  assert.equal(ability, "regenerate");
});

test("matchup-aware bot part picks are deterministic for a seed", () => {
  const opponent = {
    headId: "dragon_head",
    bodyId: "muscle_body",
    tailId: "club_tail"
  };
  const a = chooseBotParts(mulberry32(stringToSeed("fb-seed")), opponent);
  const b = chooseBotParts(mulberry32(stringToSeed("fb-seed")), opponent);
  assert.deepEqual(a, b);
  assert.equal(FB_PARTS_BY_ID[a.headId]?.slot, "head");
  assert.equal(FB_PARTS_BY_ID[a.bodyId]?.slot, "body");
  assert.equal(FB_PARTS_BY_ID[a.tailId]?.slot, "tail");
});
