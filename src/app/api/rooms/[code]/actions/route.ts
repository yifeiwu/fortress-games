import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGameSessionService } from "@/lib/game/session-service";
import { publishRoomAndLobby, publishRoomEvent } from "@/lib/supabase/realtime";
import { isRuntimeStateConflictError } from "@/lib/supabase/runtime-state";
import { SESSION_COOKIE_NAME } from "@/lib/session";

type RoomAction =
  | "leave"
  | "chat"
  | "start_game"
  | "restart_game"
  | "add_bot"
  | "heartbeat";

export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  const body = (await request.json()) as {
    action?: RoomAction | string;
    content?: string;
    direction?: string;
    spaceshipAction?: string;
    targetThreatId?: string;
    quantity?: number;
    face?: number;
  };
  const service = getGameSessionService();
  const roomCode = params.code.toUpperCase();
  const sessionId = cookies().get(SESSION_COOKIE_NAME)?.value;

  try {
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session." }, { status: 401 });
    }
    if (body.action === "leave") {
      const room = await service.leaveRoomForSession(roomCode, sessionId);
      await publishRoomAndLobby(roomCode, "ROOM_UPDATED");
      return NextResponse.json({ room });
    }
    if (body.action === "chat" && body.content) {
      const room = await service.sendChatForSession(roomCode, sessionId, body.content);
      await publishRoomEvent(roomCode, "CHAT_CREATED");
      return NextResponse.json({ room });
    }
    if (body.action === "start_game") {
      const room = await service.startGameForSession(roomCode, sessionId);
      await publishRoomAndLobby(roomCode, "GAME_UPDATED", "ROOM_UPDATED");
      return NextResponse.json({ room });
    }
    if (body.action === "restart_game") {
      const room = await service.restartGameForSession(roomCode, sessionId);
      await publishRoomAndLobby(roomCode, "GAME_UPDATED", "ROOM_UPDATED");
      return NextResponse.json({ room });
    }
    if (body.action === "add_bot") {
      const room = await service.addBotForSession(roomCode, sessionId);
      await publishRoomAndLobby(roomCode, "ROOM_UPDATED");
      return NextResponse.json({ room });
    }
    if (body.action === "heartbeat") {
      await service.heartbeatForSession(roomCode, sessionId);
      return NextResponse.json({ ok: true });
    }
    if (body.action) {
      const room = await service.submitGameActionForSession(roomCode, sessionId, body);
      await publishRoomEvent(roomCode, "GAME_UPDATED");
      return NextResponse.json({ room });
    }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    if (isRuntimeStateConflictError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Room action failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
