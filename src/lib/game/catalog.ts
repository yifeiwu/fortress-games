import { FRANKENBEASTS_PLAYER_COUNT, MAX_ROOM_PLAYERS } from "@/lib/constants";

export type GameTagVariant = "default" | "strict" | "info";

export interface GameTag {
  label: string;
  variant?: GameTagVariant;
}

export interface LobbyCardMeta {
  tagline: string;
  description: string;
  tags: GameTag[];
  buttonClass: string;
  image: string;
  accentClass: string;
  fallbackIcon?: string;
}

export interface GameLobbyConfig {
  maxActivePlayers: number;
  activeRoleLabel: string;
  spectatorRoleLabel: string;
  overflowNote: string;
}

export interface GameCatalogEntry {
  gameType: string;
  displayName: string;
  rulesDocFile: string;
  rulesHref: string;
  supportsBots: boolean;
  usesGameBackdrop: boolean;
  solo?: boolean;
  lobby?: GameLobbyConfig;
  lobbyCard: LobbyCardMeta;
  activeRoomAccentBorderClass: string;
}

const GAME_CATALOG: GameCatalogEntry[] = [
  {
    gameType: "arrow_predict",
    displayName: "Acchi Muite Hoi",
    rulesDocFile: "arrow-predict",
    rulesHref: "/rules/arrow_predict",
    supportsBots: true,
    usesGameBackdrop: true,
    lobbyCard: {
      tagline: "Look-away duel of nerve & misdirection",
      description:
        "A rotating leader points a direction each round while everyone else tries to dodge. Dodgers score for looking away; the leader cashes an escalating jackpot for catching the crowd. Everyone leads once.",
      tags: [{ label: `2-${MAX_ROOM_PLAYERS} players` }],
      buttonClass: "bg-accent text-slate-950 hover:opacity-90",
      image: "/games/card-arrow-predict.svg",
      accentClass: "border-t-sky-400/70"
    },
    activeRoomAccentBorderClass: "border-l-sky-400/70"
  },
  {
    gameType: "spaceship_defense",
    displayName: "Starshield Crisis",
    rulesDocFile: "spaceship-defense",
    rulesHref: "/rules/spaceship_defense",
    supportsBots: true,
    usesGameBackdrop: true,
    lobbyCard: {
      tagline: "Co-op bridge-crew survival",
      description:
        "Share one ship and survive together. Shoot threats, raise shields, and charge the jump drive - then escape before incoming fire breaks through. Win or lose as a crew.",
      tags: [{ label: `2-${MAX_ROOM_PLAYERS} players` }, { label: "co-op", variant: "info" }],
      buttonClass: "bg-cyan-400 text-slate-950 hover:opacity-90",
      image: "/games/card-spaceship-defense.svg",
      accentClass: "border-t-cyan-400/70"
    },
    activeRoomAccentBorderClass: "border-l-cyan-400/70"
  },
  {
    gameType: "frankenbeasts",
    displayName: "FrankenBeasts",
    rulesDocFile: "frankenbeasts",
    rulesHref: "/rules/frankenbeasts",
    supportsBots: true,
    usesGameBackdrop: true,
    lobby: {
      maxActivePlayers: FRANKENBEASTS_PLAYER_COUNT,
      activeRoleLabel: "Fighter",
      spectatorRoleLabel: "Spectator",
      overflowNote: `The first ${FRANKENBEASTS_PLAYER_COUNT} players will fight. Everyone else can spectate and chat.`
    },
    lobbyCard: {
      tagline: "1v1 monster-building duel",
      description:
        "Build a beast from a head, body, and tail, then fight to the death in simultaneous-turn combat. Mix damage, poison, armor, and chaos - the right combo beats fast reflexes. Add a bot to spar solo.",
      tags: [{ label: `${FRANKENBEASTS_PLAYER_COUNT} players`, variant: "strict" }, { label: "spectators allowed", variant: "info" }],
      buttonClass: "bg-emerald-400 text-slate-950 hover:opacity-90",
      image: "/games/card-frankenbeasts.svg",
      accentClass: "border-t-emerald-400/70"
    },
    activeRoomAccentBorderClass: "border-l-emerald-400/70"
  },
  {
    gameType: "tarot",
    displayName: "Fortune's Veil",
    rulesDocFile: "tarot",
    rulesHref: "/rules/tarot",
    supportsBots: false,
    usesGameBackdrop: true,
    solo: true,
    lobbyCard: {
      tagline: "Solo tarot reading",
      description:
        "Sit with the Reader, name yourself, and ask a single question. The deck answers with a Past, Present, and Future card - flipped one at a time, each with its own meaning - then laid out as your full reading. Your question always draws the same fate.",
      tags: [{ label: "1 player", variant: "info" }],
      buttonClass: "bg-fuchsia-400 text-slate-950 hover:opacity-90",
      image: "/games/card-tarot.svg",
      accentClass: "border-t-fuchsia-400/70"
    },
    activeRoomAccentBorderClass: "border-l-fuchsia-400/70"
  },
  {
    gameType: "liars_dice",
    displayName: "Bluffer's Hoard",
    rulesDocFile: "liars-dice",
    rulesHref: "/rules/liars_dice",
    supportsBots: true,
    usesGameBackdrop: true,
    lobbyCard: {
      tagline: "Bluff & call dice duel",
      description:
        "Everyone hides a cup of dice and the table escalates a public claim - \"four 5s!\" - about how many of a face are showing across all cups. Raise the bid or call Liar! to expose a bluff. Lose the showdown and a die slides off your stack; last bluffer standing wins.",
      tags: [{ label: `2-${MAX_ROOM_PLAYERS} players` }, { label: "bluffing", variant: "info" }],
      buttonClass: "bg-amber-400 text-slate-950 hover:opacity-90",
      image: "/games/card-liars-dice.svg",
      accentClass: "border-t-amber-400/70",
      fallbackIcon: "🎲"
    },
    activeRoomAccentBorderClass: "border-l-amber-400/70"
  }
];

const GAME_CATALOG_BY_TYPE = new Map<string, GameCatalogEntry>(
  GAME_CATALOG.map((entry) => [entry.gameType, entry])
);

export const GAME_DISPLAY_NAMES_BY_TYPE: Record<string, string> = Object.fromEntries(
  GAME_CATALOG.map((entry) => [entry.gameType, entry.displayName])
);

export const GAME_ACCENT_BORDERS_BY_TYPE: Record<string, string> = Object.fromEntries(
  GAME_CATALOG.map((entry) => [entry.gameType, entry.activeRoomAccentBorderClass])
);

export function listGameCatalog(): readonly GameCatalogEntry[] {
  return GAME_CATALOG;
}

export function getGameCatalogEntry(gameType: string): GameCatalogEntry | undefined {
  return GAME_CATALOG_BY_TYPE.get(gameType);
}

export function requireGameCatalogEntry(gameType: string): GameCatalogEntry {
  const game = GAME_CATALOG_BY_TYPE.get(gameType);
  if (!game) {
    throw new Error(`Missing game catalog entry for ${gameType}`);
  }
  return game;
}
