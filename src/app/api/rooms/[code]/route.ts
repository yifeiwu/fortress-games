import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGameSessionService } from "@/lib/game/session-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { isRuntimeStateConflictError } from "@/lib/supabase/runtime-state";

export async function GET(
  _request: Request,
  { params }: { params: { code: string } }
) {
  const service = getGameSessionService();
  try {
    const sessionId = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session." }, { status: 401 });
    }
    const result = await service.getRoomForSession(params.code.toUpperCase(), sessionId);
    return NextResponse.json(result);
  } catch (error) {
    if (isRuntimeStateConflictError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Room fetch failed.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
