// Barrel for the shared domain types. Types are split by ownership — core
// room/session/game-state shapes in `room`, and each game's state + phases in
// `games/*` — and re-exported here so `@/lib/types` stays the single import
// surface for the rest of the app.

export * from "@/lib/types/room";
export * from "@/lib/types/games/arrow";
export * from "@/lib/types/games/spaceship";
export * from "@/lib/types/games/frankenbeasts";
export * from "@/lib/types/games/tarot";
export * from "@/lib/types/games/liars-dice";
