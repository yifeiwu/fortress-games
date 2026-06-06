import test from "node:test";
import assert from "node:assert/strict";
import { SupabaseGameStore, type RuntimeStateRepository } from "@/lib/store/supabase-store";
import {
  RuntimeStateConflictError,
  type RoomKeyedRuntimeStateRepository,
  type VersionedRoomKeyedState,
  type VersionedRoomState,
  type VersionedSessionState
} from "@/lib/supabase/runtime-state";
import type { ChatMessage, PlayerSession, Room, RoomPresence } from "@/lib/types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createRoom(code = "ABCDEF"): Room {
  const playerId = "player_1";
  return {
    code,
    gameType: "arrow_predict",
    status: "lobby",
    createdAt: 1,
    lastActivityAt: 1,
    hostPlayerId: playerId,
    players: [
      {
        id: playerId,
        name: "Host",
        isBot: false,
        isHost: true,
        connected: true,
        joinOrder: 0
      }
    ],
    chat: [],
    game: {
      gameType: "arrow_predict",
      state: "waiting",
      roundIndex: 0,
      maxRounds: 1,
      scores: { [playerId]: 0 },
      choicesByRound: {},
      rngByRound: {},
      version: 1
    }
  };
}

function createSession(id = "session_1"): PlayerSession {
  return {
    id,
    username: "Host",
    createdAt: 1,
    updatedAt: 1
  };
}

class FakeRoomKeyedRepository<T> implements RoomKeyedRuntimeStateRepository<T> {
  rows = new Map<string, VersionedRoomKeyedState<T> & { deleted?: boolean }>();

  async fetchAll(): Promise<VersionedRoomKeyedState<T>[]> {
    return [...this.rows.values()]
      .filter((row) => !row.deleted)
      .map((row) => ({ roomCode: row.roomCode, payload: clone(row.payload), version: row.version }));
  }

  async fetchOne(roomCode: string): Promise<VersionedRoomKeyedState<T> | null> {
    const row = this.rows.get(roomCode);
    if (!row || row.deleted) return null;
    return { roomCode: row.roomCode, payload: clone(row.payload), version: row.version };
  }

  async insert(roomCode: string, payload: T): Promise<number> {
    const existing = this.rows.get(roomCode);
    if (existing && !existing.deleted) {
      throw new RuntimeStateConflictError("row exists");
    }
    this.rows.set(roomCode, { roomCode, payload: clone(payload), version: (existing?.version ?? 0) + 1 });
    return this.rows.get(roomCode)!.version;
  }

  async update(roomCode: string, payload: T, expectedVersion: number): Promise<number> {
    const row = this.rows.get(roomCode);
    if (!row || row.deleted || row.version !== expectedVersion) {
      throw new RuntimeStateConflictError("row changed");
    }
    row.payload = clone(payload);
    row.version += 1;
    return row.version;
  }

  async remove(roomCode: string, expectedVersion: number): Promise<void> {
    const row = this.rows.get(roomCode);
    if (!row || row.deleted || row.version !== expectedVersion) {
      throw new RuntimeStateConflictError("row changed");
    }
    row.deleted = true;
    row.version += 1;
  }

  clear(): void {
    this.rows.clear();
  }
}

class FakeRuntimeStateRepository implements RuntimeStateRepository {
  rooms = new Map<string, VersionedRoomState & { deleted?: boolean }>();
  sessions = new Map<string, VersionedSessionState & { deleted?: boolean }>();
  chat = new FakeRoomKeyedRepository<ChatMessage[]>();
  presence = new FakeRoomKeyedRepository<RoomPresence>();
  fetchRoomsCount = 0;
  fetchRoomCount = 0;
  fetchSessionsCount = 0;
  fetchSessionCount = 0;

  async fetchRooms(): Promise<VersionedRoomState[]> {
    this.fetchRoomsCount += 1;
    return [...this.rooms.values()]
      .filter((row) => !row.deleted)
      .map((row) => ({ roomCode: row.roomCode, payload: clone(row.payload), version: row.version }));
  }

  async fetchRoom(roomCode: string): Promise<VersionedRoomState | null> {
    this.fetchRoomCount += 1;
    const row = this.rooms.get(roomCode);
    if (!row || row.deleted) return null;
    return { roomCode: row.roomCode, payload: clone(row.payload), version: row.version };
  }

  async fetchSessions(): Promise<VersionedSessionState[]> {
    this.fetchSessionsCount += 1;
    return [...this.sessions.values()]
      .filter((row) => !row.deleted)
      .map((row) => ({ sessionId: row.sessionId, payload: clone(row.payload), version: row.version }));
  }

  async fetchSession(sessionId: string): Promise<VersionedSessionState | null> {
    this.fetchSessionCount += 1;
    const row = this.sessions.get(sessionId);
    if (!row || row.deleted) return null;
    return { sessionId: row.sessionId, payload: clone(row.payload), version: row.version };
  }

  async insertRoom(roomCode: string, payload: Room): Promise<number> {
    if (this.rooms.has(roomCode)) {
      throw new RuntimeStateConflictError("room exists");
    }
    this.rooms.set(roomCode, { roomCode, payload: clone(payload), version: 1 });
    return 1;
  }

  async updateRoom(roomCode: string, payload: Room, expectedVersion: number): Promise<number> {
    const row = this.rooms.get(roomCode);
    if (!row || row.deleted || row.version !== expectedVersion) {
      throw new RuntimeStateConflictError("room changed");
    }
    row.payload = clone(payload);
    row.version += 1;
    return row.version;
  }

  async deleteRoom(roomCode: string, expectedVersion: number): Promise<void> {
    const row = this.rooms.get(roomCode);
    if (!row || row.deleted || row.version !== expectedVersion) {
      throw new RuntimeStateConflictError("room changed");
    }
    row.deleted = true;
    row.version += 1;
  }

  async insertSession(sessionId: string, payload: PlayerSession): Promise<number> {
    if (this.sessions.has(sessionId)) {
      throw new RuntimeStateConflictError("session exists");
    }
    this.sessions.set(sessionId, { sessionId, payload: clone(payload), version: 1 });
    return 1;
  }

  async updateSession(sessionId: string, payload: PlayerSession, expectedVersion: number): Promise<number> {
    const row = this.sessions.get(sessionId);
    if (!row || row.deleted || row.version !== expectedVersion) {
      throw new RuntimeStateConflictError("session changed");
    }
    row.payload = clone(payload);
    row.version += 1;
    return row.version;
  }

  async deleteSession(sessionId: string, expectedVersion: number): Promise<void> {
    const row = this.sessions.get(sessionId);
    if (!row || row.deleted || row.version !== expectedVersion) {
      throw new RuntimeStateConflictError("session changed");
    }
    row.deleted = true;
    row.version += 1;
  }

  async clearRooms(): Promise<void> {
    this.rooms.clear();
    this.chat.clear();
    this.presence.clear();
  }

  async clear(): Promise<void> {
    this.rooms.clear();
    this.sessions.clear();
    this.chat.clear();
    this.presence.clear();
  }
}

test("SupabaseGameStore inserts and updates changed rows with optimistic versions", async () => {
  const repo = new FakeRuntimeStateRepository();
  const store = new SupabaseGameStore(repo);

  await store.hydrate(true);
  store.rooms.set("ABCDEF", createRoom());
  store.sessions.set("session_1", createSession());
  await store.persist();

  assert.equal(repo.rooms.get("ABCDEF")?.version, 1);
  assert.equal(repo.sessions.get("session_1")?.version, 1);

  store.rooms.get("ABCDEF")!.chat.push({
    id: "msg_1",
    playerId: "player_1",
    playerName: "Host",
    content: "hello",
    createdAt: new Date(0).toISOString()
  });
  store.sessions.get("session_1")!.updatedAt = 2;
  await store.persist();

  assert.equal(repo.rooms.get("ABCDEF")?.version, 2);
  assert.equal(repo.sessions.get("session_1")?.version, 2);
});

test("chat and presence persist independently of the room version", async () => {
  const repo = new FakeRuntimeStateRepository();
  const store = new SupabaseGameStore(repo);

  await store.hydrate(true);
  store.rooms.set("ABCDEF", createRoom());
  store.chats.set("ABCDEF", []);
  store.presence.set("ABCDEF", { player_1: 1 });
  await store.persist();

  assert.equal(repo.rooms.get("ABCDEF")?.version, 1);
  assert.equal(repo.chat.rows.get("ABCDEF")?.version, 1);
  assert.equal(repo.presence.rows.get("ABCDEF")?.version, 1);

  // A chat message and a heartbeat must not re-version the room row.
  store.chats.get("ABCDEF")!.push({
    id: "msg_1",
    playerId: "player_1",
    playerName: "Host",
    content: "hello",
    createdAt: new Date(0).toISOString()
  });
  store.presence.set("ABCDEF", { player_1: 2 });
  await store.persist();

  assert.equal(repo.rooms.get("ABCDEF")?.version, 1);
  assert.equal(repo.chat.rows.get("ABCDEF")?.version, 2);
  assert.equal(repo.presence.rows.get("ABCDEF")?.version, 2);
});

test("deleting a room soft-deletes its chat and presence rows", async () => {
  const repo = new FakeRuntimeStateRepository();
  const store = new SupabaseGameStore(repo);

  await store.hydrate(true);
  store.rooms.set("ABCDEF", createRoom());
  store.chats.set("ABCDEF", []);
  store.presence.set("ABCDEF", { player_1: 1 });
  await store.persist();

  store.deleteRoom("ABCDEF");
  await store.persist();

  assert.equal(repo.rooms.get("ABCDEF")?.deleted, true);
  assert.equal(repo.chat.rows.get("ABCDEF")?.deleted, true);
  assert.equal(repo.presence.rows.get("ABCDEF")?.deleted, true);
});

test("SupabaseGameStore can hard clear room-owned rows without clearing sessions", async () => {
  const repo = new FakeRuntimeStateRepository();
  repo.rooms.set("ABCDEF", { roomCode: "ABCDEF", payload: createRoom("ABCDEF"), version: 1 });
  repo.sessions.set("session_1", { sessionId: "session_1", payload: createSession("session_1"), version: 1 });
  repo.chat.rows.set("ABCDEF", { roomCode: "ABCDEF", payload: [], version: 1 });
  repo.presence.rows.set("ABCDEF", { roomCode: "ABCDEF", payload: { player_1: 1 }, version: 1 });
  const store = new SupabaseGameStore(repo);

  await store.hydrate(true);
  await store.clearRooms();

  assert.equal(repo.rooms.size, 0);
  assert.equal(repo.chat.rows.size, 0);
  assert.equal(repo.presence.rows.size, 0);
  assert.equal(repo.sessions.size, 1);
  assert.deepEqual([...store.rooms.keys()], []);
  assert.deepEqual([...store.sessions.keys()], ["session_1"]);
});

test("SupabaseGameStore soft-deletes rows using the last hydrated version", async () => {
  const repo = new FakeRuntimeStateRepository();
  repo.rooms.set("ABCDEF", { roomCode: "ABCDEF", payload: createRoom(), version: 1 });
  repo.sessions.set("session_1", { sessionId: "session_1", payload: createSession(), version: 1 });
  const store = new SupabaseGameStore(repo);

  await store.hydrate(true);
  store.deleteRoom("ABCDEF");
  store.deleteSession("session_1");
  await store.persist();

  assert.equal(repo.rooms.get("ABCDEF")?.deleted, true);
  assert.equal(repo.sessions.get("session_1")?.deleted, true);
});

test("SupabaseGameStore surfaces version conflicts and rehydrates latest state", async () => {
  const repo = new FakeRuntimeStateRepository();
  repo.rooms.set("ABCDEF", { roomCode: "ABCDEF", payload: createRoom(), version: 1 });
  const store = new SupabaseGameStore(repo);

  await store.hydrate(true);
  await repo.updateRoom("ABCDEF", { ...createRoom(), lastActivityAt: 99 }, 1);
  store.rooms.get("ABCDEF")!.lastActivityAt = 2;

  await assert.rejects(() => store.persist(), RuntimeStateConflictError);
  assert.equal(store.rooms.get("ABCDEF")?.lastActivityAt, 99);
});

test("SupabaseGameStore can hydrate one room and one session without loading all rows", async () => {
  const repo = new FakeRuntimeStateRepository();
  repo.rooms.set("ABCDEF", { roomCode: "ABCDEF", payload: createRoom("ABCDEF"), version: 1 });
  repo.rooms.set("GHIJKL", { roomCode: "GHIJKL", payload: createRoom("GHIJKL"), version: 1 });
  repo.sessions.set("session_1", { sessionId: "session_1", payload: createSession("session_1"), version: 1 });
  repo.sessions.set("session_2", { sessionId: "session_2", payload: createSession("session_2"), version: 1 });
  const store = new SupabaseGameStore(repo);

  await store.hydrateRoom("ABCDEF", true);
  await store.hydrateSession("session_1", true);

  assert.equal(repo.fetchRoomsCount, 0);
  assert.equal(repo.fetchSessionsCount, 0);
  assert.equal(repo.fetchRoomCount, 1);
  assert.equal(repo.fetchSessionCount, 1);
  assert.deepEqual([...store.rooms.keys()], ["ABCDEF"]);
  assert.deepEqual([...store.sessions.keys()], ["session_1"]);
});
