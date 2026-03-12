#!/usr/bin/env node
// scripts/test-sync.js
// Unit tests for sync-cards.js helper functions.
// Run with: node scripts/test-sync.js

import { getCardJsonFilename } from "./sync-cards.js";

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

// ── getCardJsonFilename ───────────────────────────────────────────────────────

section("getCardJsonFilename");
assert(getCardJsonFilename("Plane_Akoum.png") === "akoum.json", "Strips Plane_ prefix and .png");
assert(getCardJsonFilename("Phenomenon_Interplanar_Tunnel.jpg") === "interplanar-tunnel.json", "Strips Phenomenon_ prefix and converts underscores to hyphens");
assert(getCardJsonFilename("Plane_The_Library_of_Leng.png") === "the-library-of-leng.json", "Multi-word with underscores");
assert(getCardJsonFilename("CustomCard.png") === "customcard.json", "No type prefix: lowercased");
assert(getCardJsonFilename("Plane Forest.png") === "forest.json", "Plane with space separator");
assert(getCardJsonFilename("Plane-Mountain.webp") === "mountain.json", "Plane with hyphen separator");
assert(getCardJsonFilename("Plane_Multi_Word_Name.avif") === "multi-word-name.json", "Multiple underscores become hyphens");
assert(getCardJsonFilename("phenomenon_lowercase.png") === "lowercase.json", "Case-insensitive prefix removal");
assert(getCardJsonFilename("Plane_A.png") === "a.json", "Single-character card name");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
