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
assert(getCardJsonFilename("plane_akoum") === "plane_akoum.json", "plane_akoum → plane_akoum.json");
assert(getCardJsonFilename("phenomenon_atlas_consultation") === "phenomenon_atlas_consultation.json", "phenomenon id → .json");
assert(getCardJsonFilename("plane_the_library_of_leng") === "plane_the_library_of_leng.json", "multi-word id");
assert(getCardJsonFilename("phenomenon_interplanar_tunnel") === "phenomenon_interplanar_tunnel.json", "phenomenon id");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
