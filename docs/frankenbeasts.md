# FrankenBeasts

Build a monster out of three mismatched parts and fight a single opponent to the
death. It's a fast, simultaneous-turn duel where the right combination of body
parts matters more than reflexes.

- **Players:** exactly 2 (the host can fill the second seat with a `fortress-bot`
  that builds a random beast and acts randomly each round)
- **Goal:** reduce the opponent's beast to 0 HP (or have more HP% when the round
  limit is reached)

---

## Phases

| Phase | Duration | What happens |
| --- | --- | --- |
| **Pick** | 60s | Both players secretly choose one Head, one Body, and one Tail, then **Lock In**. When both lock in (or the timer ends) the beasts are assembled. Unpicked slots are filled randomly. |
| **Fight round** | 15s | Each player selects one action. Nothing happens until the timer ends — then both actions resolve **simultaneously**. If you don't choose, you auto-`Pass`. |
| **Reveal** | 7s | Both chosen actions and the updated HP bars are shown, then the next fight round begins. |
| **Finished** | — | A winner (or draw) is declared. The host can start a rematch. |

Your beast's **max HP** is the sum of the HP of its three parts. Your available
actions are the abilities of your three parts, plus `Pass` (always available to
everyone).

---

## How a fight round resolves

Actions resolve in a fixed order each round:

1. **Active abilities** (both players at once): damage, heals, poison
   application, Roar, self-damage. Defensive reactions (**Terrify** / **Trip**)
   are checked against the incoming attack. When a single ability bundles
   several effects, they always resolve in this canonical priority (regardless
   of how the part lists them):

   1. self-buffs to your attack (**Roar**)
   2. defensive stance (**Terrify** / **Trip**)
   3. the **attack** itself
   4. **poison** applied to the opponent
   5. **heal** yourself
   6. **self-poison**
   7. **self-damage** (recoil)
2. **Direct-blow win check** — if an attack drops a beast to 0 HP, that result is
   *locked in immediately*, before any passive/poison can change it. Killing the
   opponent with a direct hit wins even if you'd die to poison at end of round.
3. **Passives:** Skeleton Ribs (death march), Fluffy Tail (heal per round).
4. **Retaliation** — only triggers against an opponent who actually dealt direct
   damage this round.
5. **Poison ticks** — each poisoned beast takes its poison damage, then the
   duration counts down.
6. **Buff countdown** — Roar durations decrement.
7. **Final win check** — if no one won by a direct blow, deaths from
   poison/passives are evaluated now (simultaneous deaths = draw).

### Damage formula

```
final damage = max(0, base + roarBonus − targetReduction + targetAmplify)
```

- `roarBonus` applies only while your Roar buff is active.
- `targetReduction` is the sum of the defender's damage-reduction passives
  (Cursed Body contributes a flat +4 armor).
- `targetAmplify` is added by damage-amplification passives, if any.

### Win conditions

- **Knockout:** opponent hits 0 HP.
- **Simultaneous knockout:** both hit 0 HP → **draw**.
- **Round limit (30 rounds):** if neither beast has died, the winner is decided
  by **remaining HP percentage** (equal % → draw). This prevents two purely
  defensive beasts from fighting forever.
- **Forfeit:** if a player leaves mid-match, the remaining player wins.

---

## Status effects

- **Poison** ☠ — deals 2 damage per stack each round for a number of turns.
  Re-applying poison adds +2 damage per turn and refreshes to the longest
  duration (it does not extend additively).
- **Roar** 🦁 — `+bonus` to all your attacks for a set number of turns.

---

## Parts catalog

### Heads

| Part | HP | Abilities | Passive |
| --- | --- | --- | --- |
| Granite Head | 17 | — | — |
| Rock Head | 12 | **Roar** — +4 attack for 3 turns | — |
| Bear Head | 10 | **Maul** — 8 dmg | — |
| Leech Head | 10 | **Drain Bite** — 5 dmg, heal 3 | — |
| Viper Head | 6 | **Venom Bite** — 3 dmg + 2 poison/turn (4t) | — |
| Hawk Head | 7 | **Peck** — 4 dmg | −3 incoming dmg |
| Dragon Head | 5 | **Fire Breath** — 9 dmg; **Terrify** — block the opponent's attack if it deals ≤5 | — |
| Goldfish Head | 4 | **Bubble** — 1 dmg | — |
| Alien Head | 9 | **Headbite** — 6 dmg | — |

### Bodies

| Part | HP | Abilities | Passive |
| --- | --- | --- | --- |
| Crab Shell | 10 | — | −2 incoming dmg |
| Toad Body | 11 | — | **Poison Skin** — poisons attacker (2/turn, 2t) when hit by a direct attack |
| Thorned Body | 8 | — | −2 incoming dmg; 2 retaliation when hit |
| Muscle Body | 8 | **Power Strike** — 7 dmg; **Flex** — heal 3 + +4 attack for 3 turns | — |
| Skeleton Ribs | 8 | **Bone Lance** — 6 dmg | 2 passive dmg/round to the opponent |
| Dragon Scales | 7 | — | −3 incoming dmg |
| Cursed Body | 6 | — | +4 armor; self-poison (2/turn) for 10 turns on assembly |
| Rabid Body | 6 | **Rabid Strike** — 13 dmg + poison self (2/turn, 2t) | — |
| Slime Body | 6 | **Regenerate** — heal 6; **Acid Splash** — 4 dmg | — |
| Pillow Body | 6 | **Nap** — heal 1 | — |

### Tails

| Part | HP | Abilities | Passive |
| --- | --- | --- | --- |
| Fluffy Tail | 6 | — | +3 HP/round |
| Spike Tail | 10 | **Tail Spike** — 5 dmg | 3 retaliation when hit |
| Armored Tail | 8 | **Tail Strike** — 6 dmg | −2 incoming dmg |
| Club Tail | 6 | **Smash** — 10 dmg | — |
| Razor Tail | 7 | **Slash** — 6 dmg; **Trip** — block & reflect the opponent's attack if it deals >6 | — |
| Scorpion Tail | 6 | **Sting** — 2 dmg + 2 poison/turn (2t); **Tail Whip** — 5 dmg | — |
| Decorative Tail | 4 | — | — |

---

## Tips & strategy

- **Balance HP and offense.** A 34-HP wall (Granite + Crab + Fluffy) has no
  attacks and wins only on the round-limit HP tiebreak — fun, but it can't close
  out a game. Pair beefy parts with at least one real attack.
- **Poison wins slow games.** Viper/Scorpion poison ignores armor and ticks
  every round. Against high-reduction tanks, poison is often your best damage.
- **Toad Body's Poison Skin punishes direct attackers** by poisoning them back (2/turn, 2t) every time they land a direct hit. It's a deterrent against physical damage dealers, not a poison counter.
- **Terrify vs. Trip — read the threat.** Terrify (Dragon Head) shuts down small
  hits (≤5). Trip (Razor Tail) blocks *and reflects* big hits (>6). Neither helps
  against the damage band in between, so pick based on what your opponent is
  likely swinging.
- **Retaliation punishes attackers.** Spike/Thorned tails/bodies only hurt
  opponents who land direct damage — they do nothing against a passing or
  poison-only opponent.
- **Roar is a tempo play.** Spending a turn on Roar (Rock Head) only pays off if
  you survive to land the buffed hits over the following 3 turns.
- **Cursed Body is a clock.** The +4 armor makes you very tanky, but the
  20 damage of self-poison it deals on assembly means you must win quickly.
- **Goldfish is a challenge pick.** Its weak attack is useful mostly when you want
  to trade power for a little extra style.
- **Direct kills beat poison kills.** If you can land the lethal blow this round,
  you win even if your beast would otherwise die to end-of-round poison.
