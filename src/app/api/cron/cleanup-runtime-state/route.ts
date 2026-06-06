import { NextResponse } from "next/server";
import { getGameSessionService } from "@/lib/game/session-service";

export const dynamic = "force-dynamic";

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

  // TTL cleanup: only purge rows idle past the inactivity window, so live rooms
  // and recently-active sessions survive a cron run.
  await getGameSessionService().purgeStaleRuntimeState();

  return NextResponse.json({
    ok: true,
    purgedTables: [
      "room_runtime_state",
      "player_session_state",
      "room_chat_state",
      "room_presence_state"
    ]
  });
}
