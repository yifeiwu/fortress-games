import type { GameDefinition, GameRoundResult } from "@/lib/game/contracts";
import type {
  FBCombatStatus,
  FBLogEntry,
  FBRevealStep,
  FBRoundAction,
  FrankenBeastsGameState,
  GameState,
  Player,
  Room
} from "@/lib/types";
import {
  FB_PARTS_BY_ID,
  TERRIFY_MAX_BLOCKED_DAMAGE,
  TRIP_BLOCK_DAMAGE_THRESHOLD,
  computeDamageAmplify,
  computeDamageReduction,
  computeDeathMarch,
  computeHealPerRound,
  computeMaxHp,
  computePoisonRetaliation,
  computeRetaliation,
  getBeastAbilities,
  getSelfPoisonTurns,
  orderActionEffects,
  randomPartId,
  resolveFighterIds
} from "@/lib/game/plugins/frankenbeasts-data";
import { playerName } from "@/lib/game/players";
import { chooseBotAbility, chooseBotParts } from "@/lib/game/bots/frankenbeasts-bot";
import { FRANKENBEASTS_PLAYER_COUNT } from "@/lib/constants";

const PICK_DURATION_MS = 60_000;
const FIGHT_ROUND_DURATION_MS = 15_000;
// Long enough to play the round's events one at a time during the reveal.
const REVEAL_DURATION_MS = 7_000;
const POISON_DAMAGE_PER_INSTANCE = 2;
// Hard cap so two purely defensive beasts can't fight forever. When reached,
// the round is decided by remaining HP percentage (tie = draw).
const MAX_FIGHT_ROUNDS = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const activeFighterIds = resolveFighterIds;

function appendLog(log: FrankenBeastsGameState["log"], message: string, roundIndex: number): FrankenBeastsGameState["log"] {
  const entry: FBLogEntry = {
    id: `fb-log-${Date.now()}-${log.length}`,
    message,
    roundIndex
  };
  return [entry, ...log].slice(0, 80);
}

function cloneStates(states: Record<string, FBCombatStatus>): Record<string, FBCombatStatus> {
  const out: Record<string, FBCombatStatus> = {};
  for (const [id, status] of Object.entries(states)) {
    out[id] = { ...status, damageBuff: { ...status.damageBuff } };
  }
  return out;
}

/**
 * Accumulates the round's play-by-play. Every gameplay event records both a
 * persistent log line and a reveal step that snapshots combat state at that
 * moment, so the client can animate the round one event at a time.
 */
interface RoundRecorder {
  roundIndex: number;
  steps: FBRevealStep[];
}

function recordStep(
  rec: RoundRecorder,
  message: string,
  states: Record<string, FBCombatStatus>,
  attackerId?: string
): void {
  rec.steps.push({
    id: `fb-step-${rec.roundIndex}-${rec.steps.length}`,
    message,
    states: cloneStates(states),
    attackerId
  });
}

function evaluateOutcome(
  combatStates: Record<string, FBCombatStatus>,
  p1: string,
  p2: string
): { winnerId?: string; isDraw?: boolean } {
  const p1Dead = (combatStates[p1]?.hp ?? 0) <= 0;
  const p2Dead = (combatStates[p2]?.hp ?? 0) <= 0;
  if (p1Dead && p2Dead) return { isDraw: true };
  if (p1Dead) return { winnerId: p2 };
  if (p2Dead) return { winnerId: p1 };
  return {};
}

function decideByHpRatio(
  combatStates: Record<string, FBCombatStatus>,
  p1: string,
  p2: string
): { winnerId?: string; isDraw?: boolean } {
  const ratio = (id: string) => {
    const s = combatStates[id];
    const maxHp = s?.maxHp ?? 0;
    return maxHp > 0 ? (s?.hp ?? 0) / maxHp : 0;
  };
  const r1 = ratio(p1);
  const r2 = ratio(p2);
  if (Math.abs(r1 - r2) < 1e-9) return { isDraw: true };
  return { winnerId: r1 > r2 ? p1 : p2 };
}

function clampHp(hp: number): number {
  return Math.max(0, hp);
}

function applyPoison(status: FBCombatStatus, turns: number): FBCombatStatus {
  return {
    ...status,
    poisonDamage: status.poisonDamage + POISON_DAMAGE_PER_INSTANCE,
    poisonTurns: Math.max(status.poisonTurns, turns)
  };
}

function applyDamageBuff(
  status: FBCombatStatus,
  bonus: number,
  turns: number
): FBCombatStatus {
  return {
    ...status,
    damageBuff: {
      bonus: status.damageBuff.bonus + bonus,
      turnsRemaining: Math.max(status.damageBuff.turnsRemaining, turns)
    }
  };
}

function healStatus(status: FBCombatStatus, amount: number): FBCombatStatus {
  return { ...status, hp: Math.min(status.maxHp, status.hp + amount) };
}

function damageStatus(status: FBCombatStatus, amount: number): FBCombatStatus {
  return { ...status, hp: clampHp(status.hp - amount) };
}

// ─── Pick Resolution ──────────────────────────────────────────────────────────

function buildCombatStatus(headId: string, bodyId: string, tailId: string): FBCombatStatus {
  const maxHp = computeMaxHp(headId, bodyId, tailId);
  // Cursed Body inflicts a fixed run of self-poison the moment the beast is
  // assembled (2 dmg/turn for its self_poison turns).
  const selfPoisonTurns = getSelfPoisonTurns(headId, bodyId, tailId);
  return {
    headId,
    bodyId,
    tailId,
    hp: maxHp,
    maxHp,
    poisonDamage: selfPoisonTurns > 0 ? POISON_DAMAGE_PER_INSTANCE : 0,
    poisonTurns: selfPoisonTurns,
    damageBuff: { bonus: 0, turnsRemaining: 0 }
  };
}

function resolvePick(room: Room, state: GameState, now: number): GameState {
  const fb = state.frankenbeasts;
  if (!fb) return state;

  const players = activeFighterIds(room, fb);
  if (!players) return state;

  const combatStates: Record<string, FBCombatStatus> = {};

  for (const playerId of players) {
    const pick = fb.pendingPicks[playerId] ?? { lockedIn: false };
    const headId = pick.headId ?? randomPartId("head");
    const bodyId = pick.bodyId ?? randomPartId("body");
    const tailId = pick.tailId ?? randomPartId("tail");
    combatStates[playerId] = buildCombatStatus(headId, bodyId, tailId);
  }

  let nextFb: FrankenBeastsGameState = {
    ...fb,
    combatStates,
    roundSelections: {},
    roundActions: {},
    lastRoundActions: {},
    log: appendLog(fb.log, "The beasts have been assembled. Let the fight begin!", state.roundIndex)
  };

  return {
    ...state,
    state: "fight_round",
    roundIndex: 0,
    roundDeadlineAt: now + FIGHT_ROUND_DURATION_MS,
    frankenbeasts: nextFb,
    version: state.version + 1
  };
}

// ─── Fight Round Resolution ───────────────────────────────────────────────────

function resolveAction(
  room: Room,
  state: GameState,
  attackerId: string,
  defenderId: string,
  action: FBRoundAction,
  defenderAction: FBRoundAction,
  combatStates: Record<string, FBCombatStatus>,
  log: FrankenBeastsGameState["log"],
  rec: RoundRecorder
): {
  combatStates: Record<string, FBCombatStatus>;
  log: FrankenBeastsGameState["log"];
  defenderReceivedDirectDamage: boolean;
} {
  const attacker = combatStates[attackerId]!;
  const defender = combatStates[defenderId]!;
  const abilityId = action.abilityId;
  const name = playerName(room, attackerId);

  const abilities = getBeastAbilities(attacker.headId, attacker.bodyId, attacker.tailId);
  const ability = abilities.find((a) => a.id === abilityId);

  if (!ability || ability.effects.some((e) => e.kind === "pass")) {
    return { combatStates, log, defenderReceivedDirectDamage: false };
  }

  let newAttacker = { ...attacker };
  let newDefender = { ...defender };
  let newLog = log;
  let defenderReceivedDirectDamage = false;
  const roundIndex = state.roundIndex;

  // Records both the persistent log line and a reveal-step snapshot of combat
  // state right after this event. Reads newAttacker/newDefender lazily so the
  // snapshot reflects the just-applied mutation. Pass `attacking` for direct-hit
  // events so the client can charge the attacker (and only then).
  const emit = (message: string, attacking = false) => {
    newLog = appendLog(newLog, message, roundIndex);
    recordStep(
      rec,
      message,
      { ...combatStates, [attackerId]: newAttacker, [defenderId]: newDefender },
      attacking ? attackerId : undefined
    );
  };

  const defAbilities = getBeastAbilities(defender.headId, defender.bodyId, defender.tailId);
  const defenderUsedTerrify = defenderAction.abilityId === "terrify" && defAbilities.some((a) => a.id === "terrify");
  const defenderUsedTrip = defenderAction.abilityId === "trip" && defAbilities.some((a) => a.id === "trip");

  // Resolve effects in a fixed priority (see ACTION_EFFECT_PRIORITY) rather than
  // authored order, so the math and the log are deterministic across parts.
  for (const effect of orderActionEffects(ability.effects)) {
    switch (effect.kind) {
      case "damage": {
        const buffedDmg = effect.amount + (newAttacker.damageBuff.turnsRemaining > 0 ? newAttacker.damageBuff.bonus : 0);
        const defReduction = computeDamageReduction(
          newDefender.headId,
          newDefender.bodyId,
          newDefender.tailId
        );

        // Terrify blocks small hits entirely.
        if (defenderUsedTerrify && buffedDmg <= TERRIFY_MAX_BLOCKED_DAMAGE) {
          emit(`${name}'s ${ability.name} (${buffedDmg} dmg) was blocked by Terrify!`);
          break;
        }

        // Trip blocks big hits and reflects them back at the attacker.
        if (defenderUsedTrip && buffedDmg > TRIP_BLOCK_DAMAGE_THRESHOLD) {
          const reflected = Math.max(
            0,
            buffedDmg -
              computeDamageReduction(
                newAttacker.headId,
                newAttacker.bodyId,
                newAttacker.tailId
              )
          );
          newAttacker = damageStatus(newAttacker, reflected);
          emit(`${name}'s ${ability.name} (${buffedDmg} dmg) was tripped and reflected back for ${reflected} damage!`);
          break;
        }

        const defAmplify = computeDamageAmplify(newDefender.headId, newDefender.bodyId, newDefender.tailId);
        const finalDmg = Math.max(0, buffedDmg - defReduction + defAmplify);
        if (finalDmg > 0) {
          defenderReceivedDirectDamage = true;
        }
        newDefender = damageStatus(newDefender, finalDmg);
        const suffix = defAmplify > 0 ? ` (wet cardboard crumples!)` : defReduction > 0 ? ` (${buffedDmg} - ${defReduction} armor)` : "";
        emit(`${name}'s ${ability.name} deals ${finalDmg} damage.${suffix}`, finalDmg > 0);
        break;
      }
      case "heal": {
        newAttacker = healStatus(newAttacker, effect.amount);
        emit(`${name}'s ${ability.name} heals ${effect.amount} HP.`);
        break;
      }
      case "poison_opponent": {
        newDefender = applyPoison(newDefender, effect.turns);
        emit(`${name}'s ${ability.name} applies poison (${POISON_DAMAGE_PER_INSTANCE}/turn for ${effect.turns} turns).`);
        break;
      }
      case "poison_self": {
        newAttacker = applyPoison(newAttacker, effect.turns);
        emit(`${name}'s ${ability.name} poisons themselves (${POISON_DAMAGE_PER_INSTANCE}/turn for ${effect.turns} turns).`);
        break;
      }
      case "damage_buff": {
        // +1 so the end-of-round decrement on the cast round doesn't eat a turn;
        // the buff then covers exactly `effect.turns` subsequent attacking rounds.
        newAttacker = applyDamageBuff(newAttacker, effect.bonus, effect.turns + 1);
        emit(`${name} uses Roar! +${effect.bonus} attack for ${effect.turns} turns.`);
        break;
      }
      case "damage_self": {
        const selfAmplify = computeDamageAmplify(newAttacker.headId, newAttacker.bodyId, newAttacker.tailId);
        const selfDmg = Math.max(0, effect.amount + selfAmplify);
        newAttacker = damageStatus(newAttacker, selfDmg);
        emit(`${name}'s ${ability.name} hurts themselves for ${selfDmg} damage. Classic.`);
        break;
      }
      case "terrify": {
        // Defensive stance: the actual block is logged in the opponent's attack
        // resolution; this records that the stance was taken so it replays.
        emit(`${name} braces with Terrify — a weak hit (≤${TERRIFY_MAX_BLOCKED_DAMAGE}) will be blocked.`);
        break;
      }
      case "trip": {
        emit(`${name} sets a Trip — a big hit (>${TRIP_BLOCK_DAMAGE_THRESHOLD}) will be blocked and reflected.`);
        break;
      }
      case "pass":
        break;
    }
  }

  return {
    combatStates: {
      ...combatStates,
      [attackerId]: newAttacker,
      [defenderId]: newDefender
    },
    log: newLog,
    defenderReceivedDirectDamage
  };
}

/**
 * Resolves one fight round through a fixed, deterministic pipeline so the result
 * and the play-by-play log are reproducible from (previous-round state + both
 * actions) alone. Fighters are always processed in `activeFighterIds` order
 * (p1 = first by join order) wherever ordering is observable.
 *
 *   1. both players' active actions (each via `resolveAction`, whose effects run
 *      in ACTION_EFFECT_PRIORITY order)
 *   2. direct-blow win check (locked in before passives/poison can change it)
 *   3. passives: death march → heal-per-round
 *   4. retaliation (only vs an opponent who dealt direct damage)
 *   5. poison ticks
 *   6. buff countdown
 *   7. final win check, then round-limit HP tiebreak
 */
function resolveFightRound(room: Room, state: GameState, now: number): GameState {
  const fb = state.frankenbeasts;
  if (!fb) return state;

  const players = activeFighterIds(room, fb);
  if (!players) return state;

  const [p1, p2] = players;
  let combatStates = { ...fb.combatStates };
  let log = fb.log;
  const roundIndex = state.roundIndex;

  // Records the round's play-by-play: each event appends a log line and a
  // reveal-step snapshot so the client can animate the round event-by-event.
  const rec: RoundRecorder = { roundIndex, steps: [] };
  const emit = (message: string) => {
    log = appendLog(log, message, roundIndex);
    recordStep(rec, message, combatStates);
  };

  // Baseline frame: the state entering the round (i.e. the previous round's
  // result), so the reveal starts from the correct HP before any event plays.
  recordStep(rec, "", combatStates);

  const action1 = fb.roundActions[p1] ?? { playerId: p1, abilityId: "pass", autoSubmitted: true };
  const action2 = fb.roundActions[p2] ?? { playerId: p2, abilityId: "pass", autoSubmitted: true };

  // Resolve active actions for both players simultaneously
  const r1 = resolveAction(room, state, p1, p2, action1, action2, combatStates, log, rec);
  combatStates = r1.combatStates;
  log = r1.log;
  const p1DealtDirectDamageToP2 = r1.defenderReceivedDirectDamage;

  const r2 = resolveAction(room, state, p2, p1, action2, action1, combatStates, log, rec);
  combatStates = r2.combatStates;
  log = r2.log;
  const p2DealtDirectDamageToP1 = r2.defenderReceivedDirectDamage;

  // Win by direct blows: locked in before passives/poison can overturn the result
  const directOutcome = evaluateOutcome(combatStates, p1, p2);
  let winnerId = directOutcome.winnerId;
  let isDraw = directOutcome.isDraw ?? false;

  if (isDraw) {
    emit("Both beasts fall simultaneously. It's a draw!");
  } else if (winnerId) {
    emit(`${playerName(room, winnerId)} wins!`);
  }

  // ── Passives ──────────────────────────────────────────────────────────────
  for (const playerId of players) {
    const status = combatStates[playerId]!;
    const opponentId = playerId === p1 ? p2 : p1;
    const name = playerName(room, playerId);

    const deathMarch = computeDeathMarch(status.headId, status.bodyId, status.tailId);
    if (deathMarch > 0) {
      const opponent = combatStates[opponentId]!;
      combatStates[opponentId] = damageStatus(opponent, deathMarch);
      emit(`${name}'s Skeleton Ribs deal ${deathMarch} passive damage.`);
    }

    const healPerRound = computeHealPerRound(status.headId, status.bodyId, status.tailId);
    if (healPerRound > 0) {
      combatStates[playerId] = healStatus(combatStates[playerId]!, healPerRound);
      emit(`${name}'s Fluffy Tail heals ${healPerRound} HP.`);
    }
  }

  // ── Retaliation (only when direct damage was actually dealt) ──────────────
  const directDamageDealt = new Map<string, boolean>([
    [p1, p1DealtDirectDamageToP2],
    [p2, p2DealtDirectDamageToP1]
  ]);

  for (const playerId of players) {
    const status = combatStates[playerId]!;
    const opponentId = playerId === p1 ? p2 : p1;

    if (!directDamageDealt.get(opponentId)) continue;

    const retaliation = computeRetaliation(status.headId, status.bodyId, status.tailId);
    if (retaliation > 0) {
      combatStates[opponentId] = damageStatus(combatStates[opponentId]!, retaliation);
      emit(`${playerName(room, playerId)}'s spikes deal ${retaliation} retaliation damage.`);
    }

    const poisonRetaliationTurns = computePoisonRetaliation(status.headId, status.bodyId, status.tailId);
    if (poisonRetaliationTurns > 0) {
      combatStates[opponentId] = applyPoison(combatStates[opponentId]!, poisonRetaliationTurns);
      emit(`${playerName(room, playerId)}'s Poison Skin retaliates with poison (${POISON_DAMAGE_PER_INSTANCE}/turn for ${poisonRetaliationTurns} turns).`);
    }
  }

  // ── Poison ticks ──────────────────────────────────────────────────────────
  for (const playerId of players) {
    const status = combatStates[playerId]!;
    if (status.poisonTurns > 0 && status.poisonDamage > 0) {
      combatStates[playerId] = {
        ...damageStatus(status, status.poisonDamage),
        poisonTurns: status.poisonTurns - 1,
        poisonDamage: status.poisonTurns - 1 <= 0 ? 0 : status.poisonDamage
      };
      emit(`${playerName(room, playerId)} takes ${status.poisonDamage} poison damage (${status.poisonTurns - 1} turns left).`);
    }
  }

  // ── Decrement damageBuff ──────────────────────────────────────────────────
  for (const playerId of players) {
    const status = combatStates[playerId]!;

    if (status.damageBuff.turnsRemaining > 0) {
      const newTurns = status.damageBuff.turnsRemaining - 1;
      combatStates[playerId] = {
        ...status,
        damageBuff: {
          bonus: newTurns > 0 ? status.damageBuff.bonus : 0,
          turnsRemaining: newTurns
        }
      };
    }
  }

  // ── Final win check (poison/passives only if no direct winner yet) ────────
  if (!winnerId && !isDraw) {
    const finalOutcome = evaluateOutcome(combatStates, p1, p2);
    if (finalOutcome.isDraw) {
      isDraw = true;
      emit("Both beasts succumb to poison. It's a draw!");
    } else if (finalOutcome.winnerId) {
      winnerId = finalOutcome.winnerId;
      emit(`${playerName(room, finalOutcome.winnerId)} wins!`);
    }
  }

  // ── Round cap: decide by HP% so a stall can't run forever ─────────────────
  if (!winnerId && !isDraw && roundIndex >= MAX_FIGHT_ROUNDS - 1) {
    const tiebreak = decideByHpRatio(combatStates, p1, p2);
    if (tiebreak.isDraw) {
      isDraw = true;
      emit("Round limit reached — both beasts are equally battered. It's a draw!");
    } else if (tiebreak.winnerId) {
      winnerId = tiebreak.winnerId;
      emit(`Round limit reached — ${playerName(room, tiebreak.winnerId)} wins on remaining HP!`);
    }
  }

  const nextFb: FrankenBeastsGameState = {
    ...fb,
    combatStates,
    lastRoundActions: { ...fb.roundActions },
    roundSelections: {},
    roundActions: {},
    revealSteps: rec.steps,
    log,
    winnerId,
    isDraw
  };

  return {
    ...state,
    state: "fight_reveal",
    roundDeadlineAt: now + REVEAL_DURATION_MS,
    scores: winnerId ? { ...state.scores, [winnerId]: (state.scores[winnerId] ?? 0) + 1 } : state.scores,
    frankenbeasts: nextFb,
    version: state.version + 1
  };
}

// ─── GameDefinition ───────────────────────────────────────────────────────────

function createEmptyScores(players: Player[]): Record<string, number> {
  return Object.fromEntries(players.map((p) => [p.id, 0]));
}

/**
 * Ends the game when the room no longer has exactly two players (e.g. someone
 * left mid-match). The lone remaining player wins by forfeit; an empty room is
 * recorded as a draw. This keeps the time-advancing state machine from spinning
 * on a phase it can never resolve.
 */
function forfeitState(room: Room, state: GameState, _now: number): GameState {
  const fb = state.frankenbeasts;
  const remainingFighterIds = (fb?.fighterIds ?? []).filter((id) => room.players.some((player) => player.id === id));
  const winnerId = remainingFighterIds.length === 1 ? remainingFighterIds[0] : undefined;
  const isDraw = remainingFighterIds.length !== 1;
  const message = winnerId
    ? `${playerName(room, winnerId)} wins — the opponent left the arena.`
    : "The arena emptied out. No contest.";

  return {
    ...state,
    state: "finished",
    roundDeadlineAt: undefined,
    scores: winnerId ? { ...state.scores, [winnerId]: (state.scores[winnerId] ?? 0) + 1 } : state.scores,
    frankenbeasts: fb
      ? { ...fb, winnerId, isDraw, log: appendLog(fb.log, message, state.roundIndex) }
      : fb,
    version: state.version + 1
  };
}

export const frankenBeastsGameDefinition: GameDefinition = {
  gameType: "frankenbeasts",
  supportsBots: true,
  maxActivePlayers: FRANKENBEASTS_PLAYER_COUNT,

  createInitialState({ players, now: _now }) {
    return {
      gameType: "frankenbeasts",
      state: "waiting",
      roundIndex: 0,
      maxRounds: 999,
      scores: createEmptyScores(players),
      choicesByRound: {},
      rngByRound: {},
      frankenbeasts: {
        pendingPicks: {},
        combatStates: {},
        roundSelections: {},
        roundActions: {},
        lastRoundActions: {},
        log: []
      },
      version: 1
    };
  },

  parseAction(payload) {
    const action = payload.action;
    if (action === "start_game") return { type: "start_game" };

    if (action === "submit_pick") {
      return {
        type: "submit_pick",
        headId: payload.headId,
        bodyId: payload.bodyId,
        tailId: payload.tailId,
        lockIn: payload.lockIn === true
      };
    }

    if (action === "submit_fb_action") {
      if (typeof payload.abilityId !== "string") return null;
      return { type: "submit_fb_action", abilityId: payload.abilityId };
    }

    return null;
  },

  applyCommand({ room, state, command, context }) {
    const now = context.now;
    const fb = state.frankenbeasts;

    // ── Start game ──────────────────────────────────────────────────────────
    if (command.type === "start_game" && state.state === "waiting") {
      const fighterIds = activeFighterIds(room);
      if (fighterIds === null) return state;

      const initialFb: FrankenBeastsGameState = {
        fighterIds,
        pendingPicks: {},
        combatStates: {},
        roundSelections: {},
        roundActions: {},
        lastRoundActions: {},
        log: [{ id: `fb-log-${now}-start`, message: "Build your beast! 60 seconds on the clock.", roundIndex: 0 }]
      };
      return {
        ...state,
        state: "pick_phase",
        roundDeadlineAt: now + PICK_DURATION_MS,
        frankenbeasts: initialFb,
        version: state.version + 1
      };
    }

    // ── Submit pick ─────────────────────────────────────────────────────────
    if (command.type === "submit_pick" && state.state === "pick_phase" && fb) {
      const playerId = context.actorPlayerId;
      if (!playerId) return state;
      const playerIds = activeFighterIds(room, fb);
      if (!playerIds || !playerIds.includes(playerId)) return state;

      const headId = typeof command.headId === "string" && FB_PARTS_BY_ID[command.headId]?.slot === "head" ? command.headId : undefined;
      const bodyId = typeof command.bodyId === "string" && FB_PARTS_BY_ID[command.bodyId]?.slot === "body" ? command.bodyId : undefined;
      const tailId = typeof command.tailId === "string" && FB_PARTS_BY_ID[command.tailId]?.slot === "tail" ? command.tailId : undefined;
      const lockIn = command.lockIn === true;

      const existingPick = fb.pendingPicks[playerId] ?? { lockedIn: false };
      const newPick = {
        headId: headId ?? existingPick.headId,
        bodyId: bodyId ?? existingPick.bodyId,
        tailId: tailId ?? existingPick.tailId,
        lockedIn: lockIn ? true : existingPick.lockedIn
      };

      const updatedPicks = { ...fb.pendingPicks, [playerId]: newPick };
      const allLocked = playerIds !== null && playerIds.every((id) => updatedPicks[id]?.lockedIn);

      const newState: GameState = {
        ...state,
        frankenbeasts: { ...fb, pendingPicks: updatedPicks },
        version: state.version + 1
      };

      if (allLocked) {
        return resolvePick(room, newState, now);
      }
      return newState;
    }

    // ── Select fight action (committed when round timer expires) ──────────────
    if (command.type === "submit_fb_action" && state.state === "fight_round" && fb) {
      const playerId = context.actorPlayerId;
      if (!playerId) return state;

      const playerIds = activeFighterIds(room, fb);
      if (!playerIds || !playerIds.includes(playerId)) return state;

      const abilityId = typeof command.abilityId === "string" ? command.abilityId : "pass";

      const combatStatus = fb.combatStates[playerId];
      if (!combatStatus) return state;
      const validAbilities = getBeastAbilities(combatStatus.headId, combatStatus.bodyId, combatStatus.tailId);
      if (!validAbilities.some((a) => a.id === abilityId)) return state;

      return {
        ...state,
        frankenbeasts: {
          ...fb,
          roundSelections: { ...(fb.roundSelections ?? {}), [playerId]: abilityId }
        },
        version: state.version + 1
      };
    }

    return state;
  },

  closeRound({ room, state, now }): { nextState: GameState; result: GameRoundResult } {
    // ── Pick phase expired ──────────────────────────────────────────────────
    if (state.state === "pick_phase") {
      if (activeFighterIds(room, state.frankenbeasts) === null) {
        return { nextState: forfeitState(room, state, now), result: { wasClosed: true, matchedPlayerIds: [] } };
      }
      const nextState = resolvePick(room, state, now);
      return { nextState, result: { wasClosed: true, matchedPlayerIds: [] } };
    }

    // ── Fight round expired ─────────────────────────────────────────────────
    if (state.state === "fight_round") {
      const fb = state.frankenbeasts;
      if (!fb) return { nextState: state, result: { wasClosed: false, matchedPlayerIds: [] } };

      const playerIds = activeFighterIds(room, fb);
      if (!playerIds) {
        return { nextState: forfeitState(room, state, now), result: { wasClosed: true, matchedPlayerIds: [] } };
      }

      const updatedActions: Record<string, FBRoundAction> = {};
      for (const playerId of playerIds) {
        const selected = fb.roundSelections?.[playerId];
        updatedActions[playerId] = {
          playerId,
          abilityId: selected ?? "pass",
          autoSubmitted: selected === undefined
        };
      }

      const stateWithActions: GameState = {
        ...state,
        frankenbeasts: { ...fb, roundActions: updatedActions },
        version: state.version + 1
      };

      const nextState = resolveFightRound(room, stateWithActions, now);
      return { nextState, result: { wasClosed: true, matchedPlayerIds: [] } };
    }

    // ── Reveal phase expired ────────────────────────────────────────────────
    if (state.state === "fight_reveal") {
      const fb = state.frankenbeasts;
      if (!fb) return { nextState: state, result: { wasClosed: false, matchedPlayerIds: [] } };

      if (fb.winnerId !== undefined || fb.isDraw) {
        const nextState: GameState = {
          ...state,
          state: "finished",
          roundDeadlineAt: undefined,
          version: state.version + 1
        };
        return { nextState, result: { wasClosed: true, matchedPlayerIds: [] } };
      }

      // Opponent left during the reveal — don't start a round that can't resolve.
      if (activeFighterIds(room, fb) === null) {
        return { nextState: forfeitState(room, state, now), result: { wasClosed: true, matchedPlayerIds: [] } };
      }

      const nextState: GameState = {
        ...state,
        state: "fight_round",
        roundIndex: state.roundIndex + 1,
        roundDeadlineAt: now + FIGHT_ROUND_DURATION_MS,
        frankenbeasts: { ...fb, roundSelections: {} },
        version: state.version + 1
      };
      return { nextState, result: { wasClosed: true, matchedPlayerIds: [] } };
    }

    return { nextState: state, result: { wasClosed: false, matchedPlayerIds: [] } };
  },

  shouldAdvanceTime(state) {
    return state.state === "pick_phase" || state.state === "fight_round" || state.state === "fight_reveal";
  },

  applyBots({ room, state, now }) {
    if (!state.frankenbeasts) return state;
    let nextState = state;

    // Pick phase: lock in a random beast for any bot that hasn't yet.
    if (nextState.state === "pick_phase") {
      const fighterIds = activeFighterIds(room, nextState.frankenbeasts);
      for (const player of room.players) {
        if (!fighterIds?.includes(player.id)) continue;
        if (!player.isBot) continue;
        if (nextState.frankenbeasts!.pendingPicks[player.id]?.lockedIn) continue;
        const parts = chooseBotParts();
        nextState = frankenBeastsGameDefinition.applyCommand({
          room,
          state: nextState,
          command: { type: "submit_pick", ...parts, lockIn: true },
          context: { now, actorPlayerId: player.id }
        });
      }
    }

    // Fight round: choose a random ability for any bot without a selection.
    // (Picking above may have just advanced us into the first fight round.)
    if (nextState.state === "fight_round") {
      const fighterIds = activeFighterIds(room, nextState.frankenbeasts);
      for (const player of room.players) {
        if (!fighterIds?.includes(player.id)) continue;
        if (!player.isBot) continue;
        const fb = nextState.frankenbeasts!;
        if (fb.roundSelections?.[player.id]) continue;
        const status = fb.combatStates[player.id];
        if (!status) continue;
        nextState = frankenBeastsGameDefinition.applyCommand({
          room,
          state: nextState,
          command: { type: "submit_fb_action", abilityId: chooseBotAbility(status) },
          context: { now, actorPlayerId: player.id }
        });
      }
    }

    return nextState;
  }
};
