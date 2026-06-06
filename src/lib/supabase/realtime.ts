import { getSupabaseServerConfig } from "@/lib/supabase/server";

interface BroadcastMessage {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
}

/**
 * Publishes one or more broadcast messages via Supabase Realtime's HTTP
 * endpoint. Unlike the websocket client, this needs no subscribe handshake, so
 * several topics can be delivered in a single request off the action's critical
 * path. Failures are swallowed: a dropped notification only delays a client
 * refresh, it must never fail the underlying game action.
 */
async function sendBroadcast(messages: BroadcastMessage[]): Promise<void> {
  if (!messages.length) return;
  let config: { url: string; serviceKey: string };
  try {
    config = getSupabaseServerConfig();
  } catch {
    return;
  }
  try {
    const response = await fetch(`${config.url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`
      },
      body: JSON.stringify({
        messages: messages.map((message) => ({ ...message, private: false }))
      }),
      cache: "no-store"
    });
    if (!response.ok) {
      console.warn(`Realtime broadcast failed with status ${response.status}.`);
    }
  } catch (error) {
    console.warn("Realtime broadcast request failed.", error);
  }
}

function buildPayload(event: string, roomCode?: string) {
  return { roomCode, event, at: new Date().toISOString() };
}

export async function publishRoomEvent(roomCode: string, event: string) {
  await sendBroadcast([{ topic: `room:${roomCode}`, event, payload: buildPayload(event, roomCode) }]);
}

export async function publishLobbyEvent(event: string, roomCode?: string) {
  await sendBroadcast([{ topic: "lobby", event, payload: buildPayload(event, roomCode) }]);
}

/** Notifies both the room channel and the lobby channel in a single request. */
export async function publishRoomAndLobby(roomCode: string, roomEvent: string, lobbyEvent: string = roomEvent) {
  await sendBroadcast([
    { topic: `room:${roomCode}`, event: roomEvent, payload: buildPayload(roomEvent, roomCode) },
    { topic: "lobby", event: lobbyEvent, payload: buildPayload(lobbyEvent, roomCode) }
  ]);
}
