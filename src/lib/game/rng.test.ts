import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRoundSeed, mulberry32, stringToSeed } from "@/lib/game/rng";

test("createRoundSeed hash matches plain seed", () => {
  const seed = createRoundSeed();
  const expected = createHash("sha256").update(seed.seedPlain).digest("hex");
  assert.equal(seed.seedHash, expected);
});

test("mulberry32 returns deterministic sequence for same seed", () => {
  const rngA = mulberry32(stringToSeed("abc"));
  const rngB = mulberry32(stringToSeed("abc"));
  assert.equal(rngA(), rngB());
  assert.equal(rngA(), rngB());
});
