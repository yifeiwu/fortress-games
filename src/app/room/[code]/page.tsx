"use client";

import { FormEvent, KeyboardEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientGameDefinition, getGameDisplayName, type RoomActionPayload } from "@/app/room/[code]/games/registry";
import { MAX_ROOM_PLAYERS } from "@/lib/constants";
import type { ChatMessage, Room } from "@/lib/types";
import { attachBroadcastRefresh } from "@/lib/supabase/broadcast-refresh";
import { Button } from "@/components/Button";

// Isolated so local UI state on the room page (chat input, copy toasts) doesn't
// re-render the whole message list on every keystroke; it only re-renders when
// the messages or viewer actually change.
const ChatMessages = memo(function ChatMessages({
  messages,
  viewerPlayerId
}: {
  messages: ChatMessage[];
  viewerPlayerId: string;
}) {
  if (!messages.length) {
    return <p className="text-slate-400">No messages yet.</p>;
  }
  return (
    <>
      {messages.map((msg) => {
        const isMine = msg.playerId === viewerPlayerId;
        return (
          <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
            <span className="px-1 text-xs font-semibold text-slate-400">{isMine ? "You" : msg.playerName}</span>
            <span
              className={`max-w-[85%] break-words rounded-lg px-3 py-1.5 ${
                isMine ? "bg-accent/20 text-slate-100" : "bg-slate-800 text-slate-200"
              }`}
            >
              {msg.content}
            </span>
          </div>
        );
      })}
    </>
  );
});

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const roomCode = String(params.code).toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [viewerPlayerId, setViewerPlayerId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  // After applying a room from a POST response, the server also broadcasts the
  // same event back to us. Skip the immediate echo refresh so the actor doesn't
  // re-fetch state it already has.
  const skipRefreshUntilRef = useRef(0);

  // Touch devices keep websockets alive unreliably (background throttling,
  // network handoffs, radio sleep), so realtime broadcasts silently stop and
  // the phase appears frozen. Detect them once so we can run a safety poll.
  const isTouchDevice = useMemo(
    () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false),
    []
  );

  const me = useMemo(() => room?.players.find((p) => p.id === viewerPlayerId) ?? null, [room, viewerPlayerId]);
  const isWaitingRoom = room?.status === "lobby";
  const clientGame = room ? getClientGameDefinition(room.gameType) : undefined;
  const gameDisplayName = room ? getGameDisplayName(room.gameType) : "Game";
  // Some games seat only the first N joiners (the rest spectate). The lobby
  // reads this seating rule from the game definition so it stays game-agnostic.
  const lobbyConfig = clientGame?.lobby;
  const activePlayerIds = useMemo(
    () =>
      lobbyConfig && room
        ? new Set(
            [...room.players]
              .sort((a, b) => a.joinOrder - b.joinOrder)
              .slice(0, lobbyConfig.maxActivePlayers)
              .map((player) => player.id)
          )
        : null,
    [lobbyConfig, room]
  );
  const activeSlotsFull = Boolean(
    lobbyConfig && room && room.players.length >= lobbyConfig.maxActivePlayers
  );
  const showLobbyOverflowNote = Boolean(
    lobbyConfig && room && room.players.length > lobbyConfig.maxActivePlayers
  );
  const usesGameBackdrop = Boolean(clientGame?.usesGameBackdrop);
  // Every in-game room gets a backdrop: a game-specific one when available,
  // otherwise a generic fallback so new/unthemed games aren't left bare.
  const backdropSrc = usesGameBackdrop ? `/backdrops/${room?.gameType}.svg` : "/backdrops/default.svg";
  const solo = Boolean(clientGame?.solo);
  const deadlineAt = room?.game.roundDeadlineAt;
  const shouldScheduleDeadlineRefresh = Boolean(room && clientGame?.shouldScheduleDeadlineRefresh(room.game));
  const isRoomNotFoundError = (message?: string) => /room not found/i.test(message ?? "");

  const refreshRoom = useCallback(async (signal?: AbortSignal) => {
    let response: Response;
    let data: { room?: Room; viewerPlayerId?: string | null; error?: string };
    try {
      response = await fetch(`/api/rooms/${roomCode}`, { cache: "no-store", signal });
      data = (await response.json()) as { room?: Room; viewerPlayerId?: string | null; error?: string };
    } catch {
      // Aborted (the page navigated away) or a transient network error. Either
      // way, drop this poll so a stale request can't redirect us out of a room
      // we've since left or joined elsewhere.
      return;
    }
    // The page tore down (e.g. after leaving) while this request was in flight.
    // Ignoring it prevents a stale poll from kicking the player out.
    if (signal?.aborted) return;
    if (!response.ok || !data.room) {
      if (response.status === 404 || isRoomNotFoundError(data.error)) {
        router.push("/");
        return;
      }
      // A 409 is a transient optimistic-lock conflict; the next refresh (from
      // the realtime event or fallback poll) will pick up the settled state.
      if (response.status === 409) {
        return;
      }
      setError(data.error ?? "Room unavailable.");
      if (response.status === 401 || response.status === 403) {
        router.push("/");
      }
      return;
    }
    if (!data.viewerPlayerId) {
      setError("Join this room from the lobby first.");
      router.push("/");
      return;
    }
    if (data.room.status === "ended") {
      router.push("/");
      return;
    }
    setViewerPlayerId(data.viewerPlayerId);
    setRoom(data.room);
  }, [roomCode, router]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    refreshRoom(signal);
    const heartbeat = window.setInterval(() => {
      fetch(`/api/rooms/${roomCode}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "heartbeat" }),
        signal
      }).catch(() => {
        // The next room refresh will surface stale sessions or missing rooms.
      });
    }, 12000);
    const cleanupRealtime = attachBroadcastRefresh({
      channelName: `room:${roomCode}`,
      refresh: () => void refreshRoom(signal),
      skipRefreshUntilRef,
      isTouchDevice,
      mobileSafetyPollMs: 3_000,
      includeForegroundRefresh: true
    });
    return () => {
      controller.abort();
      window.clearInterval(heartbeat);
      cleanupRealtime();
    };
  }, [refreshRoom, roomCode, isTouchDevice]);

  useEffect(() => {
    if (!deadlineAt || !shouldScheduleDeadlineRefresh) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => refreshRoom(controller.signal),
      Math.max(0, deadlineAt - Date.now() + 100)
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [deadlineAt, refreshRoom, shouldScheduleDeadlineRefresh]);

  const chatLength = room?.chat.length ?? 0;
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatLength, chatOpen]);

  // Focus the game surface once a keyboard-driven game goes live so arrow-key
  // play works without first clicking into the page.
  const supportsKeyboard = Boolean(clientGame?.handleKeyDown);
  useEffect(() => {
    if (supportsKeyboard && !isWaitingRoom) {
      mainRef.current?.focus();
    }
  }, [supportsKeyboard, isWaitingRoom]);

  const postAction = useCallback(
    async (payload: RoomActionPayload) => {
      if (!viewerPlayerId) return;
      setError(null);
      const response = await fetch(`/api/rooms/${roomCode}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { room?: Room; error?: string };
      if (!response.ok) {
        if (response.status === 404 || isRoomNotFoundError(data.error)) {
          router.push("/");
          return;
        }
        setError(data.error ?? "Action failed.");
      }
      if (data.room) {
        skipRefreshUntilRef.current = Date.now() + 400;
        setRoom(data.room);
      }
      if (payload.action === "leave") {
        router.push("/");
      }
    },
    [roomCode, router, viewerPlayerId]
  );

  const isHost = Boolean(me?.isHost);
  // Memoize the live game element so unrelated room-page re-renders (chat input,
  // copy toasts) don't re-render the entire game subtree. postAction is stable,
  // so this only recomputes when the room/viewer/host actually change.
  const gameElement = useMemo(() => {
    if (!clientGame || !room || !viewerPlayerId) return null;
    return clientGame.render({
      room,
      viewerPlayerId,
      isHost,
      onGameAction: postAction,
      onRestart: () => postAction({ action: "restart_game" })
    });
  }, [clientGame, room, viewerPlayerId, isHost, postAction]);

  async function copyRoomLink() {
    const code = room?.code ?? roomCode;
    const url = `${window.location.origin}/room/${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can be unavailable (older browsers / non-secure contexts).
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        setError("Couldn't copy the link. Copy it from the address bar instead.");
        document.body.removeChild(textarea);
        return;
      }
      document.body.removeChild(textarea);
    }
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2000);
  }

  async function sendChat(e: FormEvent) {
    e.preventDefault();
    const content = chatInput.trim();
    if (!content || !viewerPlayerId) return;
    setChatInput("");
    await postAction({ action: "chat", content });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!room || !clientGame?.handleKeyDown) return;
    clientGame.handleKeyDown({ event: e, room, onGameAction: postAction });
  }

  if (!room || !viewerPlayerId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10" aria-busy="true">
        <div className="animate-pulse space-y-4">
          <div className="h-16 rounded-lg bg-bg-panel" />
          <div className="h-64 rounded-lg bg-bg-panel" />
        </div>
        <p className="mt-4 text-sm text-slate-400">Loading room {roomCode}…</p>
      </main>
    );
  }

  return (
    <main
      ref={mainRef}
      className={`mx-auto relative flex min-h-screen w-full max-w-6xl flex-col gap-6 overflow-hidden px-6 py-8 ${
        isWaitingRoom
          ? "bg-gradient-to-b from-bg via-slate-950 to-bg"
          : "bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.22),_transparent_45%),linear-gradient(180deg,_#020617_0%,_#061327_45%,_#020617_100%)]"
      }`}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {!isWaitingRoom ? (
        <>
          {/* Themed, per-game decorative art behind the live game. Games without
              their own backdrop fall back to a generic one. */}
          <img
            src={backdropSrc}
            alt=""
            aria-hidden="true"
            onError={(e) => {
              // A game-specific SVG may be missing; degrade to the generic art.
              if (!e.currentTarget.src.endsWith("/backdrops/default.svg")) {
                e.currentTarget.src = "/backdrops/default.svg";
              }
            }}
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-50"
          />
          <div className="pointer-events-none absolute -left-12 top-20 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-12 bottom-16 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:42px_42px]" />
        </>
      ) : null}

      <header className={`relative rounded-lg p-4 ${isWaitingRoom ? "bg-bg-panel" : "border border-cyan-800/50 bg-slate-950/70 backdrop-blur"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{isWaitingRoom ? `Waiting Room ${room.code}` : `${gameDisplayName} ${room.code}`}</h1>
          <div className="flex items-center gap-2">
            {isWaitingRoom && me?.isHost ? (
              <Button
                variant="success"
                size="sm"
                onClick={() => postAction({ action: "start_game" })}
                disabled={room.players.length < 2}
                title={room.players.length < 2 ? "Need at least 2 players to start" : undefined}
              >
                Start Game
              </Button>
            ) : null}
            {/* In the waiting room the lobby card already exposes copy controls,
                so the header button is only shown once a game is live. */}
            {!solo && !isWaitingRoom ? (
              <Button
                variant={linkCopied ? "primary" : "secondary"}
                size="sm"
                onClick={copyRoomLink}
                title="Copy a shareable link to this room"
              >
                {linkCopied ? "✓ Link copied" : "Copy room link"}
              </Button>
            ) : null}
            {clientGame?.rulesHref ? (
              <a
                href={clientGame.rulesHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:ring-slate-400"
              >
                How to play ↗
              </a>
            ) : null}
            <Button variant="danger" size="sm" className="min-w-[7.5rem]" onClick={() => postAction({ action: "leave" })}>
              Leave
            </Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          {isWaitingRoom
            ? "Players can chat, ready up, and wait for the host to start. Room closes when all human players leave."
            : `${gameDisplayName} is live. Use in-game controls to submit your moves each round.`}
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded bg-accent-danger/20 p-3 text-sm text-accent-danger">
          {error}
        </p>
      ) : null}

      {/* Announce copy success to assistive tech; the button label swap alone
          isn't reliably read out. */}
      <span role="status" aria-live="polite" className="sr-only">
        {linkCopied ? "Room link copied to clipboard." : ""}
      </span>

      <section className="relative grid gap-6 lg:grid-cols-3">
        {isWaitingRoom ? (
          <div className={`rounded-lg border border-slate-800 bg-bg-panel p-4 ${solo ? "lg:col-span-3" : "lg:col-span-2"}`}>
            <h2 className="text-lg font-semibold">{solo ? "Ready when you are" : "Waiting for players"}</h2>
            <p className="mt-1 text-sm text-slate-300">
              {solo
                ? "The Reader is at the table. Press Start Game to begin your reading."
                : "Share the code below to invite friends. The host starts the game once everyone\u2019s in."}
            </p>

            {!solo ? (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Room code</p>
                  <p className="mt-1 font-mono text-4xl font-bold tracking-[0.35em] text-accent">{room.code}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="secondary" onClick={copyRoomLink}>
                    {linkCopied ? "✓ Link copied" : "Copy invite link"}
                  </Button>
                </div>
              </div>
            ) : null}

            {!solo && room.players.length < 2 ? (
              <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                At least 2 players are required to start. Invite another player or add a fortress-bot.
              </p>
            ) : null}
            {showLobbyOverflowNote && lobbyConfig ? (
              <p className="mt-3 rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                {lobbyConfig.overflowNote}
              </p>
            ) : null}
            <div className="mt-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-semibold">Players</h3>
                  <span className="text-xs font-medium text-slate-400">
                    {room.players.length}/{MAX_ROOM_PLAYERS}
                  </span>
                </div>
              </div>
              <div className="mt-2 space-y-1.5 text-sm">
                {room.players.map((player) => {
                  const role =
                    lobbyConfig && activePlayerIds
                      ? activePlayerIds.has(player.id)
                        ? { label: lobbyConfig.activeRoleLabel, className: "bg-emerald-500/20 text-emerald-200" }
                        : { label: lobbyConfig.spectatorRoleLabel, className: "bg-slate-700 text-slate-300" }
                      : null;
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          role="img"
                          aria-label={player.connected ? "Online" : "Offline"}
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            player.connected ? "bg-emerald-400" : "bg-slate-600"
                          }`}
                          title={player.connected ? "Online" : "Offline"}
                        />
                        <span className="truncate font-medium text-slate-100">{player.name}</span>
                        {player.isHost ? (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-200">
                            Host
                          </span>
                        ) : null}
                        {player.isBot ? (
                          <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-200">
                            Bot
                          </span>
                        ) : null}
                      </div>
                      {role ? (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${role.className}`}>
                          {role.label}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {me?.isHost && clientGame?.supportsBots ? (
                <div className="mt-3">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => postAction({ action: "add_bot" })}
                    disabled={room.players.length >= MAX_ROOM_PLAYERS || activeSlotsFull}
                    title={
                      room.players.length >= MAX_ROOM_PLAYERS
                        ? `Room is full (max ${MAX_ROOM_PLAYERS} players)`
                        : activeSlotsFull
                        ? `This game seats ${lobbyConfig?.maxActivePlayers} players`
                        : undefined
                    }
                  >
                    Add fortress-bot
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {clientGame ? (
              gameElement
            ) : (
              <div className="rounded-xl border border-slate-700 bg-bg-panel p-4 lg:col-span-2">
                <h2 className="text-lg font-semibold">{gameDisplayName}</h2>
                <p className="mt-1 text-sm text-slate-300">A dedicated game UI has not been implemented yet for this game type.</p>
                <div className="mt-4 space-y-2 text-sm">
                  <p>State: {room.game.state}</p>
                  <p>Round: {room.game.roundIndex + 1} / {room.game.maxRounds}</p>
                  <p>Leader: {room.players.find((p) => p.id === room.game.leaderPlayerId)?.name ?? "TBD"}</p>
                </div>
              </div>
            )}
          </>
        )}

        {!solo ? (
        <aside
          className={`fixed inset-x-0 bottom-0 z-40 max-h-[80vh] overflow-auto rounded-t-2xl p-4 shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:max-h-none lg:translate-y-0 lg:overflow-visible lg:rounded-lg lg:shadow-none ${
            chatOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
          } ${isWaitingRoom ? "bg-bg-panel" : "border border-cyan-900/40 bg-slate-950/70 backdrop-blur"}`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Room Chat</h2>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded p-1 text-slate-400 hover:text-slate-100 lg:hidden"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
          <div ref={chatScrollRef} className="mt-3 flex h-72 flex-col gap-2 overflow-auto rounded bg-slate-900 p-3 text-sm">
            <ChatMessages messages={room.chat} viewerPlayerId={viewerPlayerId} />
          </div>
          <form className="mt-3 flex gap-2" onSubmit={sendChat}>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type message..."
              aria-label="Chat message"
            />
            <Button size="sm" type="submit" disabled={!chatInput.trim()}>
              Send
            </Button>
          </form>
        </aside>
        ) : null}

        {!solo && chatOpen ? (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setChatOpen(false)}
            aria-hidden
          />
        ) : null}
      </section>

      {!solo && !chatOpen ? (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:ring-accent lg:hidden"
          aria-label="Open chat"
        >
          Chat
          {room.chat.length ? (
            <span className="rounded-full bg-slate-950/20 px-1.5 text-xs font-bold">{room.chat.length}</span>
          ) : null}
        </button>
      ) : null}
    </main>
  );
}
