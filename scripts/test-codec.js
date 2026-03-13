#!/usr/bin/env node
// scripts/test-codec.js
// Unit tests for deck-codec.js pure functions.
// Run with: node scripts/test-codec.js

import {
  compressKey,
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

// ── compressKey ───────────────────────────────────────────────────────────────

section("compressKey");
assert(compressKey("akoum") === "akoum", "identity: akoum");
assert(compressKey("interplanar_tunnel") === "interplanar_tunnel", "identity: interplanar_tunnel");
assert(compressKey("atlas_consultation") === "atlas_consultation", "identity: atlas_consultation");
assert(compressKey("") === "", "identity: empty string");

section("compressKey roundtrip");
const roundtripKeys = [
  "akoum",
  "the_library_of_leng",
  "interplanar_tunnel",
  "atlas_consultation",
];
for (const key of roundtripKeys) {
  assert(compressKey(key) === key, `compressKey identity: ${key}`);
}

// ── toBase64Url / fromBase64Url ───────────────────────────────────────────────

section("toBase64Url / fromBase64Url");
const texts = [
  "hello world",
  "d2:akoum,interplanar_tunnel",
  '{"mode":"classic","r":["akoum"]}',
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

const singleCard = new Map([["akoum", 1]]);
const seed1 = encodeDeck(singleCard);
assert(seed1.startsWith("d2:"), "Encoded seed starts with 'd2:'");

const twoCards = new Map([["akoum", 2], ["interplanar_tunnel", 1]]);
const seed2 = encodeDeck(twoCards);
assert(seed2.startsWith("d2:"), "Two-card seed starts with 'd2:'");

section("decodeDeck");
assert(decodeDeck("").size === 0, "Empty string decodes to empty map");
assert(decodeDeck(null).size === 0, "null decodes to empty map");
assert(decodeDeck("invalid").size === 0, "Invalid seed decodes to empty map");
assert(decodeDeck("d2:!!!").size === 0, "Malformed base64 decodes to empty map");

section("encodeDeck / decodeDeck roundtrip");
const decks = [
  new Map([["akoum", 1]]),
  new Map([["akoum", 2], ["interplanar_tunnel", 1]]),
  new Map([["akoum", 1], ["bant", 3], ["spatial_merging", 2]]),
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
const clampDeck = new Map([["akoum", 9]]);
const clampSeed = encodeDeck(clampDeck);
const clampDecoded = decodeDeck(clampSeed, 5);
assert((clampDecoded.get("akoum") ?? 0) <= 5, "maxCardCount=5 clamps count to ≤5");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
