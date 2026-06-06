"use client";

import type { KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { ARROW_KEY_TO_DIRECTION } from "@/app/room/[code]/games/arrow-predict-game";
import { FRANKENBEASTS_PLAYER_COUNT } from "@/lib/constants";
import type { Direction, GameState, Room, SpaceshipActionType } from "@/lib/types";

// Each game's UI is a large, self-contained bundle (and FrankenBeasts/Tarot drag
// in sizeable static data tables). Load them on demand so a room only ships the
// JS for the game it's actually running, instead of all five up front.
const ArrowPredictGame = dynamic(() =>
  import("@/app/room/[code]/games/arrow-predict-game").then((m) => m.ArrowPredictGame)
);
const FrankenBeastsGame = dynamic(() =>
  import("@/app/room/[code]/games/frankenbeasts-game").then((m) => m.FrankenBeastsGame)
);
const LiarsDiceGame = dynamic(() =>
  import("@/app/room/[code]/games/liars-dice-game").then((m) => m.LiarsDiceGame)
);
const SpaceshipDefenseGame = dynamic(() =>
  import("@/app/room/[code]/games/spaceship-defense-game").then((m) => m.SpaceshipDefenseGame)
);
const TarotGame = dynamic(() => import("@/app/room/[code]/games/tarot-game").then((m) => m.TarotGame));

type ClientGameAction =
  | { action: "submit_direction"; direction: Direction }
  | { action: "submit_spaceship_action"; spaceshipAction: SpaceshipActionType; targetThreatId?: string }
  | { action: "submit_pick"; headId: string; bodyId: string; tailId: string; lockIn: boolean }
  | { action: "submit_fb_action"; abilityId: string }
  | { action: "submit_seeds"; seekerName: string; question: string }
  | { action: "submit_bid"; quantity: number; face: number }
  | { action: "call_liar" }
  | { action: "flip_card" };

type RoomControlAction =
  | { action: "leave" }
  | { action: "chat"; content: string }
  | { action: "start_game" }
  | { action: "restart_game" }
  | { action: "add_bot" }
  | { action: "heartbeat" };

export type RoomActionPayload = ClientGameAction | RoomControlAction;

interface GameRendererProps {
  room: Room;
  viewerPlayerId: string;
  isHost: boolean;
  onGameAction: (payload: ClientGameAction) => Promise<void>;
  onRestart: () => void;
}

/**
 * Lobby presentation for games that don't seat every room member. Keeps the
 * waiting room game-agnostic: it renders active/spectator badges and the note
 * from this config instead of branching on specific game types.
 */
interface LobbyConfig {
  /**
   * Caps active participants. The first players (by join order) up to this
   * count play; everyone else is shown as a spectator. Omit when every member
   * plays.
   */
  maxActivePlayers: number;
  /** Badge label for active participants (e.g. "Fighter"). */
  activeRoleLabel: string;
  /** Badge label for spectators (e.g. "Spectator"). */
  spectatorRoleLabel: string;
  /** Waiting-room note shown when more members are present than there are seats. */
  overflowNote: string;
}

export interface ClientGameDefinition {
  gameType: string;
  displayName: string;
  usesGameBackdrop: boolean;
  supportsBots: boolean;
  /** Solo experience: hides chat and the invite (copy code/link) UI. */
  solo?: boolean;
  /** Lobby seating rules for games where not every member actively plays. */
  lobby?: LobbyConfig;
  /** In-app link to the game's rules doc, rendered at /rules/<gameType>. */
  rulesHref: string;
  shouldScheduleDeadlineRefresh: (state: GameState) => boolean;
  handleKeyDown?: (args: {
    event: KeyboardEvent<HTMLDivElement>;
    room: Room;
    onGameAction: (payload: ClientGameAction) => Promise<void>;
  }) => void;
  render: (props: GameRendererProps) => JSX.Element;
}

const clientGameDefinitions: Record<string, ClientGameDefinition> = {
  arrow_predict: {
    gameType: "arrow_predict",
    displayName: "Acchi Muite Hoi",
    usesGameBackdrop: true,
    supportsBots: true,
    rulesHref: "/rules/arrow_predict",
    shouldScheduleDeadlineRefresh: (state) => state.state === "intro" || state.state === "round_open" || state.state === "round_revealed",
    handleKeyDown({ event, room, onGameAction }) {
      if (room.game.state !== "round_open") return;
      const direction = ARROW_KEY_TO_DIRECTION[event.key];
      if (!direction) return;
      event.preventDefault();
      onGameAction({ action: "submit_direction", direction });
    },
    render({ room, viewerPlayerId, isHost, onGameAction, onRestart }) {
      return (
        <ArrowPredictGame
          room={room}
          viewerPlayerId={viewerPlayerId}
          isHost={isHost}
          onSubmitDirection={(direction: Direction) => onGameAction({ action: "submit_direction", direction })}
          onRestart={onRestart}
        />
      );
    }
  },
  spaceship_defense: {
    gameType: "spaceship_defense",
    displayName: "Starshield Crisis",
    usesGameBackdrop: true,
    supportsBots: true,
    rulesHref: "/rules/spaceship_defense",
    shouldScheduleDeadlineRefresh: (state) => state.state === "player_turn" || state.state === "enemy_phase",
    render({ room, viewerPlayerId, isHost, onGameAction, onRestart }) {
      return (
        <SpaceshipDefenseGame
          room={room}
          viewerPlayerId={viewerPlayerId}
          isHost={isHost}
          onSubmitAction={(spaceshipAction: SpaceshipActionType, targetThreatId?: string) =>
            onGameAction({ action: "submit_spaceship_action", spaceshipAction, targetThreatId })
          }
          onRestart={onRestart}
        />
      );
    }
  },
  frankenbeasts: {
    gameType: "frankenbeasts",
    displayName: "FrankenBeasts",
    usesGameBackdrop: true,
    supportsBots: true,
    rulesHref: "/rules/frankenbeasts",
    lobby: {
      maxActivePlayers: FRANKENBEASTS_PLAYER_COUNT,
      activeRoleLabel: "Fighter",
      spectatorRoleLabel: "Spectator",
      overflowNote: `The first ${FRANKENBEASTS_PLAYER_COUNT} players will fight. Everyone else can spectate and chat.`
    },
    shouldScheduleDeadlineRefresh: (state) =>
      state.state === "pick_phase" || state.state === "fight_round" || state.state === "fight_reveal",
    render({ room, viewerPlayerId, isHost, onGameAction, onRestart }) {
      return (
        <FrankenBeastsGame
          room={room}
          viewerPlayerId={viewerPlayerId}
          isHost={isHost}
          onSubmitPick={(headId, bodyId, tailId, lockIn) =>
            onGameAction({ action: "submit_pick", headId, bodyId, tailId, lockIn })
          }
          onSelectAction={(abilityId) => onGameAction({ action: "submit_fb_action", abilityId })}
          onRestart={onRestart}
        />
      );
    }
  },
  liars_dice: {
    gameType: "liars_dice",
    displayName: "Bluffer's Hoard",
    usesGameBackdrop: true,
    supportsBots: true,
    rulesHref: "/rules/liars_dice",
    shouldScheduleDeadlineRefresh: (state) =>
      state.state === "dice_roll" || state.state === "bidding" || state.state === "dice_reveal",
    render({ room, viewerPlayerId, isHost, onGameAction, onRestart }) {
      return (
        <LiarsDiceGame
          room={room}
          viewerPlayerId={viewerPlayerId}
          isHost={isHost}
          onSubmitBid={(quantity, face) => onGameAction({ action: "submit_bid", quantity, face })}
          onCallLiar={() => onGameAction({ action: "call_liar" })}
          onRestart={onRestart}
        />
      );
    }
  },
  tarot: {
    gameType: "tarot",
    displayName: "Fortune's Veil",
    usesGameBackdrop: true,
    supportsBots: false,
    solo: true,
    rulesHref: "/rules/tarot",
    shouldScheduleDeadlineRefresh: () => false,
    render({ room, viewerPlayerId, isHost, onGameAction, onRestart }) {
      return (
        <TarotGame
          room={room}
          viewerPlayerId={viewerPlayerId}
          isHost={isHost}
          onSubmitSeeds={(seekerName, question) =>
            onGameAction({ action: "submit_seeds", seekerName, question })
          }
          onFlip={() => onGameAction({ action: "flip_card" })}
          onRestart={onRestart}
        />
      );
    }
  }
};

export function getClientGameDefinition(gameType: string): ClientGameDefinition | undefined {
  return clientGameDefinitions[gameType];
}

export function getGameDisplayName(gameType: string): string {
  return getClientGameDefinition(gameType)?.displayName ?? gameType;
}
