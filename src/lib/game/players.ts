import type { Room } from "@/lib/types";

/** Resolve a player's display name, falling back when the id is unknown/missing. */
export function playerName(room: Room, playerId: string | undefined, fallback = "???"): string {
  if (!playerId) return fallback;
  return room.players.find((player) => player.id === playerId)?.name ?? fallback;
}
