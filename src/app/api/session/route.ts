import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGameSessionService } from "@/lib/game/session-service";
import { createSessionId, SESSION_COOKIE_NAME } from "@/lib/session";
import { isRuntimeStateConflictError } from "@/lib/supabase/runtime-state";

function ensureSessionId(): string {
  const cookieStore = cookies();
  const existing = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (existing) {
    return existing;
  }
  return createSessionId();
}

export async function GET() {
  const service = getGameSessionService();
  const sessionId = ensureSessionId();
  const session = await service.getSession(sessionId);
  const response = NextResponse.json({
    session: {
      username: session.username ?? null,
      roomCode: session.roomCode ?? null
    }
  });
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return response;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string };
  const username = body.username?.trim();
  if (!username) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  try {
    const service = getGameSessionService();
    const sessionId = ensureSessionId();
    const session = await service.setSessionUsername(sessionId, username);
    const response = NextResponse.json({
      session: {
        username: session.username ?? null,
        roomCode: session.roomCode ?? null
      }
    });
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
    return response;
  } catch (error) {
    if (isRuntimeStateConflictError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Could not set name.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
