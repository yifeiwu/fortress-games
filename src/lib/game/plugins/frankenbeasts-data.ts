import { FRANKENBEASTS_PLAYER_COUNT } from "@/lib/constants";
import type { FrankenBeastsGameState, Room } from "@/lib/types";

export type FBAbilityEffect =
  | { kind: "damage"; amount: number }
  | { kind: "damage_self"; amount: number }
  | { kind: "heal"; amount: number }
  | { kind: "poison_opponent"; turns: number }
  | { kind: "poison_self"; turns: number }
  | { kind: "damage_buff"; bonus: number; turns: number }
  | { kind: "terrify" }
  | { kind: "trip" }
  | { kind: "pass" };

type FBPassiveEffect =
  | { kind: "damage_reduction"; amount: number }
  | { kind: "damage_amplify"; amount: number }
  | { kind: "heal_per_round"; amount: number }
  | { kind: "retaliation"; amount: number }
  | { kind: "death_march"; amount: number }
  | { kind: "poison_retaliation"; turns: number }
  | { kind: "self_poison"; turns: number };

export interface FBAbility {
  id: string;
  name: string;
  description: string;
  effects: FBAbilityEffect[];
}

export interface FBPart {
  id: string;
  slot: "head" | "body" | "tail";
  name: string;
  hp: number;
  abilities: FBAbility[];
  passives: FBPassiveEffect[];
}

// ─── Heads ────────────────────────────────────────────────────────────────────

const GRANITE_HEAD: FBPart = {
  id: "granite_head",
  slot: "head",
  name: "Granite Head",
  hp: 17,
  abilities: [],
  passives: []
};

const ROCK_HEAD: FBPart = {
  id: "rock_head",
  slot: "head",
  name: "Rock Head",
  hp: 12,
  abilities: [
    {
      id: "roar",
      name: "Roar",
      description: "For the next 3 turns your attacks deal +4 extra damage.",
      effects: [{ kind: "damage_buff", bonus: 4, turns: 3 }]
    }
  ],
  passives: []
};

const BEAR_HEAD: FBPart = {
  id: "bear_head",
  slot: "head",
  name: "Bear Head",
  hp: 10,
  abilities: [
    {
      id: "maul",
      name: "Maul",
      description: "Deal 8 damage.",
      effects: [{ kind: "damage", amount: 8 }]
    }
  ],
  passives: []
};

const LEECH_HEAD: FBPart = {
  id: "leech_head",
  slot: "head",
  name: "Leech Head",
  hp: 10,
  abilities: [
    {
      id: "drain_bite",
      name: "Drain Bite",
      description: "Deal 5 damage and heal 3 HP yourself.",
      effects: [
        { kind: "damage", amount: 5 },
        { kind: "heal", amount: 3 }
      ]
    }
  ],
  passives: []
};

const VIPER_HEAD: FBPart = {
  id: "viper_head",
  slot: "head",
  name: "Viper Head",
  hp: 6,
  abilities: [
    {
      id: "venom_bite",
      name: "Venom Bite",
      description: "Deal 3 damage and apply 2 poison/turn for 4 turns.",
      effects: [
        { kind: "damage", amount: 3 },
        { kind: "poison_opponent", turns: 4 }
      ]
    }
  ],
  passives: []
};

const HAWK_HEAD: FBPart = {
  id: "hawk_head",
  slot: "head",
  name: "Hawk Head",
  hp: 7,
  abilities: [
    {
      id: "peck",
      name: "Peck",
      description: "Deal 4 damage.",
      effects: [{ kind: "damage", amount: 4 }]
    }
  ],
  passives: [{ kind: "damage_reduction", amount: 3 }]
};

const FERAL_HEAD: FBPart = {
  id: "feral_head",
  slot: "head",
  name: "Feral Head",
  hp: 7,
  abilities: [
    {
      id: "feral_lunge",
      name: "Feral Lunge",
      description: "Deal 5 damage, apply 2 poison/turn for 2 turns to the opponent, and 2 poison/turn for 3 turns to yourself.",
      effects: [
        { kind: "damage", amount: 5 },
        { kind: "poison_opponent", turns: 2 },
        { kind: "poison_self", turns: 3 }
      ]
    }
  ],
  passives: []
};

const GOLDFISH_HEAD: FBPart = {
  id: "goldfish_head",
  slot: "head",
  name: "Goldfish Head",
  hp: 4,
  abilities: [
    {
      id: "bubble",
      name: "Bubble",
      description: "Deal 1 damage. It's trying its best.",
      effects: [{ kind: "damage", amount: 1 }]
    }
  ],
  passives: []
};

const RUBBER_CHICKEN_HEAD: FBPart = {
  id: "rubber_chicken_head",
  slot: "head",
  name: "Rubber Chicken Head",
  hp: 5,
  abilities: [
    {
      id: "squawk",
      name: "Squawk",
      description: "Deal 2 damage to yourself. Completely harmless to the opponent.",
      effects: [{ kind: "damage_self", amount: 2 }]
    }
  ],
  passives: []
};

const DRAGON_HEAD: FBPart = {
  id: "dragon_head",
  slot: "head",
  name: "Dragon Head",
  hp: 5,
  abilities: [
    {
      id: "fire_breath",
      name: "Fire Breath",
      description: "Deal 9 damage.",
      effects: [{ kind: "damage", amount: 9 }]
    },
    {
      id: "terrify",
      name: "Terrify",
      description: "If the opponent deals ≤5 damage this round, block all of it.",
      effects: [{ kind: "terrify" }]
    }
  ],
  passives: []
};

// ─── Bodies ───────────────────────────────────────────────────────────────────

const CRAB_SHELL: FBPart = {
  id: "crab_shell",
  slot: "body",
  name: "Crab Shell",
  hp: 10,
  abilities: [],
  passives: [{ kind: "damage_reduction", amount: 2 }]
};

const TOAD_BODY: FBPart = {
  id: "toad_body",
  slot: "body",
  name: "Toad Body",
  hp: 11,
  abilities: [],
  passives: [{ kind: "poison_retaliation", turns: 2 }]
};

const THORNED_BODY: FBPart = {
  id: "thorned_body",
  slot: "body",
  name: "Thorned Body",
  hp: 8,
  abilities: [],
  passives: [
    { kind: "damage_reduction", amount: 2 },
    { kind: "retaliation", amount: 2 }
  ]
};

const DRAGON_SCALES: FBPart = {
  id: "dragon_scales",
  slot: "body",
  name: "Dragon Scales",
  hp: 7,
  abilities: [],
  passives: [{ kind: "damage_reduction", amount: 3 }]
};

const MUSCLE_BODY: FBPart = {
  id: "muscle_body",
  slot: "body",
  name: "Muscle Body",
  hp: 8,
  abilities: [
    {
      id: "power_strike",
      name: "Power Strike",
      description: "Deal 7 damage.",
      effects: [{ kind: "damage", amount: 7 }]
    },
    {
      id: "flex",
      name: "Flex",
      description: "Heal 3 HP and gain +4 attack for 3 turns.",
      effects: [{ kind: "heal", amount: 3 }, { kind: "damage_buff", bonus: 4, turns: 3 }]
    }
  ],
  passives: []
};

const SKELETON_RIBS: FBPart = {
  id: "skeleton_ribs",
  slot: "body",
  name: "Skeleton Ribs",
  hp: 8,
  abilities: [
    {
      id: "bone_lance",
      name: "Bone Lance",
      description: "Deal 6 damage.",
      effects: [{ kind: "damage", amount: 6 }]
    }
  ],
  passives: [{ kind: "death_march", amount: 2 }]
};

const CURSED_BODY: FBPart = {
  id: "cursed_body",
  slot: "body",
  name: "Cursed Body",
  hp: 6,
  abilities: [],
  passives: [
    { kind: "damage_reduction", amount: 4 },
    { kind: "self_poison", turns: 10 }
  ]
};

const RABID_BODY: FBPart = {
  id: "rabid_body",
  slot: "body",
  name: "Rabid Body",
  hp: 6,
  abilities: [
    {
      id: "rabid_strike",
      name: "Rabid Strike",
      description: "Deal 13 damage and apply 2 poison/turn for 2 turns to yourself.",
      effects: [
        { kind: "damage", amount: 13 },
        { kind: "poison_self", turns: 2 }
      ]
    }
  ],
  passives: []
};

const WET_CARDBOARD_BODY: FBPart = {
  id: "wet_cardboard_body",
  slot: "body",
  name: "Wet Cardboard Body",
  hp: 3,
  abilities: [],
  passives: [{ kind: "damage_amplify", amount: 1 }]
};

const PILLOW_BODY: FBPart = {
  id: "pillow_body",
  slot: "body",
  name: "Pillow Body",
  hp: 6,
  abilities: [
    {
      id: "nap",
      name: "Nap",
      description: "Heal 1 HP. A restful choice.",
      effects: [{ kind: "heal", amount: 1 }]
    }
  ],
  passives: []
};

const SLIME_BODY: FBPart = {
  id: "slime_body",
  slot: "body",
  name: "Slime Body",
  hp: 6,
  abilities: [
    {
      id: "regenerate",
      name: "Regenerate",
      description: "Heal 6 HP.",
      effects: [{ kind: "heal", amount: 6 }]
    },
    {
      id: "acid_splash",
      name: "Acid Splash",
      description: "Deal 4 damage.",
      effects: [{ kind: "damage", amount: 4 }]
    }
  ],
  passives: []
};

// ─── Tails ────────────────────────────────────────────────────────────────────

const FLUFFY_TAIL: FBPart = {
  id: "fluffy_tail",
  slot: "tail",
  name: "Fluffy Tail",
  hp: 6,
  abilities: [],
  passives: [{ kind: "heal_per_round", amount: 3 }]
};

const SPIKE_TAIL: FBPart = {
  id: "spike_tail",
  slot: "tail",
  name: "Spike Tail",
  hp: 10,
  abilities: [
    {
      id: "tail_spike",
      name: "Tail Spike",
      description: "Deal 5 damage.",
      effects: [{ kind: "damage", amount: 5 }]
    }
  ],
  passives: [{ kind: "retaliation", amount: 3 }]
};

const ARMORED_TAIL: FBPart = {
  id: "armored_tail",
  slot: "tail",
  name: "Armored Tail",
  hp: 8,
  abilities: [
    {
      id: "tail_strike",
      name: "Tail Strike",
      description: "Deal 6 damage.",
      effects: [{ kind: "damage", amount: 6 }]
    }
  ],
  passives: [{ kind: "damage_reduction", amount: 2 }]
};

const CLUB_TAIL: FBPart = {
  id: "club_tail",
  slot: "tail",
  name: "Club Tail",
  hp: 6,
  abilities: [
    {
      id: "smash",
      name: "Smash",
      description: "Deal 10 damage.",
      effects: [{ kind: "damage", amount: 10 }]
    }
  ],
  passives: []
};

const RAZOR_TAIL: FBPart = {
  id: "razor_tail",
  slot: "tail",
  name: "Razor Tail",
  hp: 7,
  abilities: [
    {
      id: "slash",
      name: "Slash",
      description: "Deal 6 damage.",
      effects: [{ kind: "damage", amount: 6 }]
    },
    {
      id: "trip",
      name: "Trip",
      description: "If the opponent deals >6 damage this round, block all of it and reflect it back.",
      effects: [{ kind: "trip" }]
    }
  ],
  passives: []
};

const LIMP_NOODLE_TAIL: FBPart = {
  id: "limp_noodle_tail",
  slot: "tail",
  name: "Limp Noodle Tail",
  hp: 3,
  abilities: [
    {
      id: "flop",
      name: "Flop",
      description: "Deal 1 damage. Technically an attack.",
      effects: [{ kind: "damage", amount: 1 }]
    }
  ],
  passives: []
};

const DECORATIVE_TAIL: FBPart = {
  id: "decorative_tail",
  slot: "tail",
  name: "Decorative Tail",
  hp: 4,
  abilities: [],
  passives: []
};

const SCORPION_TAIL: FBPart = {
  id: "scorpion_tail",
  slot: "tail",
  name: "Scorpion Tail",
  hp: 6,
  abilities: [
    {
      id: "sting",
      name: "Sting",
      description: "Deal 2 damage and apply 2 poison/turn for 2 turns.",
      effects: [
        { kind: "damage", amount: 2 },
        { kind: "poison_opponent", turns: 2 }
      ]
    },
    {
      id: "tail_whip",
      name: "Tail Whip",
      description: "Deal 5 damage.",
      effects: [{ kind: "damage", amount: 5 }]
    }
  ],
  passives: []
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const FB_PARTS: FBPart[] = [
  GRANITE_HEAD,
  ROCK_HEAD,
  BEAR_HEAD,
  LEECH_HEAD,
  VIPER_HEAD,
  HAWK_HEAD,
  FERAL_HEAD,
  DRAGON_HEAD,
  GOLDFISH_HEAD,
  RUBBER_CHICKEN_HEAD,
  CRAB_SHELL,
  TOAD_BODY,
  THORNED_BODY,
  DRAGON_SCALES,
  MUSCLE_BODY,
  SKELETON_RIBS,
  CURSED_BODY,
  RABID_BODY,
  SLIME_BODY,
  WET_CARDBOARD_BODY,
  PILLOW_BODY,
  FLUFFY_TAIL,
  SPIKE_TAIL,
  ARMORED_TAIL,
  CLUB_TAIL,
  RAZOR_TAIL,
  SCORPION_TAIL,
  LIMP_NOODLE_TAIL,
  DECORATIVE_TAIL
];

export const FB_PARTS_BY_ID: Record<string, FBPart> = Object.fromEntries(FB_PARTS.map((p) => [p.id, p]));

export const FB_HEADS = FB_PARTS.filter((p) => p.slot === "head");
export const FB_BODIES = FB_PARTS.filter((p) => p.slot === "body");
export const FB_TAILS = FB_PARTS.filter((p) => p.slot === "tail");

// Defensive-stance thresholds (compared against the incoming attack's damage).
// Terrify blocks hits that deal ≤ TERRIFY_MAX_BLOCKED_DAMAGE; Trip blocks and
// reflects hits that deal > TRIP_BLOCK_DAMAGE_THRESHOLD. Hits in the band
// between (here, exactly 6) slip past both.
export const TERRIFY_MAX_BLOCKED_DAMAGE = 5;
export const TRIP_BLOCK_DAMAGE_THRESHOLD = 6;

export const PASS_ABILITY: FBAbility = {
  id: "pass",
  name: "Pass",
  description: "Do nothing this round. Passives still trigger at round end.",
  effects: [{ kind: "pass" }]
};

/**
 * Canonical resolution priority for the effects within a single action (lower
 * resolves first). Enforcing this makes the combat math and the play-by-play
 * log order independent of how each part happens to list its effects:
 *
 *   1. self-buffs to your attack (Roar) land before the swing
 *   2. defensive stances (Terrify / Trip) — no-op for the user, read by the
 *      opponent's attack resolution
 *   3. the attack itself
 *   4. debuffs applied to the opponent (poison)
 *   5. self-recovery (heal)
 *   6. self-debuffs (self-poison)
 *   7. self-harm (recoil)
 */
export const ACTION_EFFECT_PRIORITY: Record<FBAbilityEffect["kind"], number> = {
  damage_buff: 0,
  terrify: 1,
  trip: 1,
  damage: 2,
  poison_opponent: 3,
  heal: 4,
  poison_self: 5,
  damage_self: 6,
  pass: 7
};

/**
 * Returns the action's effects in canonical resolution order. The sort is
 * stable, so effects that share a priority keep their authored order.
 */
export function orderActionEffects(effects: FBAbilityEffect[]): FBAbilityEffect[] {
  return [...effects].sort((a, b) => ACTION_EFFECT_PRIORITY[a.kind] - ACTION_EFFECT_PRIORITY[b.kind]);
}

/** "Head Name · Body Name · Tail Name" for display. */
export function beastLabel(headId: string, bodyId: string, tailId: string): string {
  return [headId, bodyId, tailId].map((id) => FB_PARTS_BY_ID[id]?.name ?? id).join(" · ");
}

export function getBeastAbilities(headId: string, bodyId: string, tailId: string): FBAbility[] {
  const head = FB_PARTS_BY_ID[headId];
  const body = FB_PARTS_BY_ID[bodyId];
  const tail = FB_PARTS_BY_ID[tailId];
  return [
    ...(head?.abilities ?? []),
    ...(body?.abilities ?? []),
    ...(tail?.abilities ?? []),
    PASS_ABILITY
  ];
}

function getBeastPassives(headId: string, bodyId: string, tailId: string): FBPassiveEffect[] {
  const head = FB_PARTS_BY_ID[headId];
  const body = FB_PARTS_BY_ID[bodyId];
  const tail = FB_PARTS_BY_ID[tailId];
  return [
    ...(head?.passives ?? []),
    ...(body?.passives ?? []),
    ...(tail?.passives ?? [])
  ];
}

export function computeMaxHp(headId: string, bodyId: string, tailId: string): number {
  return (FB_PARTS_BY_ID[headId]?.hp ?? 0) + (FB_PARTS_BY_ID[bodyId]?.hp ?? 0) + (FB_PARTS_BY_ID[tailId]?.hp ?? 0);
}

// Passive kinds that carry a flat `amount`. Their contributions are all summed
// the same way, so they share a single helper.
type AmountPassiveKind = Extract<FBPassiveEffect, { amount: number }>["kind"];

function sumPassiveAmount(headId: string, bodyId: string, tailId: string, kind: AmountPassiveKind): number {
  return getBeastPassives(headId, bodyId, tailId).reduce(
    (sum, p) => (p.kind === kind ? sum + p.amount : sum),
    0
  );
}

export function computeDamageReduction(headId: string, bodyId: string, tailId: string): number {
  // NOTE: damage_amplify is intentionally NOT handled here — it is applied
  // separately via computeDamageAmplify so it isn't double-counted.
  return sumPassiveAmount(headId, bodyId, tailId, "damage_reduction");
}

export function computeDamageAmplify(headId: string, bodyId: string, tailId: string): number {
  return sumPassiveAmount(headId, bodyId, tailId, "damage_amplify");
}

export function computeRetaliation(headId: string, bodyId: string, tailId: string): number {
  return sumPassiveAmount(headId, bodyId, tailId, "retaliation");
}

export function computeHealPerRound(headId: string, bodyId: string, tailId: string): number {
  return sumPassiveAmount(headId, bodyId, tailId, "heal_per_round");
}

export function computeDeathMarch(headId: string, bodyId: string, tailId: string): number {
  return sumPassiveAmount(headId, bodyId, tailId, "death_march");
}

/** Returns the number of turns the beast will poison an attacker when hit (Toad Body). */
export function computePoisonRetaliation(headId: string, bodyId: string, tailId: string): number {
  return getBeastPassives(headId, bodyId, tailId).reduce(
    (max, p) => (p.kind === "poison_retaliation" ? Math.max(max, p.turns) : max),
    0
  );
}

/** Total turns of self-poison a beast inflicts on itself when assembled (Cursed Body). */
export function getSelfPoisonTurns(headId: string, bodyId: string, tailId: string): number {
  return getBeastPassives(headId, bodyId, tailId).reduce(
    (sum, p) => (p.kind === "self_poison" ? sum + p.turns : sum),
    0
  );
}

/**
 * The two players who are (or will be) the duel's fighters, in a stable order.
 * Prefers the server-assigned `fighterIds` (validating both are still present),
 * otherwise falls back to the first joiners by join order. Returns null when a
 * full pair can't be resolved (e.g. a fighter left). Shared by client and
 * server so "who is the opponent" can't drift between them.
 */
export function resolveFighterIds(room: Room, fb?: FrankenBeastsGameState): [string, string] | null {
  if (fb?.fighterIds) {
    const [p1, p2] = fb.fighterIds;
    const present = new Set(room.players.map((p) => p.id));
    return present.has(p1) && present.has(p2) ? [p1, p2] : null;
  }
  const ids = [...room.players]
    .sort((a, b) => a.joinOrder - b.joinOrder)
    .slice(0, FRANKENBEASTS_PLAYER_COUNT)
    .map((p) => p.id);
  if (ids.length < FRANKENBEASTS_PLAYER_COUNT) return null;
  return [ids[0]!, ids[1]!];
}

export function randomPartId(slot: "head" | "body" | "tail"): string {
  const pool = slot === "head" ? FB_HEADS : slot === "body" ? FB_BODIES : FB_TAILS;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx]!.id;
}
