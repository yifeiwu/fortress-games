import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGameSessionService } from "@/lib/game/session-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { isRuntimeStateConflictError } from "@/lib/supabase/runtime-state";

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  const service = getGameSessionService();
  try {
    const sessionId = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session." }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const knownGameVersion = searchParams.get("gv");
    const knownChatCount = searchParams.get("cc");
    const knownViewerPlayerId = searchParams.get("vp");
    const knownRoomStatus = searchParams.get("rs");
    const knownHostPlayerId = searchParams.get("hp");
    const knownPresenceSignature = searchParams.get("ps");
    const hasFingerprint =
      knownGameVersion !== null &&
      knownChatCount !== null &&
      knownViewerPlayerId !== null &&
      knownRoomStatus !== null &&
      knownHostPlayerId !== null &&
      knownPresenceSignature !== null;
    const result = hasFingerprint
      ? await service.getRoomForSessionConditional(params.code.toUpperCase(), sessionId, {
          gameVersion: Number(knownGameVersion),
          chatCount: Number(knownChatCount),
          viewerPlayerId: knownViewerPlayerId === "" ? null : knownViewerPlayerId,
          roomStatus: knownRoomStatus as "lobby" | "in_game" | "ended",
          hostPlayerId: knownHostPlayerId,
          playerPresenceSignature: knownPresenceSignature
        })
      : await service.getRoomForSession(params.code.toUpperCase(), sessionId);
    return NextResponse.json(result);
  } catch (error) {
    if (isRuntimeStateConflictError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Room fetch failed.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
