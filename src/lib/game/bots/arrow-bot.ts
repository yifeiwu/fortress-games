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
    return ARROW_DIRECTIONS[Math.floor(rand() * ARROW_DIRECTIONS.length)];
  }
};
