/**
 * Sliding-window rate limiter for room chat. Tracks recent message timestamps
 * per room+player and rejects bursts above the configured ceiling. Kept as its
 * own collaborator so the session service doesn't also own this bookkeeping.
 */
export class ChatRateLimiter {
  private readonly timestamps = new Map<string, number[]>();

  constructor(
    private readonly windowMs = 10_000,
    private readonly maxMessages = 10
  ) {}

  /** Records a message, throwing when the sender is over the limit. */
  check(roomCode: string, playerId: string, now = Date.now()): void {
    const key = `${roomCode}:${playerId}`;
    const recent = (this.timestamps.get(key) ?? []).filter((at) => now - at < this.windowMs);
    if (recent.length >= this.maxMessages) {
      throw new Error("You're sending messages too quickly. Slow down a moment.");
    }
    recent.push(now);
    this.timestamps.set(key, recent);
  }
}
