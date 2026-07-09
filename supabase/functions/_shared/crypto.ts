/**
 * Application-layer encryption for sensitive free-text PHI fields
 * (medical_records.notes, medical_records.extracted_data), on top of -
 * not instead of - Supabase's at-rest encryption. This protects against a
 * raw database dump or backup being plaintext PHI.
 *
 * Design notes:
 * - AES-256-GCM via the standard Web Crypto API (`crypto.subtle`), not
 *   pgsodium. Both were offered as options; AES-GCM was chosen because it
 *   can be implemented and genuinely unit-tested here without a live
 *   Supabase/pgsodium instance to verify against, and because the actual
 *   encrypt/decrypt operations happen server-side in the edge function
 *   (see supabase/functions/extract-medical-data), never in the browser -
 *   so the key never needs to reach client code, unlike a client-side
 *   pgsodium/Vault key would.
 * - Ciphertext format: base64(iv[12 bytes] || ciphertext || authTag). GCM's
 *   authTag is appended by SubtleCrypto automatically, so this is just
 *   "iv followed by whatever encrypt() returns".
 * - This module is intentionally framework-agnostic (only uses
 *   `globalThis.crypto.subtle` and `TextEncoder`/`TextDecoder`), so the
 *   exact same file runs in Deno (edge functions) and in Node (vitest),
 *   which is what lets it be covered by a real round-trip test instead of
 *   only reviewed by eye.
 */

const ALGO = "AES-GCM";
const IV_LENGTH_BYTES = 12;

async function importKey(rawKeyBase64: string): Promise<CryptoKey> {
  const rawKey = Uint8Array.from(atob(rawKeyBase64), (c) => c.charCodeAt(0));
  if (rawKey.length !== 32) {
    throw new Error("PHI encryption key must decode to exactly 32 bytes (AES-256)");
  }
  return globalThis.crypto.subtle.importKey("raw", rawKey, ALGO, false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Encrypts plaintext, returning a single base64 string safe to store in a text/bytea column. */
export async function encryptPhi(plaintext: string, rawKeyBase64: string): Promise<string> {
  const key = await importKey(rawKeyBase64);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await globalThis.crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return bytesToBase64(combined);
}

/** Reverses encryptPhi(). Throws if the key is wrong or the ciphertext was tampered with (GCM auth tag fails). */
export async function decryptPhi(encoded: string, rawKeyBase64: string): Promise<string> {
  const key = await importKey(rawKeyBase64);
  const combined = base64ToBytes(encoded);
  const iv = combined.slice(0, IV_LENGTH_BYTES);
  const ciphertext = combined.slice(IV_LENGTH_BYTES);

  const plaintextBuffer = await globalThis.crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext);
  return new TextDecoder().decode(plaintextBuffer);
}
