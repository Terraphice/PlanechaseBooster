#!/usr/bin/env node
// scripts/test-codec.js
// Unit tests for deck-codec.js pure functions.
// Run with: node scripts/test-codec.js

import {
  compressKey,
  decompressKey,
  remapLegacyKey,
  toBase64Url,
  fromBase64Url,
  encodeDeck,
  decodeDeck,
} from "../src/deck/codec.js";

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n${name}`);
}

// ── compressKey / decompressKey ───────────────────────────────────────────────

section("compressKey");
assert(compressKey("plane_akoum") === "pakoum", "plane_ prefix becomes 'p'");
assert(compressKey("plane_") === "p", "plane_ with empty rest");
assert(compressKey("phenomenon_interplanar_tunnel") === "ninterplanar_tunnel", "phenomenon_ prefix becomes 'n'");
assert(compressKey("customcard") === "ucustomcard", "Unknown prefix becomes 'u'");
assert(compressKey("") === "u", "Empty string gets 'u' prefix");

section("decompressKey");
assert(decompressKey("pakoum") === "plane_akoum", "Restores plane_ prefix");
assert(decompressKey("ninterplanar_tunnel") === "phenomenon_interplanar_tunnel", "Restores phenomenon_ prefix");
assert(decompressKey("ucustomcard") === "customcard", "Restores no-prefix key");
assert(decompressKey("p") === null, "Single 'p' (no rest) returns null (length < 2)");
assert(decompressKey("") === null, "Empty string returns null");
assert(decompressKey("x") === null, "Single char (no rest) returns null");
assert(decompressKey(null) === null, "null returns null");
assert(decompressKey(undefined) === null, "undefined returns null");

section("compressKey / decompressKey roundtrip");
const roundtripKeys = [
  "plane_akoum",
  "plane_the_library_of_leng",
  "phenomenon_interplanar_tunnel",
  "customcard",
];
for (const key of roundtripKeys) {
  assert(decompressKey(compressKey(key)) === key, `Roundtrip: ${key}`);
}

// ── remapLegacyKey ────────────────────────────────────────────────────────────

section("remapLegacyKey");
assert(remapLegacyKey("Plane_Akoum") === "plane_akoum", "Plane_ prefix remapped");
assert(remapLegacyKey("Phenomenon_Interplanar_Tunnel") === "phenomenon_interplanar_tunnel", "Phenomenon_ prefix remapped");
assert(remapLegacyKey("Plane_The Library of Leng") === "plane_the_library_of_leng", "Spaces become underscores");
assert(remapLegacyKey("Plane_Atlas Consultation") === "plane_atlas_consultation", "Multi-word name");

// ── toBase64Url / fromBase64Url ───────────────────────────────────────────────

section("toBase64Url / fromBase64Url");
const texts = [
  "hello world",
  "d2:pakoum,ninterplanar_tunnel",
  '{"mode":"classic","r":["pakoum"]}',
  "Special chars: +/=",
];
for (const text of texts) {
  const encoded = toBase64Url(text);
  assert(!encoded.includes("+") && !encoded.includes("/") && !encoded.includes("="),
    `No +/= in encoded: "${text.slice(0, 30)}"`);
  assert(fromBase64Url(encoded) === text,
    `Roundtrip: "${text.slice(0, 30)}"`);
}

// ── encodeDeck / decodeDeck ───────────────────────────────────────────────────

section("encodeDeck");
const emptyMap = new Map();
assert(encodeDeck(emptyMap) === "", "Empty map encodes to empty string");

const singleCard = new Map([["plane_akoum", 1]]);
const seed1 = encodeDeck(singleCard);
assert(seed1.startsWith("d2:"), "Encoded seed starts with 'd2:'");

const twoCards = new Map([["plane_akoum", 2], ["phenomenon_interplanar_tunnel", 1]]);
const seed2 = encodeDeck(twoCards);
assert(seed2.startsWith("d2:"), "Two-card seed starts with 'd2:'");

section("decodeDeck");
assert(decodeDeck("").size === 0, "Empty string decodes to empty map");
assert(decodeDeck(null).size === 0, "null decodes to empty map");
assert(decodeDeck("invalid").size === 0, "Invalid seed decodes to empty map");
assert(decodeDeck("d2:!!!").size === 0, "Malformed base64 decodes to empty map");

section("encodeDeck / decodeDeck roundtrip");
const decks = [
  new Map([["plane_akoum", 1]]),
  new Map([["plane_akoum", 2], ["phenomenon_interplanar_tunnel", 1]]),
  new Map([["plane_akoum", 1], ["plane_bant", 3], ["phenomenon_spatial_merging", 2]]),
];
for (const deck of decks) {
  const encoded = encodeDeck(deck);
  const decoded = decodeDeck(encoded);
  assert(decoded.size === deck.size, `Roundtrip: size matches (${deck.size} cards)`);
  for (const [key, count] of deck) {
    assert(decoded.get(key) === count, `Roundtrip: ${key} count=${count}`);
  }
}

section("decodeDeck: count clamping");
const clampDeck = new Map([["plane_akoum", 9]]);
const clampSeed = encodeDeck(clampDeck);
const clampDecoded = decodeDeck(clampSeed, 5);
assert((clampDecoded.get("plane_akoum") ?? 0) <= 5, "maxCardCount=5 clamps count to ≤5");

section("decodeDeck: backward compat (d1: legacy seeds)");
const legacyRaw = "pAkoum,nInterplanar_Tunnel";
const legacySeed = "d1:" + toBase64Url(legacyRaw);
const legacyDecoded = decodeDeck(legacySeed);
assert(legacyDecoded.has("plane_akoum"), "d1: seed: Plane_Akoum remapped to plane_akoum");
assert(legacyDecoded.has("phenomenon_interplanar_tunnel"), "d1: seed: Phenomenon_Interplanar_Tunnel remapped");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
