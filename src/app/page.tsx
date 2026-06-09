"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GAME_ACCENT_BORDERS_BY_TYPE,
  GAME_DISPLAY_NAMES_BY_TYPE,
  listGameCatalog,
  type GameTag,
  type GameTagVariant
} from "@/lib/game/catalog";
import { attachBroadcastRefresh } from "@/lib/supabase/broadcast-refresh";
import { Button } from "@/components/Button";

interface LobbyRoomSummary {
  code: string;
  gameType: string;
  status: string;
  playerCount: number;
}

const GAME_TAG_VARIANT_CLASSES: Record<GameTagVariant, string> = {
  default: "bg-slate-800 text-slate-300",
  strict: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40",
  info: "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/30"
};

const GAMES = listGameCatalog();

const GAME_DISPLAY_NAMES = GAME_DISPLAY_NAMES_BY_TYPE;
const GAME_ACCENT_BORDERS = GAME_ACCENT_BORDERS_BY_TYPE;

function LobbySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading lobby…</span>
      <div className="rounded-lg bg-bg-panel p-5">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-800" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900/60">
              <div className="aspect-[2/1] w-full animate-pulse bg-slate-800" />
              <div className="flex flex-col gap-3 p-4">
                <div className="h-5 w-32 animate-pulse rounded bg-slate-800" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-800" />
                <div className="h-12 w-full animate-pulse rounded bg-slate-800" />
                <div className="h-9 w-28 animate-pulse rounded bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-bg-panel p-5">
        <div className="h-6 w-32 animate-pulse rounded bg-slate-800" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded border border-slate-800 bg-slate-900/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LobbyPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<LobbyRoomSummary[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  // When set, re-show the username form (prefilled) so a signed-in player can
  // pick a different name without clearing their session.
  const [editingUsername, setEditingUsername] = useState(false);
  // Track the specific game/room being acted on so only the clicked button
  // shows a spinner rather than disabling the whole grid.
  const [creatingGameType, setCreatingGameType] = useState<string | null>(null);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const trimmedUsername = useMemo(() => usernameDraft.trim(), [usernameDraft]);
  const isBusy = savingUsername || creatingGameType !== null || joiningCode !== null;

  async function refreshSession() {
    const response = await fetch("/api/session", { cache: "no-store" });
    const data = (await response.json()) as { session?: { username: string | null } };
    setUsername(data.session?.username ?? null);
  }

  async function refreshRooms() {
    const response = await fetch("/api/rooms", { cache: "no-store" });
    const data = (await response.json()) as { rooms: LobbyRoomSummary[] };
    setRooms(data.rooms ?? []);
  }

  useEffect(() => {
    Promise.allSettled([refreshSession(), refreshRooms()]).finally(() => setLoaded(true));
    return attachBroadcastRefresh({ channelName: "lobby", refresh: refreshRooms });
  }, []);

  async function handleSetUsername(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!trimmedUsername) {
      setError("Please enter a name.");
      return;
    }
    if (savingUsername) return;
    setSavingUsername(true);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername })
      });
      const data = (await response.json()) as { session?: { username: string | null }; error?: string };
      if (!response.ok || !data.session?.username) {
        setError(data.error ?? "Could not save name.");
        return;
      }
      setUsername(data.session.username);
      setEditingUsername(false);
    } catch {
      setError("Could not save name. Check your connection and try again.");
    } finally {
      setSavingUsername(false);
    }
  }

  async function createRoom(gameType: string) {
    setError(null);
    if (!username) {
      setError("Set a name first.");
      return;
    }
    if (isBusy) return;
    setCreatingGameType(gameType);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          gameType,
          username
        })
      });
      const data = (await response.json()) as { room?: { code: string }; error?: string };
      if (!response.ok || !data.room) {
        setError(data.error ?? "Could not create room.");
        return;
      }
      // Keep the spinner up while the route transition happens; resetting now
      // would flash the idle button before the lobby unmounts.
      router.push(`/room/${data.room.code}`);
    } catch {
      setError("Could not create room. Check your connection and try again.");
      setCreatingGameType(null);
    }
  }

  async function joinRoomByCode(code: string) {
    setError(null);
    if (!username) {
      setError("Set a name first.");
      return;
    }
    if (isBusy) return;
    const normalizedCode = code.trim().toUpperCase();
    setJoiningCode(normalizedCode);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "join",
          roomCode: normalizedCode,
          username
        })
      });
      const data = (await response.json()) as { room?: { code: string }; error?: string };
      if (!response.ok || !data.room) {
        setError(data.error ?? "Could not join room.");
        setJoiningCode(null);
        return;
      }
      router.push(`/room/${data.room.code}`);
    } catch {
      setError("Could not join room. Check your connection and try again.");
      setJoiningCode(null);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    await joinRoomByCode(joinCode);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="rounded-lg bg-bg-panel p-6">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" aria-hidden="true" className="h-11 w-11 shrink-0 drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]" />
          <h1 className="text-3xl font-bold">Fortress Games</h1>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Lobby
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Play multiplayer games in your browser
        </p>
        {username && !editingUsername ? (
          <div className="mt-2 flex items-center gap-3">
            <p className="text-sm text-accent">Playing as {username}</p>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 py-1 text-xs"
              onClick={() => {
                setError(null);
                setUsernameDraft(username);
                setEditingUsername(true);
              }}
            >
              Change
            </Button>
          </div>
        ) : null}
      </header>

      {!loaded ? <LobbySkeleton /> : (
        <>
      {!username || editingUsername ? (
        <section className="rounded-lg border border-slate-700 bg-bg-panel p-5">
          <h2 className="text-xl font-semibold">{editingUsername ? "Change Name" : "Pick a Name"}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {editingUsername
              ? "Pick a new display name. It just needs to be unique among active players."
              : "Choose a name to enter the lobby — it just needs to be unique among active players."}
          </p>
          <form className="mt-3 flex flex-wrap gap-3" onSubmit={handleSetUsername}>
            <label className="sr-only" htmlFor="username-input">
              Name
            </label>
            <input
              id="username-input"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value)}
              placeholder="Your name"
              autoFocus
            />
            <Button type="submit" disabled={savingUsername || !trimmedUsername}>
              {savingUsername ? "Saving…" : editingUsername ? "Save" : "Continue"}
            </Button>
            {editingUsername ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setError(null);
                  setEditingUsername(false);
                }}
                disabled={savingUsername}
              >
                Cancel
              </Button>
            ) : null}
          </form>
        </section>
      ) : (
        <section className="flex flex-col gap-6">
          <div className="rounded-lg bg-bg-panel p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">Create a Room</h2>
              <p className="text-sm text-slate-400">Choose a game to host</p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GAMES.map((game) => (
                <div
                  key={game.gameType}
                  className={`flex flex-col overflow-hidden rounded-lg border border-t-2 border-slate-700 bg-slate-900/60 transition hover:border-slate-600 ${game.lobbyCard.accentClass}`}
                >
                  <div className="relative aspect-[2/1] w-full overflow-hidden bg-slate-950">
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-5xl">
                      {game.lobbyCard.fallbackIcon ?? "🎮"}
                    </div>
                    <img
                      src={game.lobbyCard.image}
                      alt={`${game.displayName} artwork`}
                      loading="lazy"
                      width={400}
                      height={200}
                      className="relative h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-slate-100">{game.displayName}</h3>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {game.lobbyCard.tags.map((tag: GameTag) => (
                        <span
                          key={tag.label}
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            GAME_TAG_VARIANT_CLASSES[tag.variant ?? "default"]
                          }`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{game.lobbyCard.tagline}</p>
                  <p className="mt-2 flex-1 text-sm text-slate-300">{game.lobbyCard.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => createRoom(game.gameType)}
                      disabled={isBusy}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60 ${game.lobbyCard.buttonClass}`}
                    >
                      {creatingGameType === game.gameType ? "Creating…" : "Create Room"}
                    </button>
                    <a
                      href={game.rulesHref}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      How to play ↗
                    </a>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form className="max-w-md rounded-lg bg-bg-panel p-5" onSubmit={handleJoin}>
            <h2 className="text-xl font-semibold">Join a Room</h2>
            <p className="mt-1 text-sm text-slate-400">Already have a 6-letter code? Drop it in.</p>
            <label className="mt-3 block text-sm text-slate-300">
              Room Code
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABCDEF"
              />
            </label>
            <Button className="mt-4" type="submit" disabled={isBusy || joinCode.trim().length !== 6}>
              {joiningCode !== null && joiningCode === joinCode.trim() ? "Joining…" : "Join"}
            </Button>
          </form>
        </section>
      )}

      {error ? (
        <p role="alert" className="rounded bg-accent-danger/20 p-3 text-sm text-accent-danger">
          {error}
        </p>
      ) : null}

      {username && !editingUsername ? (
        <section className="rounded-lg bg-bg-panel p-5">
          <h2 className="text-xl font-semibold">Active Rooms</h2>
          <div className="mt-3 space-y-2">
            {rooms.length ? (
              rooms.map((room) => {
                const isJoinable = room.status === "lobby";
                const accentBorder = GAME_ACCENT_BORDERS[room.gameType] ?? "border-l-slate-600";
                return (
                  <div
                    key={room.code}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 rounded border border-l-4 border-slate-700 px-3 py-2 text-left transition ${accentBorder} ${
                      isJoinable ? "hover:border-slate-600" : "opacity-70"
                    }`}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="font-mono text-base font-semibold tracking-widest text-slate-100">{room.code}</span>
                      <span className="text-sm text-slate-300">
                        {GAME_DISPLAY_NAMES[room.gameType] ?? room.gameType} · {room.playerCount} player{room.playerCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isJoinable
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isJoinable ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {isJoinable ? "Waiting" : "In game"}
                      </span>
                      {isJoinable ? (
                        <Button size="sm" onClick={() => joinRoomByCode(room.code)} disabled={isBusy}>
                          {joiningCode === room.code ? "Joining…" : "Join"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded border border-dashed border-slate-700 px-3 py-6 text-center text-sm text-slate-400">
                No active rooms yet — create one above to get started.
              </p>
            )}
          </div>
        </section>
      ) : null}
        </>
      )}
    </main>
  );
}
