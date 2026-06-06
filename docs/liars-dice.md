# Bluffer's Hoard

A bluffing dice duel. Everyone hides a cup of dice and the table escalates a
single public claim about how many of a face are showing across **all** cups —
until someone calls **Liar!** Read your opponents, push your luck, and don't be
the one left without dice.

- **Players:** 2–12, competitive (the host can add `fortress-bot` players to
  fill seats)
- **Goal:** be the **last player with any dice left**

---

## The cups

- Every player starts with **5 dice**.
- At the start of each round, all live dice are **secretly re-rolled** from that
  round's seed. You only see your own dice; opponents' cups stay hidden until a
  call is resolved.
- Each die shows a face from **1 to 6**. **There are no wilds** — only exact
  matches of a face count.

---

## Round flow

| Phase | Duration | What happens |
| --- | --- | --- |
| **Roll** | 3s | The cups are shaken and your dice settle. The round's seed **hash** is published while everything is hidden. |
| **Bidding** | 20s per turn | Players act one at a time. On your turn, **raise the bid** or **call Liar!** |
| **Showdown** | 5s | A call is resolved: every cup is revealed (and the seed is published so the roll can be verified). The loser drops a die. |
| **Finished** | — | One player has dice left — they win. The host can start a rematch. |

The player who opens the bidding each round is the one who **lost the previous
showdown** (or, if they were knocked out, the next player along). The opener
must place the first bid — you can't call when there's no standing bid.

---

## Bids

A **bid** is a claim: *"there are at least **N** dice showing face **F** across
the whole table."*

A **raise** must be strictly higher than the standing bid. Compare on
`(quantity, face)`:

- **increase the quantity** (to any face — even a lower one), or
- **keep the quantity and raise the face**.

You can never bid more dice than are currently in play.

### Calling Liar!

When you don't believe the standing bid, call **Liar!** Every cup is revealed
and the dice showing the bid's face are counted across the table:

- If the count is **at least** the bid's quantity, the bid **held** — the
  **caller** was wrong and **loses a die**.
- If the count **falls short**, the bluff is **caught** — the **bidder** loses a
  die.

A player who loses their **last** die is **knocked out**. When only one player
has dice remaining, they win.

### Timeouts & fairness

- If you let the **20-second** timer run out on your turn, you **auto-raise**
  with the smallest legal bump (or, as the opener, a small opening bid). The
  game never auto-calls for you, so a frozen player can't accidentally end a
  round.
- Each round's dice are rolled from a **commit-reveal seed**: the seed's hash is
  published while the cups are hidden, and the plaintext seed is revealed at the
  showdown — so the dice can be verified and were provably not changed after the
  bids.

---

## Tips & strategy

- **Count what you can see.** You know your own dice for certain; assume the
  rest of the table is spread roughly evenly (about one in six of each face).
- **Bid what you hold.** Claiming a face you have several of is safer and harder
  to read.
- **Watch the dice count.** Fewer dice on the table means lower honest bids — a
  claim that was safe with 40 dice is a bluff with 8.
- **Call the over-reach.** When a bid climbs above what could plausibly be on
  the table, pull the trigger before someone passes the risk to you.
- **Mind who opens next.** Losing a showdown hands you the opening bid next
  round — sometimes worth eating a small risk to avoid leading from behind.
