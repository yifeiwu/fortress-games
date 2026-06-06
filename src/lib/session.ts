import { randomUUID } from "crypto";
import type { PlayerSession } from "@/lib/types";

export const SESSION_COOKIE_NAME = "fortress_session_id";

export function createSessionId(): string {
  return randomUUID();
}

export function createEmptySession(id: string): PlayerSession {
  const now = Date.now();
  return {
    id,
    createdAt: now,
    updatedAt: now
  };
}
