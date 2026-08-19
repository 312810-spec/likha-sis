import { describe, it, expect } from "vitest";
import {
  SETTINGS_KEY_MIN_LENGTH,
  PBKDF2_ITERATIONS,
  SETTINGS_LOCK_ALGO,
  MAX_UNLOCK_ATTEMPTS,
  UNLOCK_COOLDOWN_MS,
  makeSalt,
  hashSettingsKey,
  verifySettingsKey,
  validateSettingsKey,
  hasSettingsKey,
  getCooldownRemainingMs,
} from "../settingsLock.js";

describe("makeSalt", () => {
  it("returns a 32-character hex string by default (16 random bytes)", () => {
    const salt = makeSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns a different salt on every call", () => {
    const salts = new Set(Array.from({ length: 20 }, () => makeSalt()));
    expect(salts.size).toBe(20);
  });
});

describe("hashSettingsKey", () => {
  it("returns a stored record with algo, iterations, salt and hash -- never the key itself", async () => {
    const record = await hashSettingsKey("correct horse");
    expect(record.algo).toBe(SETTINGS_LOCK_ALGO);
    expect(record.iterations).toBe(PBKDF2_ITERATIONS);
    expect(record.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(record)).not.toContain("correct horse");
  });

  it("is deterministic for the same key and salt", async () => {
    const salt = makeSalt();
    const a = await hashSettingsKey("my-school-key", salt);
    const b = await hashSettingsKey("my-school-key", salt);
    expect(a.hash).toBe(b.hash);
  });

  it("produces different hashes for the same key under different salts", async () => {
    const a = await hashSettingsKey("my-school-key");
    const b = await hashSettingsKey("my-school-key");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("produces different hashes for different keys under the same salt", async () => {
    const salt = makeSalt();
    const a = await hashSettingsKey("key-one", salt);
    const b = await hashSettingsKey("key-two", salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("verifySettingsKey", () => {
  it("accepts the key that produced the record", async () => {
    const record = await hashSettingsKey("tingub-2026");
    await expect(verifySettingsKey("tingub-2026", record)).resolves.toBe(true);
  });

  it("rejects a wrong key", async () => {
    const record = await hashSettingsKey("tingub-2026");
    await expect(verifySettingsKey("tingub-2027", record)).resolves.toBe(false);
  });

  it("rejects an empty attempt", async () => {
    const record = await hashSettingsKey("tingub-2026");
    await expect(verifySettingsKey("", record)).resolves.toBe(false);
  });

  it("honours the iteration count stored on the record", async () => {
    const salt = makeSalt();
    const weak = await hashSettingsKey("tingub-2026", salt, 1000);
    expect(weak.iterations).toBe(1000);
    await expect(verifySettingsKey("tingub-2026", weak)).resolves.toBe(true);
  });

  it("fails closed on a missing or malformed record", async () => {
    await expect(verifySettingsKey("anything", null)).resolves.toBe(false);
    await expect(verifySettingsKey("anything", {})).resolves.toBe(false);
    await expect(verifySettingsKey("anything", { salt: "abc" })).resolves.toBe(false);
    await expect(verifySettingsKey("anything", { hash: "abc" })).resolves.toBe(false);
  });
});

describe("validateSettingsKey", () => {
  it("requires a key", () => {
    expect(validateSettingsKey("", "")).toBeTruthy();
  });

  it("rejects a key shorter than the minimum length", () => {
    const short = "a".repeat(SETTINGS_KEY_MIN_LENGTH - 1);
    expect(validateSettingsKey(short, short)).toContain(String(SETTINGS_KEY_MIN_LENGTH));
  });

  it("rejects a mismatched confirmation", () => {
    expect(validateSettingsKey("longenoughkey", "longenoughkex")).toBeTruthy();
  });

  it("returns an empty string for a valid key and matching confirmation", () => {
    expect(validateSettingsKey("longenoughkey", "longenoughkey")).toBe("");
  });
});

describe("hasSettingsKey", () => {
  it("is false when no key has ever been set", () => {
    expect(hasSettingsKey(null)).toBe(false);
    expect(hasSettingsKey(undefined)).toBe(false);
    expect(hasSettingsKey({})).toBe(false);
    expect(hasSettingsKey({ salt: "abc" })).toBe(false);
  });

  it("is true once a salt and hash are stored", () => {
    expect(hasSettingsKey({ salt: "abc", hash: "def" })).toBe(true);
  });
});

describe("getCooldownRemainingMs", () => {
  it("is zero below the attempt limit", () => {
    expect(getCooldownRemainingMs(MAX_UNLOCK_ATTEMPTS - 1, 1000, 1000)).toBe(0);
  });

  it("returns the full cooldown immediately after the limit is hit", () => {
    expect(getCooldownRemainingMs(MAX_UNLOCK_ATTEMPTS, 1000, 1000)).toBe(UNLOCK_COOLDOWN_MS);
  });

  it("counts down as time passes", () => {
    const remaining = getCooldownRemainingMs(MAX_UNLOCK_ATTEMPTS, 1000, 1000 + UNLOCK_COOLDOWN_MS / 2);
    expect(remaining).toBe(UNLOCK_COOLDOWN_MS / 2);
  });

  it("is zero once the cooldown has elapsed", () => {
    expect(getCooldownRemainingMs(MAX_UNLOCK_ATTEMPTS, 1000, 1000 + UNLOCK_COOLDOWN_MS)).toBe(0);
    expect(getCooldownRemainingMs(MAX_UNLOCK_ATTEMPTS, 1000, 9_999_999)).toBe(0);
  });

  it("is zero when no failure has been recorded", () => {
    expect(getCooldownRemainingMs(MAX_UNLOCK_ATTEMPTS, null, 5000)).toBe(0);
  });
});
