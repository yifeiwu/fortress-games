import test from "node:test";
import assert from "node:assert/strict";
import { ACTION_EFFECT_PRIORITY, FB_PARTS, PASS_ABILITY, orderActionEffects } from "@/lib/game/plugins/frankenbeasts-data";
import type { FBAbilityEffect } from "@/lib/game/plugins/frankenbeasts-data";

test("orderActionEffects sorts effects into canonical resolution priority", () => {
  const scrambled: FBAbilityEffect[] = [
    { kind: "damage_self", amount: 2 },
    { kind: "poison_self", turns: 3 },
    { kind: "heal", amount: 3 },
    { kind: "poison_opponent", turns: 2 },
    { kind: "damage", amount: 5 },
    { kind: "damage_buff", bonus: 4, turns: 3 }
  ];

  const orderedKinds = orderActionEffects(scrambled).map((effect) => effect.kind);
  assert.deepEqual(orderedKinds, [
    "damage_buff",
    "damage",
    "poison_opponent",
    "heal",
    "poison_self",
    "damage_self"
  ]);
});

test("orderActionEffects is stable for effects that share a priority", () => {
  assert.equal(ACTION_EFFECT_PRIORITY.terrify, ACTION_EFFECT_PRIORITY.trip);
  const ordered = orderActionEffects([{ kind: "trip" }, { kind: "terrify" }]);
  assert.deepEqual(ordered.map((effect) => effect.kind), ["trip", "terrify"]);
});

test("orderActionEffects does not drop or duplicate effects", () => {
  const effects: FBAbilityEffect[] = [
    { kind: "damage", amount: 5 },
    { kind: "poison_opponent", turns: 2 },
    { kind: "poison_self", turns: 3 }
  ];
  assert.equal(orderActionEffects(effects).length, effects.length);
});

test("every authored ability is already in canonical order (balance-neutral)", () => {
  const abilities = [...FB_PARTS.flatMap((part) => part.abilities), PASS_ABILITY];
  for (const ability of abilities) {
    assert.deepEqual(
      orderActionEffects(ability.effects),
      ability.effects,
      `${ability.id} effects are not authored in canonical resolution order`
    );
  }
});
