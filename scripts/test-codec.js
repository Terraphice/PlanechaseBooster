#!/usr/bin/env node
// scripts/test-codec.js
// Unit tests for deck-codec.js pure functions.
// Run with: node scripts/test-codec.js

import {
  compressKey,
  decompressKey,
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
assert(compressKey("Plane_Akoum") === "pAkoum", "Plane_ prefix becomes 'p'");
assert(compressKey("Plane_") === "p", "Plane_ with empty rest");
assert(compressKey("Phenomenon_Interplanar_Tunnel") === "nInterplanar_Tunnel", "Phenomenon_ prefix becomes 'n'");
assert(compressKey("CustomCard") === "uCustomCard", "Unknown prefix becomes 'u'");
assert(compressKey("") === "u", "Empty string gets 'u' prefix");

section("decompressKey");
assert(decompressKey("pAkoum") === "Plane_Akoum", "Restores Plane_ prefix");
assert(decompressKey("nInterplanar_Tunnel") === "Phenomenon_Interplanar_Tunnel", "Restores Phenomenon_ prefix");
assert(decompressKey("uCustomCard") === "CustomCard", "Restores no-prefix key");
assert(decompressKey("p") === null, "Single 'p' (no rest) returns null (length < 2)");
assert(decompressKey("") === null, "Empty string returns null");
assert(decompressKey("x") === null, "Single char (no rest) returns null");
assert(decompressKey(null) === null, "null returns null");
assert(decompressKey(undefined) === null, "undefined returns null");

section("compressKey / decompressKey roundtrip");
const roundtripKeys = [
  "Plane_Akoum",
  "Plane_The_Library_of_Leng",
  "Phenomenon_Interplanar_Tunnel",
  "CustomCard",
];
for (const key of roundtripKeys) {
  assert(decompressKey(compressKey(key)) === key, `Roundtrip: ${key}`);
}

// ── toBase64Url / fromBase64Url ───────────────────────────────────────────────

section("toBase64Url / fromBase64Url");
const texts = [
  "hello world",
  "d1:pAkoum,nInterplanar_Tunnel",
  '{"mode":"classic","r":["pAkoum"]}',
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

const singleCard = new Map([["Plane_Akoum", 1]]);
const seed1 = encodeDeck(singleCard);
assert(seed1.startsWith("d1:"), "Encoded seed starts with 'd1:'");

const twoCards = new Map([["Plane_Akoum", 2], ["Phenomenon_Interplanar_Tunnel", 1]]);
const seed2 = encodeDeck(twoCards);
assert(seed2.startsWith("d1:"), "Two-card seed starts with 'd1:'");

section("decodeDeck");
assert(decodeDeck("").size === 0, "Empty string decodes to empty map");
assert(decodeDeck(null).size === 0, "null decodes to empty map");
assert(decodeDeck("invalid").size === 0, "Invalid seed decodes to empty map");
assert(decodeDeck("d1:!!!").size === 0, "Malformed base64 decodes to empty map");

section("encodeDeck / decodeDeck roundtrip");
const decks = [
  new Map([["Plane_Akoum", 1]]),
  new Map([["Plane_Akoum", 2], ["Phenomenon_Interplanar_Tunnel", 1]]),
  new Map([["Plane_Akoum", 1], ["Plane_Bant", 3], ["Phenomenon_Spatial_Merging", 2]]),
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
const clampDeck = new Map([["Plane_Akoum", 9]]);
const clampSeed = encodeDeck(clampDeck);
const clampDecoded = decodeDeck(clampSeed, 5);
assert((clampDecoded.get("Plane_Akoum") ?? 0) <= 5, "maxCardCount=5 clamps count to ≤5");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
