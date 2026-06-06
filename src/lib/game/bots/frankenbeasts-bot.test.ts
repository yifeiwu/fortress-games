import test from "node:test";
import assert from "node:assert/strict";
import { chooseBotAbility, chooseBotParts } from "@/lib/game/bots/frankenbeasts-bot";
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
