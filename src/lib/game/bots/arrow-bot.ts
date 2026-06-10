import type { BotRuntimeContext, BotStrategy } from "@/lib/game/contracts";
import type { Direction } from "@/lib/types";
import { mulberry32, stringToSeed } from "@/lib/game/rng";
import { ARROW_DIRECTIONS } from "@/lib/game/plugins/arrow-game-rules";

export const arrowBotStrategy: BotStrategy = {
  gameType: "arrow_predict",
  botKey: "arrow_random_bot",
  chooseDirection(ctx: BotRuntimeContext): Direction {
    const rngRecord = ctx.state.rngByRound[ctx.state.roundIndex];
    const seedSource = `${rngRecord?.seedPlain ?? "fallback"}:${ctx.botPlayerId}:${ctx.room.code}:${ctx.state.roundIndex}`;
    const rand = mulberry32(stringToSeed(seedSource));
    const leaderId = ctx.state.leaderPlayerId;
    const leaderDirection = leaderId ? ctx.roundChoices[leaderId]?.direction : undefined;
    // Non-leader bots can see the leader's committed direction in round state.
    // Prefer dodging it most of the time while keeping some bluffy variety.
    if (leaderId && leaderId !== ctx.botPlayerId && leaderDirection) {
      if (rand() < 0.8) {
        const dodgePool = ARROW_DIRECTIONS.filter((direction) => direction !== leaderDirection);
        return dodgePool[Math.floor(rand() * dodgePool.length)];
      }
      return leaderDirection;
    }
    return ARROW_DIRECTIONS[Math.floor(rand() * ARROW_DIRECTIONS.length)];
  }
};
