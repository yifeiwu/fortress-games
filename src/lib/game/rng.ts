import { createHash, randomBytes } from "crypto";

export interface SeedCommitment {
  seedPlain: string;
  seedHash: string;
  rngAlgo: "mulberry32";
}

export function createRoundSeed(): SeedCommitment {
  const seedPlain = randomBytes(16).toString("hex");
  const seedHash = createHash("sha256").update(seedPlain).digest("hex");
  return {
    seedPlain,
    seedHash,
    rngAlgo: "mulberry32"
  };
}

export function mulberry32(seed: number): () => number {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stringToSeed(source: string): number {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
