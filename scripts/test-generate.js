#!/usr/bin/env node
// scripts/test-generate.js
// Unit tests for generate-cards.js helper functions.
// Run with: node scripts/test-generate.js

import {
  getInferredType,
  getDisplayName,
  getCardId,
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

// ── getInferredType ───────────────────────────────────────────────────────────

section("getInferredType");
assert(getInferredType("Plane_Akoum.png") === "Plane", "Plane_ prefix → 'Plane'");
assert(getInferredType("Phenomenon_Tunnel.jpg") === "Phenomenon", "Phenomenon_ prefix → 'Phenomenon'");
assert(getInferredType("plane_lowercase.png") === "Plane", "Case-insensitive plane prefix");
assert(getInferredType("Plane-Hyphenated.png") === "Plane", "Plane with hyphen separator");
assert(getInferredType("Plane Spaced.png") === "Plane", "Plane with space separator");
assert(getInferredType("CustomCard.png") === null, "No type prefix → null");
assert(getInferredType("Planetary.png") === null, "Partial prefix 'Planetary' → null (no separator)");
assert(getInferredType("") === null, "Empty string → null");

// ── getDisplayName ────────────────────────────────────────────────────────────

section("getDisplayName");
assert(getDisplayName("Plane_Akoum.png") === "Akoum", "Strips 'Plane_' prefix and .png");
assert(getDisplayName("Phenomenon_Interplanar_Tunnel.jpg") === "Interplanar Tunnel", "Strips Phenomenon_ and converts underscores");
assert(getDisplayName("Plane_The_Library_of_Leng.png") === "The Library of Leng", "Multi-word names");
assert(getDisplayName("Phenomenon_Atlas Consultation.png") === "Atlas Consultation", "Space-separated name");

// ── getCardId ─────────────────────────────────────────────────────────────────

section("getCardId");
assert(getCardId("Plane_Akoum.png") === "akoum", "Plane_Akoum → akoum");
assert(getCardId("Phenomenon_Atlas Consultation.png") === "atlas_consultation", "Spaces → underscores");
assert(getCardId("Phenomenon_Interplanar_Tunnel.jpg") === "interplanar_tunnel", "Underscores normalized");
assert(getCardId("CustomCard.png") === null, "No type prefix → null");

// ── uniqueTags ────────────────────────────────────────────────────────────────

section("uniqueTags");
assert(deepEqual(uniqueTags(["Zendikar", "OPCA"]), ["Zendikar", "OPCA"]), "Unique tags unchanged");
assert(deepEqual(uniqueTags(["Zendikar", "zendikar"]), ["Zendikar"]), "Case-insensitive dedup keeps first");
assert(deepEqual(uniqueTags(["Zendikar", "Zendikar"]), ["Zendikar"]), "Exact duplicate removed");
assert(deepEqual(uniqueTags([]), []), "Empty array returns empty");
assert(deepEqual(uniqueTags(["  Zendikar  ", "OPCA"]), ["Zendikar", "OPCA"]), "Trims whitespace");
assert(deepEqual(uniqueTags(["", "  ", "Zendikar"]), ["Zendikar"]), "Filters empty/whitespace-only tags");
assert(deepEqual(uniqueTags(["Zendikar", "OPCA", "zendikar", "opca"]), ["Zendikar", "OPCA"]), "Multiple duplicates removed");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
