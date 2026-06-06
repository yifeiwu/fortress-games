import { getGameDefinition } from "@/lib/game/registry";
import type { GameState, Player, Room } from "@/lib/types";
import { randomId } from "@/lib/utils/ids";

/**
 * Pure room/game mechanics: helpers that operate purely on the room/game/player
 * values passed in (plus the game registry) without any store or session
 * coupling. Pulled out of GameSessionService so the service is left to
 * orchestrate persistence rather than also own the rules.
 */

export function createPlayer(name: string, isHost: boolean, joinOrder: number, isBot = false): Player {
  return {
    id: randomId(isBot ? "bot" : "player"),
    name,
    isBot,
    isHost,
    connected: true,
    joinOrder
  };
}

/**
 * Reconciles the score map with the current roster: seeds missing players at 0,
 * drops players who left, and (while still waiting) tracks the round count to
 * the player count. Bumps the game version so the change propagates.
 */
export function refreshPlayerScores(game: GameState, players: Player[]): GameState {
  const nextScores = { ...game.scores };
  players.forEach((player) => {
    if (typeof nextScores[player.id] !== "number") {
      nextScores[player.id] = 0;
    }
  });
  Object.keys(nextScores).forEach((playerId) => {
    if (!players.find((player) => player.id === playerId)) {
      delete nextScores[playerId];
    }
  });
  return {
    ...game,
    maxRounds: game.state === "waiting" ? Math.max(1, players.length) : game.maxRounds,
    scores: nextScores,
    version: game.version + 1
  };
}

export function chooseRandomHuman(room: Room, excludePlayerId?: string): Player | undefined {
  const humans = room.players.filter((player) => !player.isBot && player.id !== excludePlayerId);
  if (!humans.length) return undefined;
  const idx = Math.floor(Math.random() * humans.length);
  return humans[idx];
}

/**
 * Ensures the room has a valid human host, preferring `preferredHostId`, then
 * the current host, then any human. Ends the room when no humans remain.
 */
export function normalizeHost(room: Room, preferredHostId?: string): void {
  const humans = room.players.filter((player) => !player.isBot);
  if (!humans.length) {
    room.status = "ended";
    return;
  }

  const nextHost =
    (preferredHostId ? humans.find((player) => player.id === preferredHostId) : undefined) ??
    humans.find((player) => player.id === room.hostPlayerId) ??
    chooseRandomHuman(room);

  if (!nextHost) {
    room.status = "ended";
    return;
  }

  room.hostPlayerId = nextHost.id;
  room.players = room.players.map((player) => ({
    ...player,
    isHost: player.id === nextHost.id
  }));
}

/** Lets the active game plugin take any pending bot turns. */
export function applyGameBots(room: Room): void {
  const definition = getGameDefinition(room.gameType);
  if (!definition.applyBots) return;
  room.game = definition.applyBots({ room, state: room.game, now: Date.now() });
}

/**
 * Advances a time-driven game whose round deadline has passed, recursing while
 * rounds keep advancing. Guards against a plugin that returns an unchanged state
 * on an expired deadline (which would otherwise loop forever).
 */
export function maybeCloseRound(room: Room): void {
  const definition = getGameDefinition(room.gameType);
  if (!definition.shouldAdvanceTime?.(room.game)) {
    return;
  }
  const now = Date.now();
  const expired = Boolean(room.game.roundDeadlineAt && now >= room.game.roundDeadlineAt);
  if (!expired) return;
  const beforeVersion = room.game.version;
  const result = definition.closeRound({ room, state: room.game, now });
  room.game = result.nextState;
  if (room.game.state === "finished") {
    room.status = "in_game";
  } else if (room.game.version !== beforeVersion && definition.shouldAdvanceTime?.(room.game)) {
    applyGameBots(room);
    maybeCloseRound(room);
  }
}
