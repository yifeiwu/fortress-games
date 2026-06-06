const ROOM_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createRoomCode(existingCodes: Set<string>): string {
  for (let i = 0; i < 5000; i += 1) {
    let next = "";
    for (let j = 0; j < 6; j += 1) {
      next += ROOM_LETTERS[Math.floor(Math.random() * ROOM_LETTERS.length)];
    }
    if (!existingCodes.has(next)) {
      return next;
    }
  }
  throw new Error("Could not create a unique room code.");
}
