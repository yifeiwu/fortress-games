import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGameSessionService } from "@/lib/game/session-service";
import { listSupportedGameTypes } from "@/lib/game/registry";
import { publishRoomAndLobby } from "@/lib/supabase/realtime";
import { isRuntimeStateConflictError } from "@/lib/supabase/runtime-state";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET() {
  const service = getGameSessionService();
  return NextResponse.json({
    rooms: await service.listRooms(),
    gameTypes: listSupportedGameTypes()
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "create" | "join";
    roomCode?: string;
    gameType?: string;
    username?: string;
  };
  const service = getGameSessionService();
  const cookieStore = cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session. Set a name first." }, { status: 401 });
  }

  try {
    if (body.username?.trim()) {
      await service.setSessionUsername(sessionId, body.username);
    }
    if (body.action === "create") {
      const gameType = body.gameType || "arrow_predict";
      const room = await service.createRoomForSession(sessionId, gameType);
      await publishRoomAndLobby(room.code, "ROOM_UPDATED");
      return NextResponse.json({ room });
    }
    if (body.action === "join" && body.roomCode) {
      const room = await service.joinRoomForSession(sessionId, body.roomCode.toUpperCase());
      await publishRoomAndLobby(room.code, "ROOM_UPDATED");
      return NextResponse.json({ room });
    }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    if (isRuntimeStateConflictError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Failed to process room action.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
