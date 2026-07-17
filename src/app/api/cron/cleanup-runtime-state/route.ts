import { NextResponse } from "next/server";
import { getGameSessionService } from "@/lib/game/session-service";

export const dynamic = "force-dynamic";

const ROOMS_TO_KEEP = 10;

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const service = getGameSessionService();

  // TTL sweep + hard cap in one pass. The same routine also runs opportunistically
  // when a player leaves a room, so cleanup happens even if this cron doesn't fire.
  const prunedRooms = await service.runRoutineCleanup(ROOMS_TO_KEEP);

  return NextResponse.json({
    ok: true,
    keptRooms: ROOMS_TO_KEEP,
    prunedRooms,
    purgedTables: [
      "room_runtime_state",
      "player_session_state",
      "room_chat_state",
      "room_presence_state"
    ]
  });
}
