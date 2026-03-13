// ── deck-codec.js ─────────────────────────────────────────────────────────────
// Pure encoding/decoding utilities for deck and game state seeds.
// These functions have no DOM or module-state dependencies.

/**
 * Compresses a card id by replacing known type prefixes with single characters.
 * @param {string} id - The card id (e.g. "plane_akoum").
 * @returns {string} The compressed id (e.g. "pakoum").
 */
export function compressKey(id) {
  if (id.startsWith("plane_")) return "p" + id.slice(6);
  if (id.startsWith("phenomenon_")) return "n" + id.slice(11);
  return "u" + id;
}

/**
 * Decompresses a compressed card id back to its full form.
 * @param {string | null | undefined} compressed - The compressed id (e.g. "pakoum").
 * @returns {string | null} The full card id, or null if invalid.
 */
export function decompressKey(compressed) {
  if (!compressed || compressed.length < 2) return null;
  const pre = compressed[0];
  const rest = compressed.slice(1);
  if (pre === "p") return "plane_" + rest;
  if (pre === "n") return "phenomenon_" + rest;
  if (pre === "u") return rest;
  return null;
}

/**
 * Converts an old-format card key (e.g. "Plane_Akoum") to the new id format (e.g. "plane_akoum").
 * Used for backward compatibility when loading d1:/g1: seeds.
 * @param {string} oldKey - Old format card key.
 * @returns {string} New format card id.
 */
export function remapLegacyKey(oldKey) {
  if (oldKey.startsWith("Plane_")) {
    const name = oldKey.slice(6)
      .replace(/\u2014/g, "-")
      .replace(/[ _]+/g, "_")
      .replace(/[^a-z0-9_-]/gi, "")
      .toLowerCase();
    return "plane_" + name;
  }
  if (oldKey.startsWith("Phenomenon_")) {
    const name = oldKey.slice(11)
      .replace(/\u2014/g, "-")
      .replace(/[ _]+/g, "_")
      .replace(/[^a-z0-9_-]/gi, "")
      .toLowerCase();
    return "phenomenon_" + name;
  }
  return oldKey.toLowerCase().replace(/\s+/g, "_");
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
 * Encodes a deck map to a shareable "d2:" seed string using the new id format.
 * @param {Map<string, number>} map - Map of card id → count.
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
    return "d2:" + toBase64Url(raw);
  } catch {
    return "";
  }
}

/**
 * Decodes a deck seed string into a deck map.
 * Supports "d2:" (new format) and "d1:" (legacy format, remaps keys automatically).
 * @param {string | null | undefined} seed - The seed string to decode.
 * @param {number} [maxCardCount=9] - Maximum allowed copies per card.
 * @returns {Map<string, number>} Map of card id → count; empty map if invalid.
 */
export function decodeDeck(seed, maxCardCount = 9) {
  const isLegacy = seed?.startsWith("d1:");
  if (!seed?.startsWith("d2:") && !isLegacy) return new Map();
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
      let id = decompressKey(ck);
      if (!id) continue;
      if (isLegacy) id = remapLegacyKey(id);
      map.set(id, count);
    }
    return map;
  } catch {
    return new Map();
  }
}
