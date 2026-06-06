import { FB_BODIES, FB_HEADS, FB_TAILS, getBeastAbilities } from "@/lib/game/plugins/frankenbeasts-data";
import type { FBCombatStatus } from "@/lib/types";

export const FRANKENBEASTS_BOT_KEY = "frankenbeasts_random_bot";

type Rng = () => number;

function pickRandom<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]!;
}

/** Randomly assemble a beast from one head, one body, and one tail. */
export function chooseBotParts(rng: Rng = Math.random): { headId: string; bodyId: string; tailId: string } {
  return {
    headId: pickRandom(FB_HEADS, rng).id,
    bodyId: pickRandom(FB_BODIES, rng).id,
    tailId: pickRandom(FB_TAILS, rng).id
  };
}

/** Pick a random ability (including Pass) from the bot's current beast. */
export function chooseBotAbility(status: FBCombatStatus, rng: Rng = Math.random): string {
  const abilities = getBeastAbilities(status.headId, status.bodyId, status.tailId);
  return pickRandom(abilities, rng).id;
}
