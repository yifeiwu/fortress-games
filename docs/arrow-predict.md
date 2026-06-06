# Acchi Muite Hoi

A fast "look away" duel of nerve and misdirection. Each round one player is the
**leader** pointing a direction, and everyone else tries to look *anywhere else*.
Read the crowd as leader, or dodge the point as a follower.

- **Players:** 2 or more (the host can add `fortress-bot` players to fill seats)
- **Goal:** have the highest score after everyone has taken a turn as leader

---

## Round flow

| Phase | Duration | What happens |
| --- | --- | --- |
| **Intro** | 3s | The round is announced and the leader is revealed. |
| **Round open** | 10s | Everyone secretly chooses a direction: **up, down, left, or right**. |
| **Reveal** | 4s | Choices are shown, catches/dodges are scored, then the next round begins. |

The **leader rotates every round** (in player order), and the game runs for
exactly as many rounds as there are players — so everyone leads once.

---

## How to play

- Use the **arrow keys** (or the on-screen buttons) to pick a direction while the
  round is open. You can change your mind until the timer ends.
- **Leader:** you're "pointing." You score by catching followers who happen to
  look the same way you point.
- **Followers:** you're "dodging." You score by looking a *different* direction
  than the leader.

### Scoring

- **Follower dodges** (picks a different direction than the leader): **+1 point**.
- **Follower is caught** (picks the same direction as the leader): **0 points**.
- **Leader** earns an escalating jackpot based on how many followers they catch in
  a single round (a triangular sum), so snaring several at once is far more
  valuable than picking off one at a time:

  | Caught this round | Leader points |
  | --- | --- |
  | 1 | 1 |
  | 2 | 3 |
  | 3 | 6 |
  | 4 | 10 |
  | n | n × (n + 1) / 2 |

### Timeouts & fairness

- If a **leader** doesn't choose in time, they point a **provably-fair random**
  direction.
- If a **follower** freezes, they get caught looking the leader's way (no points).
- Each round uses **commit-reveal randomness**: the seed's hash is published while
  the round is open and the plaintext seed is revealed afterward, so any
  auto-random choice can be verified after the fact.

---

## Tips & strategy

- **As a follower, avoid being predictable.** If you always dodge the same way,
  an observant leader will point right at you.
- **As the leader, hunt the herd.** The jackpot rewards reading where most
  followers will look and pointing there — two or three catches at once is worth
  far more than a safe single catch.
- **Watch the clock.** Locking in early is fine, but you can keep adjusting until
  the timer ends — sometimes worth waiting to bluff.
- **Everyone leads once**, so a strong leader round can swing the whole game;
  don't waste your turn in the spotlight.
