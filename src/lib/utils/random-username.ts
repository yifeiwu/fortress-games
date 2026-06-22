const ADJECTIVES = [
  "Swift",
  "Brave",
  "Clever",
  "Lucky",
  "Mighty",
  "Sneaky",
  "Fierce",
  "Witty",
  "Bold",
  "Jolly",
  "Sly",
  "Nimble",
  "Daring",
  "Quiet",
  "Stormy",
  "Cosmic",
  "Golden",
  "Shadow",
  "Crimson",
  "Frosty"
];

const NOUNS = [
  "Falcon",
  "Tiger",
  "Otter",
  "Raven",
  "Fox",
  "Wolf",
  "Badger",
  "Hawk",
  "Panda",
  "Dragon",
  "Phoenix",
  "Lynx",
  "Viper",
  "Moose",
  "Heron",
  "Comet",
  "Wizard",
  "Ranger",
  "Knight",
  "Nomad"
];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Generate a friendly, human-readable display name (e.g. "Swift Falcon").
 * Callers that need cross-session uniqueness should retry against their own
 * taken-name check, since this is best-effort random and may collide.
 */
export function randomUsername(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}
