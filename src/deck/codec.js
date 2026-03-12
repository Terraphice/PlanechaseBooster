// ── deck-codec.js ─────────────────────────────────────────────────────────────
// Pure encoding/decoding utilities for deck and game state seeds.
// These functions have no DOM or module-state dependencies.

/**
 * Compresses a card key by replacing known type prefixes with single characters.
 * @param {string} key - The full card key (e.g. "Plane_Akoum").
 * @returns {string} The compressed key (e.g. "pAkoum").
 */
export function compressKey(key) {
  if (key.startsWith("Plane_")) return "p" + key.slice(6);
  if (key.startsWith("Phenomenon_")) return "n" + key.slice(11);
  return "u" + key;
}

/**
 * Decompresses a compressed card key back to its full form.
 * @param {string | null | undefined} compressed - The compressed key (e.g. "pAkoum").
 * @returns {string | null} The full card key, or null if invalid.
 */
export function decompressKey(compressed) {
  if (!compressed || compressed.length < 2) return null;
  const pre = compressed[0];
  const rest = compressed.slice(1);
  if (pre === "p") return "Plane_" + rest;
  if (pre === "n") return "Phenomenon_" + rest;
  if (pre === "u") return rest;
  return null;
}

/**
 * Encodes a UTF-8 string to a URL-safe base64 string (no +, /, or = characters).
 * @param {string} str - The string to encode.
 * @returns {string} URL-safe base64 encoded string.
 */
export function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decodes a URL-safe base64 string back to a UTF-8 string.
 * @param {string} b64 - URL-safe base64 string to decode.
 * @returns {string} The decoded UTF-8 string.
 */
export function fromBase64Url(b64) {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Encodes a deck map to a shareable "d1:" seed string.
 * @param {Map<string, number>} map - Map of card key → count.
 * @returns {string} Encoded seed, or empty string if the deck is empty.
 */
export function encodeDeck(map) {
  const entries = [...map.entries()]
    .filter(([, c]) => c > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return "";

  const raw = entries.map(([k, c]) => {
    const ck = compressKey(k);
    return c === 1 ? ck : `${ck}*${c}`;
  }).join(",");

  try {
    return "d1:" + toBase64Url(raw);
  } catch {
    return "";
  }
}

/**
 * Decodes a "d1:" seed string into a deck map.
 * @param {string | null | undefined} seed - The seed string to decode.
 * @param {number} [maxCardCount=9] - Maximum allowed copies per card.
 * @returns {Map<string, number>} Map of card key → count; empty map if invalid.
 */
export function decodeDeck(seed, maxCardCount = 9) {
  if (!seed?.startsWith("d1:")) return new Map();
  try {
    const raw = fromBase64Url(seed.slice(3));
    const map = new Map();
    for (const part of raw.split(",")) {
      if (!part) continue;
      const starIdx = part.lastIndexOf("*");
      let ck, count;
      if (starIdx >= 1 && /^\d+$/.test(part.slice(starIdx + 1))) {
        ck = part.slice(0, starIdx);
        count = Math.max(1, Math.min(maxCardCount, parseInt(part.slice(starIdx + 1), 10)));
      } else {
        ck = part;
        count = 1;
      }
      const key = decompressKey(ck);
      if (key) map.set(key, count);
    }
    return map;
  } catch {
    return new Map();
  }
}
