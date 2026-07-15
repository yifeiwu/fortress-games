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

  // TTL cleanup: purge rows idle past the inactivity window, so live rooms and
  // recently-active sessions survive a cron run.
  await service.purgeStaleRuntimeState();

  // Hard cap: after the TTL sweep, keep only the newest rooms and drop the rest
  // (with their chat/presence rows) so the fleet never grows unbounded. Vercel's
  // Hobby plan only runs one cron per day, so both steps share this endpoint.
  const prunedRooms = await service.pruneRoomsToNewest(ROOMS_TO_KEEP);

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
