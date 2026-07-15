import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ChatMessage, PlayerSession, Room, RoomPresence } from "@/lib/types";

export class RuntimeStateConflictError extends Error {
  constructor(message = "Runtime state was modified by another request.") {
    super(message);
    this.name = "RuntimeStateConflictError";
  }
}

export function isRuntimeStateConflictError(error: unknown): error is RuntimeStateConflictError {
  return error instanceof RuntimeStateConflictError;
}

export interface VersionedRoomState {
  roomCode: string;
  payload: Room;
  version: number;
}

export interface VersionedSessionState {
  sessionId: string;
  payload: PlayerSession;
  version: number;
}

/**
 * A versioned, room-code-keyed row. Used for satellite room state that lives in
 * its own table (chat, presence) so writes to it don't contend with the main
 * room runtime state's optimistic version.
 */
export interface VersionedRoomKeyedState<T> {
  roomCode: string;
  payload: T;
  version: number;
}

const RECENT_ROOMS_TO_KEEP = 10;

interface RuntimeRow<T> {
  payload: T;
  version: number;
}

interface DeletedRuntimeRow {
  version: number;
  deleted_at: string | null;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

// ─── Generic versioned runtime-state CRUD ────────────────────────────────────

/** A versioned row keyed by an arbitrary primary-key column. */
interface VersionedRow<T> {
  key: string;
  payload: T;
  version: number;
}

/**
 * Optimistically-locked CRUD over a soft-deletable, versioned runtime table.
 * Every runtime table (rooms, sessions, chat, presence) shares these exact
 * semantics — they differ only by table name, key column, and payload type —
 * so they're all built from this single factory.
 *
 * - `insert` revives a soft-deleted row so a reused key can re-create its state.
 * - `update`/`remove` require the expected version and raise a
 *   {@link RuntimeStateConflictError} when another writer got there first.
 */
interface VersionedRuntimeStateRepository<T> {
  fetchAll(): Promise<VersionedRow<T>[]>;
  fetchOne(key: string): Promise<VersionedRow<T> | null>;
  insert(key: string, payload: T): Promise<number>;
  update(key: string, payload: T, expectedVersion: number): Promise<number>;
  remove(key: string, expectedVersion: number): Promise<void>;
}

function createVersionedRuntimeState<T>(table: string, keyColumn: string): VersionedRuntimeStateRepository<T> {
  const selectColumns = `${keyColumn},payload,version`;

  function rowKey(row: Record<string, unknown>): string {
    return row[keyColumn] as string;
  }

  async function reviveDeleted(key: string, payload: T): Promise<number> {
    const client = getSupabaseServerClient();
    const { data: existing, error: fetchError } = await client
      .from(table)
      .select("version,deleted_at")
      .eq(keyColumn, key)
      .single<DeletedRuntimeRow>();
    if (fetchError) {
      throw new Error(`Failed to inspect existing ${table}: ${fetchError.message}`);
    }
    if (!existing.deleted_at) {
      throw new RuntimeStateConflictError(`${table} ${key} already exists.`);
    }
    const { data, error } = await client
      .from(table)
      .update({
        payload,
        version: existing.version + 1,
        deleted_at: null,
        updated_at: new Date().toISOString()
      })
      .eq(keyColumn, key)
      .eq("version", existing.version)
      .not("deleted_at", "is", null)
      .select("version")
      .maybeSingle<RuntimeRow<T>>();
    if (error) {
      throw new Error(`Failed to revive ${table}: ${error.message}`);
    }
    if (!data) {
      throw new RuntimeStateConflictError(`${table} ${key} changed before it could be revived.`);
    }
    return data.version;
  }

  return {
    async fetchAll() {
      const client = getSupabaseServerClient();
      const { data, error } = await client.from(table).select(selectColumns).is("deleted_at", null);
      if (error) {
        throw new Error(`Failed to fetch ${table}: ${error.message}`);
      }
      return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
        key: rowKey(row),
        payload: row.payload as T,
        version: row.version as number
      }));
    },
    async fetchOne(key: string) {
      const client = getSupabaseServerClient();
      const { data, error } = await client
        .from(table)
        .select(selectColumns)
        .eq(keyColumn, key)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to fetch ${table}: ${error.message}`);
      }
      if (!data) {
        return null;
      }
      const row = data as unknown as Record<string, unknown>;
      return { key: rowKey(row), payload: row.payload as T, version: row.version as number };
    },
    async insert(key: string, payload: T) {
      const client = getSupabaseServerClient();
      const { data, error } = await client
        .from(table)
        .insert({
          [keyColumn]: key,
          payload,
          version: 1,
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .select("version")
        .single<RuntimeRow<T>>();
      if (error) {
        if (isUniqueViolation(error)) {
          return reviveDeleted(key, payload);
        }
        throw new Error(`Failed to insert ${table}: ${error.message}`);
      }
      return data.version;
    },
    async update(key: string, payload: T, expectedVersion: number) {
      const client = getSupabaseServerClient();
      const { data, error } = await client
        .from(table)
        .update({
          payload,
          version: expectedVersion + 1,
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq(keyColumn, key)
        .eq("version", expectedVersion)
        .is("deleted_at", null)
        .select("version")
        .maybeSingle<RuntimeRow<T>>();
      if (error) {
        throw new Error(`Failed to update ${table}: ${error.message}`);
      }
      if (!data) {
        throw new RuntimeStateConflictError(`${table} ${key} changed before it could be saved.`);
      }
      return data.version;
    },
    async remove(key: string, expectedVersion: number) {
      const client = getSupabaseServerClient();
      const { data, error } = await client
        .from(table)
        .update({
          version: expectedVersion + 1,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq(keyColumn, key)
        .eq("version", expectedVersion)
        .is("deleted_at", null)
        .select("version")
        .maybeSingle<RuntimeRow<T>>();
      if (error) {
        throw new Error(`Failed to delete ${table}: ${error.message}`);
      }
      if (!data) {
        throw new RuntimeStateConflictError(`${table} ${key} changed before it could be deleted.`);
      }
    }
  };
}

// ─── Room & session runtime state (adapters over the generic CRUD) ────────────

const roomRuntimeState = createVersionedRuntimeState<Room>("room_runtime_state", "room_code");
const sessionRuntimeState = createVersionedRuntimeState<PlayerSession>("player_session_state", "session_id");

export async function fetchRoomRuntimeStates(): Promise<VersionedRoomState[]> {
  const rows = await roomRuntimeState.fetchAll();
  return rows.map((row) => ({ roomCode: row.key, payload: row.payload, version: row.version }));
}

export async function fetchRoomRuntimeState(roomCode: string): Promise<VersionedRoomState | null> {
  const row = await roomRuntimeState.fetchOne(roomCode);
  return row ? { roomCode: row.key, payload: row.payload, version: row.version } : null;
}

export function insertRoomRuntimeState(roomCode: string, payload: Room): Promise<number> {
  return roomRuntimeState.insert(roomCode, payload);
}

export function updateRoomRuntimeState(roomCode: string, payload: Room, expectedVersion: number): Promise<number> {
  return roomRuntimeState.update(roomCode, payload, expectedVersion);
}

export function deleteRoomRuntimeState(roomCode: string, expectedVersion: number): Promise<void> {
  return roomRuntimeState.remove(roomCode, expectedVersion);
}

export async function fetchSessionRuntimeStates(): Promise<VersionedSessionState[]> {
  const rows = await sessionRuntimeState.fetchAll();
  return rows.map((row) => ({ sessionId: row.key, payload: row.payload, version: row.version }));
}

export async function fetchSessionRuntimeState(sessionId: string): Promise<VersionedSessionState | null> {
  const row = await sessionRuntimeState.fetchOne(sessionId);
  return row ? { sessionId: row.key, payload: row.payload, version: row.version } : null;
}

export function insertSessionRuntimeState(sessionId: string, payload: PlayerSession): Promise<number> {
  return sessionRuntimeState.insert(sessionId, payload);
}

export function updateSessionRuntimeState(sessionId: string, payload: PlayerSession, expectedVersion: number): Promise<number> {
  return sessionRuntimeState.update(sessionId, payload, expectedVersion);
}

export function deleteSessionRuntimeState(sessionId: string, expectedVersion: number): Promise<void> {
  return sessionRuntimeState.remove(sessionId, expectedVersion);
}

// ─── Bulk cleanup ────────────────────────────────────────────────────────────

/**
 * Hard-deletes runtime rows last touched before `olderThanIso` across every
 * runtime table (rooms, sessions, chat, presence). This is the TTL-based
 * cleanup the cron uses instead of wiping the tables wholesale.
 *
 * A room's own row can sit idle while players are still present (e.g. a long
 * lobby wait where only heartbeats fire), so rooms with a recent presence row
 * are excluded from the room purge even when their payload hasn't changed.
 */
export async function purgeStaleRuntimeStateRows(olderThanIso: string): Promise<void> {
  const client = getSupabaseServerClient();

  const { data: freshPresence, error: presenceError } = await client
    .from("room_presence_state")
    .select("room_code")
    .gte("updated_at", olderThanIso)
    .is("deleted_at", null);
  if (presenceError) {
    throw new Error(`Failed to read active presence: ${presenceError.message}`);
  }
  const activeRoomCodes = [...new Set((freshPresence ?? []).map((row) => row.room_code as string))];

  const { data: recentRooms, error: recentRoomsError } = await client
    .from("room_runtime_state")
    .select("room_code")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(RECENT_ROOMS_TO_KEEP);
  if (recentRoomsError) {
    throw new Error(`Failed to read recent rooms: ${recentRoomsError.message}`);
  }
  const recentRoomCodes = [...new Set((recentRooms ?? []).map((row) => row.room_code as string))];
  const protectedRoomCodes = [...new Set([...activeRoomCodes, ...recentRoomCodes])];

  let staleRoomQuery = client
    .from("room_runtime_state")
    .select("room_code")
    .is("deleted_at", null)
    .lt("updated_at", olderThanIso);
  if (protectedRoomCodes.length) {
    // room_code is constrained to ^[A-Z]{6}$, so this list is safe to inline.
    staleRoomQuery = staleRoomQuery.not("room_code", "in", `(${protectedRoomCodes.join(",")})`);
  }
  const { data: staleRooms, error: staleRoomsError } = await staleRoomQuery;
  if (staleRoomsError) {
    throw new Error(`Failed to read stale room runtime state: ${staleRoomsError.message}`);
  }
  const staleRoomCodes = [...new Set((staleRooms ?? []).map((row) => row.room_code as string))];

  const [rooms, chats, presence, sessions] = await Promise.all([
    staleRoomCodes.length ? client.from("room_runtime_state").delete().in("room_code", staleRoomCodes) : Promise.resolve({ error: null }),
    staleRoomCodes.length ? client.from("room_chat_state").delete().in("room_code", staleRoomCodes) : Promise.resolve({ error: null }),
    staleRoomCodes.length ? client.from("room_presence_state").delete().in("room_code", staleRoomCodes) : Promise.resolve({ error: null }),
    client.from("player_session_state").delete().lt("updated_at", olderThanIso)
  ]);
  if (rooms.error) {
    throw new Error(`Failed to purge stale room runtime state: ${rooms.error.message}`);
  }
  if (chats.error) {
    throw new Error(`Failed to purge stale room chat state: ${chats.error.message}`);
  }
  if (presence.error) {
    throw new Error(`Failed to purge stale room presence state: ${presence.error.message}`);
  }
  if (sessions.error) {
    throw new Error(`Failed to purge stale session runtime state: ${sessions.error.message}`);
  }
}

/**
 * Hard-deletes every room except the {@link RECENT_ROOMS_TO_KEEP} most-recently
 * touched ones, along with their chat and presence rows. Unlike
 * {@link purgeStaleRuntimeStateRows} (which only reaps idle rooms past the TTL),
 * this enforces a hard cap on the room fleet so the table never keeps more than
 * the newest N rooms.
 *
 * Rooms with a presence row touched at/after `activeSinceIso` are always
 * protected, even when they fall outside the newest N, so a busy room mid-game
 * is never pruned out from under its players.
 *
 * Returns the number of rooms that were pruned.
 */
export async function pruneRoomsKeepingNewest(
  keep: number = RECENT_ROOMS_TO_KEEP,
  activeSinceIso?: string
): Promise<number> {
  const client = getSupabaseServerClient();

  const { data: recentRooms, error: recentRoomsError } = await client
    .from("room_runtime_state")
    .select("room_code")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(keep);
  if (recentRoomsError) {
    throw new Error(`Failed to read recent rooms: ${recentRoomsError.message}`);
  }
  const recentRoomCodes = (recentRooms ?? []).map((row) => row.room_code as string);

  let activeRoomCodes: string[] = [];
  if (activeSinceIso) {
    const { data: freshPresence, error: presenceError } = await client
      .from("room_presence_state")
      .select("room_code")
      .gte("updated_at", activeSinceIso)
      .is("deleted_at", null);
    if (presenceError) {
      throw new Error(`Failed to read active presence: ${presenceError.message}`);
    }
    activeRoomCodes = (freshPresence ?? []).map((row) => row.room_code as string);
  }

  const keepRoomCodes = [...new Set([...recentRoomCodes, ...activeRoomCodes])];

  let staleRoomQuery = client.from("room_runtime_state").select("room_code").is("deleted_at", null);
  if (keepRoomCodes.length) {
    // room_code is constrained to ^[A-Z]{6}$, so this list is safe to inline.
    staleRoomQuery = staleRoomQuery.not("room_code", "in", `(${keepRoomCodes.join(",")})`);
  }
  const { data: staleRooms, error: staleRoomsError } = await staleRoomQuery;
  if (staleRoomsError) {
    throw new Error(`Failed to read prunable room runtime state: ${staleRoomsError.message}`);
  }
  const staleRoomCodes = [...new Set((staleRooms ?? []).map((row) => row.room_code as string))];
  if (!staleRoomCodes.length) {
    return 0;
  }

  const [rooms, chats, presence] = await Promise.all([
    client.from("room_runtime_state").delete().in("room_code", staleRoomCodes),
    client.from("room_chat_state").delete().in("room_code", staleRoomCodes),
    client.from("room_presence_state").delete().in("room_code", staleRoomCodes)
  ]);
  if (rooms.error) {
    throw new Error(`Failed to prune room runtime state: ${rooms.error.message}`);
  }
  if (chats.error) {
    throw new Error(`Failed to prune room chat state: ${chats.error.message}`);
  }
  if (presence.error) {
    throw new Error(`Failed to prune room presence state: ${presence.error.message}`);
  }

  return staleRoomCodes.length;
}

export async function clearVersionedRuntimeStateRows(): Promise<void> {
  const client = getSupabaseServerClient();
  const [rooms, sessions, chats, presence] = await Promise.all([
    client.from("room_runtime_state").delete().not("room_code", "is", null),
    client.from("player_session_state").delete().not("session_id", "is", null),
    client.from("room_chat_state").delete().not("room_code", "is", null),
    client.from("room_presence_state").delete().not("room_code", "is", null)
  ]);
  if (rooms.error) {
    throw new Error(`Failed to clear room runtime state: ${rooms.error.message}`);
  }
  if (sessions.error) {
    throw new Error(`Failed to clear session runtime state: ${sessions.error.message}`);
  }
  if (chats.error) {
    throw new Error(`Failed to clear room chat state: ${chats.error.message}`);
  }
  if (presence.error) {
    throw new Error(`Failed to clear room presence state: ${presence.error.message}`);
  }
}

export async function clearRoomRuntimeStateRows(): Promise<void> {
  const client = getSupabaseServerClient();
  const [rooms, chats, presence] = await Promise.all([
    client.from("room_runtime_state").delete().not("room_code", "is", null),
    client.from("room_chat_state").delete().not("room_code", "is", null),
    client.from("room_presence_state").delete().not("room_code", "is", null)
  ]);
  if (rooms.error) {
    throw new Error(`Failed to clear room runtime state: ${rooms.error.message}`);
  }
  if (chats.error) {
    throw new Error(`Failed to clear room chat state: ${chats.error.message}`);
  }
  if (presence.error) {
    throw new Error(`Failed to clear room presence state: ${presence.error.message}`);
  }
}

// ─── Room-keyed satellite state (chat, presence) ─────────────────────────────

/**
 * CRUD over a versioned, room-code-keyed table. A thin adapter that renames the
 * generic `key` field to `roomCode` for the chat/presence call sites.
 */
export interface RoomKeyedRuntimeStateRepository<T> {
  fetchAll(): Promise<VersionedRoomKeyedState<T>[]>;
  fetchOne(roomCode: string): Promise<VersionedRoomKeyedState<T> | null>;
  insert(roomCode: string, payload: T): Promise<number>;
  update(roomCode: string, payload: T, expectedVersion: number): Promise<number>;
  remove(roomCode: string, expectedVersion: number): Promise<void>;
}

function createRoomKeyedRuntimeState<T>(table: string): RoomKeyedRuntimeStateRepository<T> {
  const repo = createVersionedRuntimeState<T>(table, "room_code");
  return {
    async fetchAll() {
      const rows = await repo.fetchAll();
      return rows.map((row) => ({ roomCode: row.key, payload: row.payload, version: row.version }));
    },
    async fetchOne(roomCode: string) {
      const row = await repo.fetchOne(roomCode);
      return row ? { roomCode: row.key, payload: row.payload, version: row.version } : null;
    },
    insert: (roomCode, payload) => repo.insert(roomCode, payload),
    update: (roomCode, payload, expectedVersion) => repo.update(roomCode, payload, expectedVersion),
    remove: (roomCode, expectedVersion) => repo.remove(roomCode, expectedVersion)
  };
}

export const roomChatRuntimeState = createRoomKeyedRuntimeState<ChatMessage[]>("room_chat_state");
export const roomPresenceRuntimeState = createRoomKeyedRuntimeState<RoomPresence>("room_presence_state");
