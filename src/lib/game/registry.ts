import type { GameDefinition } from "@/lib/game/contracts";
import { arrowGameDefinition } from "@/lib/game/plugins/arrow-game";
import { frankenBeastsGameDefinition } from "@/lib/game/plugins/frankenbeasts-game";
import { liarsDiceGameDefinition } from "@/lib/game/plugins/liars-dice-game";
import { spaceshipDefenseGameDefinition } from "@/lib/game/plugins/spaceship-defense-game";
import { tarotGameDefinition } from "@/lib/game/plugins/tarot-game";

const gameRegistry = new Map<string, GameDefinition>([
  [arrowGameDefinition.gameType, arrowGameDefinition],
  [spaceshipDefenseGameDefinition.gameType, spaceshipDefenseGameDefinition],
  [frankenBeastsGameDefinition.gameType, frankenBeastsGameDefinition],
  [tarotGameDefinition.gameType, tarotGameDefinition],
  [liarsDiceGameDefinition.gameType, liarsDiceGameDefinition]
]);

export function getGameDefinition(gameType: string): GameDefinition {
  const game = gameRegistry.get(gameType);
  if (!game) {
    throw new Error(`Unknown game type: ${gameType}`);
  }
  return game;
}

export function listSupportedGameTypes(): string[] {
  return [...gameRegistry.keys()];
}
