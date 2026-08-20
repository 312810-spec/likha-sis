// src/utils/settingsLock.js
// The "School Settings key" -- the safety net in front of the ICT Coordinator's
// School Settings page. Changing school identity, grade levels, SHS clusters or
// the academic calendar re-shapes data every downstream form depends on (SF1,
// SF9, SF10, Consolidated Grades), so those edits sit behind a second secret
// that is deliberately NOT the account password.
//
// Only a PBKDF2-SHA256 derivation of the key is ever persisted, in
// settings/security. The plaintext key never leaves the browser and is never
// written to Firestore. Web Crypto is used directly so this adds no npm
// dependency -- consistent with the rest of the project.
//
// Threat model, stated honestly: settings/security is readable by the
// ictCoordinator role itself, so this guards against accidental edits, a
// forgotten open tab, or a borrowed workstation -- not against a determined
// ICT Coordinator, who can already rewrite the doc outright.

export const SETTINGS_LOCK_ALGO = "PBKDF2-SHA256";
export const PBKDF2_ITERATIONS = 150000;
export const SETTINGS_KEY_MIN_LENGTH = 8;
export const SALT_BYTES = 16;
export const DERIVED_BITS = 256;

// Wrong-attempt throttle. Purely client-side and in-memory: a real attacker
// with Firestore credentials bypasses it, but it stops repeated guessing at
// the keyboard, which is the case this feature actually defends against.
export const MAX_UNLOCK_ATTEMPTS = 5;
export const UNLOCK_COOLDOWN_MS = 60000;

function getSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Web Crypto is unavailable. LIKHA-SIS must be served over HTTPS (or localhost) to set or verify the School Settings key."
    );
  }
  return subtle;
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generates a fresh random salt as a lowercase hex string. */
export function makeSalt(byteLength = SALT_BYTES) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function derive(key, salt, iterations) {
  const subtle = getSubtle();
  const encoder = new TextEncoder();
  const material = await subtle.importKey("raw", encoder.encode(key), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations,
      hash: "SHA-256",
    },
    material,
    DERIVED_BITS
  );
  return toHex(bits);
}

/**
 * Derives the storable record for a School Settings key.
 * Returns { algo, iterations, salt, hash } -- safe to write to Firestore.
 */
export async function hashSettingsKey(key, salt = makeSalt(), iterations = PBKDF2_ITERATIONS) {
  const hash = await derive(String(key ?? ""), salt, iterations);
  return { algo: SETTINGS_LOCK_ALGO, iterations, salt, hash };
}

// Length-independent comparison so a wrong key can't be narrowed down by
// timing. Overkill for a client-side check, but free.
function constantTimeEquals(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Checks an attempted key against a stored record. Fails closed: a missing or
 * malformed record can never unlock the page.
 */
export async function verifySettingsKey(attempt, record) {
  if (!hasSettingsKey(record)) return false;
  if (!attempt) return false;
  const iterations = Number.isFinite(record.iterations) ? record.iterations : PBKDF2_ITERATIONS;
  const { hash } = await hashSettingsKey(attempt, record.salt, iterations);
  return constantTimeEquals(hash, record.hash);
}

/**
 * Validates a new key and its confirmation.
 * Returns "" when valid, or a user-facing error message.
 */
export function validateSettingsKey(key, confirmation) {
  const value = String(key ?? "");
  if (!value) return "Please enter a School Settings key.";
  if (value.length < SETTINGS_KEY_MIN_LENGTH) {
    return `The School Settings key must be at least ${SETTINGS_KEY_MIN_LENGTH} characters.`;
  }
  if (value !== String(confirmation ?? "")) return "The two keys do not match.";
  return "";
}

/** True once a key has actually been stored (a school that has never set one is not locked out). */
export function hasSettingsKey(record) {
  return Boolean(record && typeof record.salt === "string" && typeof record.hash === "string" && record.salt && record.hash);
}

/** Milliseconds left on the wrong-attempt cooldown, or 0 when entry is allowed. */
export function getCooldownRemainingMs(failedAttempts, lastFailedAt, now = Date.now()) {
  if (!lastFailedAt) return 0;
  if (failedAttempts < MAX_UNLOCK_ATTEMPTS) return 0;
  const remaining = UNLOCK_COOLDOWN_MS - (now - lastFailedAt);
  return remaining > 0 ? remaining : 0;
}
