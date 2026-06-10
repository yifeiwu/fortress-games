import {
  FB_BODIES,
  FB_HEADS,
  FB_TAILS,
  computeDamageAmplify,
  computeDamageReduction,
  computeDeathMarch,
  computeHealPerRound,
  computeMaxHp,
  computePoisonRetaliation,
  computeRetaliation,
  getBeastAbilities,
  getSelfPoisonTurns
} from "@/lib/game/plugins/frankenbeasts-data";
import type { FBCombatStatus } from "@/lib/types";

type Rng = () => number;

function pickRandom<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]!;
}

function scoreAbility(status: FBCombatStatus, abilityId: string, opponentStatus?: FBCombatStatus): number {
  if (abilityId === "pass") {
    return -2;
  }
  const ability = getBeastAbilities(status.headId, status.bodyId, status.tailId).find((entry) => entry.id === abilityId);
  if (!ability) return -1000;

  const myBuffBonus = status.damageBuff.turnsRemaining > 0 ? status.damageBuff.bonus : 0;
  const opponentReduction = opponentStatus
    ? computeDamageReduction(opponentStatus.headId, opponentStatus.bodyId, opponentStatus.tailId)
    : 0;
  const opponentAmplify = opponentStatus
    ? computeDamageAmplify(opponentStatus.headId, opponentStatus.bodyId, opponentStatus.tailId)
    : 0;
  const opponentEstimatedBurst =
    opponentStatus == null
      ? 0
      : Math.max(
          ...getBeastAbilities(opponentStatus.headId, opponentStatus.bodyId, opponentStatus.tailId).map((opponentAbility) =>
            opponentAbility.effects.reduce((sum, effect) => sum + (effect.kind === "damage" ? effect.amount : 0), 0)
          )
        );

  const missingHp = Math.max(0, status.maxHp - status.hp);
  let score = 0;
  ability.effects.forEach((effect) => {
    switch (effect.kind) {
      case "damage": {
        const damage = Math.max(0, effect.amount + myBuffBonus - opponentReduction + opponentAmplify);
        score += damage * 1.6;
        if (opponentStatus && damage >= opponentStatus.hp) {
          score += 40;
        }
        break;
      }
      case "heal":
        score += Math.min(effect.amount, missingHp) * (status.hp <= Math.ceil(status.maxHp * 0.4) ? 2.2 : 1.2);
        break;
      case "poison_opponent":
        score += effect.turns * 2.2;
        break;
      case "damage_buff":
        score += effect.bonus * effect.turns * 0.7;
        break;
      case "terrify":
        score += opponentEstimatedBurst <= 5 ? 6 : 2;
        break;
      case "trip":
        score += opponentEstimatedBurst > 6 ? 7 : 1;
        break;
      case "poison_self":
        score -= effect.turns * 2;
        break;
      case "damage_self":
        score -= effect.amount * 2.5;
        break;
      case "pass":
        score -= 2;
        break;
    }
  });
  return score;
}

function toCombatStatus(headId: string, bodyId: string, tailId: string): FBCombatStatus {
  const maxHp = computeMaxHp(headId, bodyId, tailId);
  return {
    headId,
    bodyId,
    tailId,
    hp: maxHp,
    maxHp,
    poisonDamage: 0,
    poisonTurns: 0,
    damageBuff: { bonus: 0, turnsRemaining: 0 }
  };
}

function scoreParts(headId: string, bodyId: string, tailId: string, opponentStatus?: FBCombatStatus): number {
  const maxHp = computeMaxHp(headId, bodyId, tailId);
  const reduction = computeDamageReduction(headId, bodyId, tailId);
  const retaliation = computeRetaliation(headId, bodyId, tailId);
  const healPerRound = computeHealPerRound(headId, bodyId, tailId);
  const deathMarch = computeDeathMarch(headId, bodyId, tailId);
  const poisonRetaliation = computePoisonRetaliation(headId, bodyId, tailId);
  const selfPoisonTurns = getSelfPoisonTurns(headId, bodyId, tailId);
  const status = toCombatStatus(headId, bodyId, tailId);
  const abilityScore = Math.max(...getBeastAbilities(headId, bodyId, tailId).map((ability) => scoreAbility(status, ability.id)));
  const baseline =
    maxHp +
    reduction * 1.7 +
    retaliation * 1.6 +
    healPerRound * 1.8 +
    deathMarch * 1.5 +
    poisonRetaliation * 1.4 +
    abilityScore -
    selfPoisonTurns * 1.8;
  if (!opponentStatus) {
    return baseline;
  }
  const matchupOffense = Math.max(
    ...getBeastAbilities(headId, bodyId, tailId).map((ability) => scoreAbility(status, ability.id, opponentStatus))
  );
  const opponentThreat = Math.max(
    ...getBeastAbilities(opponentStatus.headId, opponentStatus.bodyId, opponentStatus.tailId).map((ability) =>
      scoreAbility(opponentStatus, ability.id, status)
    )
  );
  return baseline + matchupOffense * 0.9 - opponentThreat * 0.65;
}

/** Assemble a high-value beast, with a little randomness among top picks. */
export function chooseBotParts(
  rng: Rng = Math.random,
  opponentParts?: { headId: string; bodyId: string; tailId: string }
): { headId: string; bodyId: string; tailId: string } {
  const opponentStatus = opponentParts
    ? toCombatStatus(opponentParts.headId, opponentParts.bodyId, opponentParts.tailId)
    : undefined;
  const candidates: Array<{ headId: string; bodyId: string; tailId: string; score: number }> = [];
  FB_HEADS.forEach((head) => {
    FB_BODIES.forEach((body) => {
      FB_TAILS.forEach((tail) => {
        candidates.push({
          headId: head.id,
          bodyId: body.id,
          tailId: tail.id,
          score: scoreParts(head.id, body.id, tail.id, opponentStatus)
        });
      });
    });
  });
  candidates.sort((a, b) => b.score - a.score);
  const shortlist = candidates.slice(0, Math.min(5, candidates.length));
  const pick = shortlist[Math.floor(rng() * shortlist.length)] ?? candidates[0];
  return {
    headId: pick.headId,
    bodyId: pick.bodyId,
    tailId: pick.tailId
  };
}

/** Pick a high-value ability for the current round. */
export function chooseBotAbility(status: FBCombatStatus, opponentStatus?: FBCombatStatus, rng: Rng = Math.random): string {
  const abilities = getBeastAbilities(status.headId, status.bodyId, status.tailId);
  let bestScore = Number.NEGATIVE_INFINITY;
  const best: string[] = [];
  abilities.forEach((ability) => {
    const score = scoreAbility(status, ability.id, opponentStatus);
    if (score > bestScore) {
      bestScore = score;
      best.length = 0;
      best.push(ability.id);
      return;
    }
    if (score === bestScore) {
      best.push(ability.id);
    }
  });
  return pickRandom(best, rng);
}
