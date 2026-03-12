#!/usr/bin/env node
// scripts/test-generate.js
// Unit tests for generate-cards.js helper functions.
// Run with: node scripts/test-generate.js

import {
  getCardKey,
  getInferredTypeTag,
  uniqueTags,
} from "./generate-cards.js";

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

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function section(name) {
  console.log(`\n${name}`);
}

// ── getCardKey ────────────────────────────────────────────────────────────────

section("getCardKey");
assert(getCardKey("Plane_Akoum.png") === "Plane_Akoum", "Strips .png extension");
assert(getCardKey("Phenomenon_Tunnel.jpg") === "Phenomenon_Tunnel", "Strips .jpg extension");
assert(getCardKey("Card.webp") === "Card", "Strips .webp extension");
assert(getCardKey("noext") === "noext", "No extension stays as-is");
assert(getCardKey("file.name.png") === "file.name", "Only strips last extension");

// ── getInferredTypeTag ────────────────────────────────────────────────────────

section("getInferredTypeTag");
assert(getInferredTypeTag("Plane_Akoum.png") === "Plane", "Plane_ prefix → 'Plane'");
assert(getInferredTypeTag("Phenomenon_Tunnel.jpg") === "Phenomenon", "Phenomenon_ prefix → 'Phenomenon'");
assert(getInferredTypeTag("plane_lowercase.png") === "Plane", "Case-insensitive plane prefix");
assert(getInferredTypeTag("Plane-Hyphenated.png") === "Plane", "Plane with hyphen separator");
assert(getInferredTypeTag("Plane Spaced.png") === "Plane", "Plane with space separator");
assert(getInferredTypeTag("CustomCard.png") === null, "No type prefix → null");
assert(getInferredTypeTag("Planetary.png") === null, "Partial prefix 'Planetary' → null (no separator)");
assert(getInferredTypeTag("") === null, "Empty string → null");

// ── uniqueTags ────────────────────────────────────────────────────────────────

section("uniqueTags");
assert(deepEqual(uniqueTags(["Plane", "Zendikar"]), ["Plane", "Zendikar"]), "Unique tags unchanged");
assert(deepEqual(uniqueTags(["Plane", "plane"]), ["Plane"]), "Case-insensitive dedup keeps first");
assert(deepEqual(uniqueTags(["Plane", "Plane"]), ["Plane"]), "Exact duplicate removed");
assert(deepEqual(uniqueTags([]), []), "Empty array returns empty");
assert(deepEqual(uniqueTags(["  Plane  ", "Zendikar"]), ["Plane", "Zendikar"]), "Trims whitespace");
assert(deepEqual(uniqueTags(["", "  ", "Plane"]), ["Plane"]), "Filters empty/whitespace-only tags");
assert(deepEqual(uniqueTags(["Plane", "Zendikar", "plane", "zendikar"]), ["Plane", "Zendikar"]), "Multiple duplicates removed");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
