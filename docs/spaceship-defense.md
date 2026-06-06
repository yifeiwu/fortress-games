# Starshield Crisis

A co-operative bridge-crew survival game. The whole crew shares **one ship** and
wins or loses together: charge the jump drive and escape before incoming fire
tears the hull apart.

- **Players:** 2 or more, fully co-operative (the host can add `fortress-bot`
  crew members)
- **Goal:** fully charge the jump drive and **jump away** before the **hull**
  hits 0

---

## The ship

| System | Start | Cap | Notes |
| --- | --- | --- | --- |
| **Hull** | 10 | 10 | If it reaches 0, the ship is lost. Damage is permanent — the hull cannot be repaired. |
| **Shields** | 0 | 6 | Absorb incoming damage before the hull; do not regenerate on their own. |
| **Jump drive** | 0 | crew + 6 | Charge it to the target, then jump away to win. |
| **Energy** | 2 | 10 | A shared crew power reserve. **Regenerates +1 at the start of every player's turn.** Most actions spend it. |

The jump target scales with crew size (more players = a longer charge), so bigger
crews have more hands but a higher escape threshold.

---

## Turn structure

Each round, players take a turn **one at a time in join order**. After every crew
member has acted, the **enemy phase** resolves and a new round begins.

- At the **start of your turn the crew's shared energy regenerates by +1**
  (capped at 10).
- Each turn has a **40-second timer**. If you don't act in time, you **lose that
  turn's action** — but the energy you regenerated still stays banked (the same
  as choosing to **Pass**).
- Play continues round after round until the crew jumps away (win) or the hull is
  destroyed (loss).

### Your actions (pick one per turn)

| Action | Energy | Effect |
| --- | --- | --- |
| **Shoot** | 1 | Deal **1–3 random damage** to a chosen threat. Also reveals that threat's attack value if it was hidden. |
| **Full Shields** | 3 | Charge shields **straight to the cap (6)** — expensive, but a complete refill in one turn. |
| **Charge Jump** | 2 | Add **+1** to the jump drive. |
| **Jump Away** | free | Only available when the drive is fully charged — escapes and **wins** the game for everyone (guaranteed). |
| **Emergency Jump** | free | A risky escape when the drive **isn't** fully charged: overload it with raw power. Success **chance scales with how charged the drive already is** (`jump charge ÷ target`, so a nearly-charged drive is a near sure thing and a cold drive is hopeless). Jumping itself costs **no energy** — the only cost is the risk. **On failure the drive overloads and the ship is destroyed — game over.** Requires confirmation. |
| **Pass** | free | Skip your action and **bank the +1 energy** you generated this turn. |

Energy is shared across the whole crew. Because every turn only regenerates +1,
spending it on an action is roughly break-even — so to build a reserve for a busy
stretch (or to free up a teammate to charge the jump drive), some crew members
have to **Pass** and bank energy. If you can't afford an action, that option is
disabled until the reserve recovers.

### Enemy phase

After the crew has acted, every threat's attack countdown ticks down by 1 — each
contact advances one approach zone closer (T-3 → T-2 → T-1). When a threat's
countdown hits 0:

1. It attacks. **Shields absorb the damage first**; any overflow hits the hull.
2. Its countdown resets to its attack interval (one-shot threats vanish instead).

The round then **replays as a play-by-play**: each crew member's action and its
effect plays out one beat at a time, then the enemy fire lands hit-by-hit, before
the next round opens.

---

## Threats

| Threat | Health | Attack | Fires every | Notes |
| --- | --- | --- | --- | --- |
| **Raider** | 2 | 1 | 2 turns | The basic nuisance. |
| **Destroyer** | 8 | 2 | 3 turns | Tanky and hits hard. |
| **Missile** | 1 | 3 | 1 turn | One-shot: fires once for big damage, then disappears. Kill it first. |
| **Stealth Ship** | 3 | 2 | 2 turns | Its attack value is **hidden** until you shoot it (or it fires). |

### Enemy stream & approach zones

Enemies arrive as a **continuous stream** rather than batched waves. **Every
round — including the opening round — new contacts warp in at long range (T-3)**
and march inward as their countdowns tick, passing through three approach zones
shown in the tactical view:

- **T-3 / Far** → **T-2** → **T-1 / Impact** (about to fire).

Each round's spawn is:

- A random spawn of contacts drawn from Raider / Missile / Stealth Ship (the
  opening round is floored to at least one). The size of this random spawn
  **scales with crew size** so per-player pressure stays roughly constant: a
  4-player crew sees the baseline **0–3 contacts**, smaller crews fewer, and
  larger crews proportionally more (since each extra player adds energy and an
  action every round).
- A guaranteed **Destroyer every 3rd round** (rounds 3, 6, 9, …; never on the
  initial round), on top of the random contacts.
- A **Threat Level** that scales the random spawn: each tier above the first
  adds **+1 contact** to that round's stream (see below).

### Threat Level

A **Threat Level meter** in the HUD shows how hard the sector is escalating. It
starts at tier 1 (**Skirmish**) and climbs one tier **every 3 rounds**
(**Elevated → Severe → Critical → Overrun**), shading from green to red as it
rises. The meter is the single source of truth for the difficulty ramp: each
tier above the first adds **+1 contact** to the round's random spawn, so the
longer the crew stays, the heavier every wave gets. The bar fills across the
current tier and pulses red once you hit **Overrun** — the field is about to be
overrun, so charge and jump before it does. (Threat Level is a pure function of
the round, so the same seed always escalates identically.)

Spawn counts and composition are **rolled from the seed**, so the same seed
always produces the same arrivals.

Threat attack timers and weapon damage use **seeded randomness**, so the same
seed always produces the same encounter.

---

## Tips & strategy

- **Co-ordinate as a crew.** You share one ship and one outcome — talk in chat
  about who shoots, who shields, and who charges so actions don't overlap.
- **Kill missiles immediately.** They only have 1 HP but hit for 3 and fire every
  turn until destroyed.
- **Don't ignore the jump drive.** Pure defense never wins — someone has to keep
  charging. Bigger crews need more total charge, so start early.
- **Shield before the big hits land.** Watch the countdowns: stack shields the
  turn before a Destroyer or several threats are due to fire.
- **Shoot stealth ships to reveal their attack**, so you can plan around the
  damage instead of guessing.
- **The hull can't be repaired.** Every point of hull damage is permanent, so
  shield ahead of incoming fire and kill threats before they whittle you down.
- **Manage the shared energy.** Every action draws from one crew-wide reserve
  that only refills +1 per turn. If a quiet moment comes up, have a teammate
  **Pass** to bank energy so the crew can act freely when the threat row heats up.
- **Watch the approach zones.** New contacts enter at T-3 and take a few rounds to
  reach impact — pick off threats while they're still far out, and pre-shield the
  round before a cluster (or a Destroyer) reaches T-1.
- **Gamble the emergency jump as a true last resort.** If the hull is about to fail,
  the odds scale with how charged the drive already is — a nearly-charged drive
  makes the emergency jump a near sure thing, but a barely-charged drive is a long
  shot. The jump itself is free, but **failure destroys the ship outright**, so
  only roll the dice when there's no safer option.
