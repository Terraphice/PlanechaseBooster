#!/usr/bin/env node
// scripts/smoke-test.js
// Basic smoke tests for the Planar Atlas project.
// Run with: node scripts/smoke-test.js

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`  ✓ ${msg}`);
  passed++;
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed++;
}

function section(name) {
  console.log(`\n${name}`);
}

// ── 1. cards.json parses correctly ───────────────────────────────────────────

section("1. cards.json integrity");

const cardsPath = join(ROOT, "cards.json");
let cards = [];
try {
  const raw = readFileSync(cardsPath, "utf8");
  cards = JSON.parse(raw);
  pass(`cards.json is valid JSON (${cards.length} cards)`);
} catch (e) {
  fail(`cards.json failed to parse: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(cards)) {
  fail("cards.json root must be an array");
} else {
  pass("cards.json root is an array");
}

// ── 2. Card schema validation ─────────────────────────────────────────────────

section("2. Card schema validation");

let schemaErrors = 0;
for (const card of cards) {
  if (typeof card.file !== "string" || !card.file) {
    fail(`Card missing "file" field: ${JSON.stringify(card)}`);
    schemaErrors++;
  }
  if (typeof card.folder !== "string" || !["complete", "incomplete"].includes(card.folder)) {
    fail(`Card "${card.file}" has invalid "folder": ${card.folder}`);
    schemaErrors++;
  }
  if (!Array.isArray(card.tags)) {
    fail(`Card "${card.file}" is missing "tags" array`);
    schemaErrors++;
  }
}
if (schemaErrors === 0) {
  pass(`All ${cards.length} cards have valid schema`);
} else {
  fail(`${schemaErrors} card(s) with schema errors`);
}

// ── 3. Referenced image files exist ──────────────────────────────────────────

section("3. Image file existence");

let missingImages = 0;
for (const card of cards) {
  const imagePath = join(ROOT, "images", "cards", card.folder, card.file);
  if (!existsSync(imagePath)) {
    fail(`Missing image: images/cards/${card.folder}/${card.file}`);
    missingImages++;
  }
}
if (missingImages === 0) {
  pass(`All ${cards.length} referenced image files exist`);
} else {
  fail(`${missingImages} referenced image file(s) are missing`);
}

// ── 4. Transcript files (soft check — not all cards need transcripts) ─────────

section("4. Transcript file check (complete cards only)");

let missingTranscripts = 0;
const completeCards = cards.filter((c) => c.folder === "complete");
for (const card of completeCards) {
  const stem = card.file.replace(/\.[^.]+$/, "");
  const mdPath = join(ROOT, "transcripts", "cards", "complete", stem + ".md");
  const txtPath = join(ROOT, "transcripts", "cards", "complete", stem + ".txt");
  if (!existsSync(mdPath) && !existsSync(txtPath)) {
    missingTranscripts++;
  }
}
if (missingTranscripts === 0) {
  pass(`All ${completeCards.length} complete cards have transcript files`);
} else {
  pass(`${completeCards.length - missingTranscripts} of ${completeCards.length} complete cards have transcripts (${missingTranscripts} missing — may be intentional)`);
}

// ── 5. Per-card JSON files in cards/ ─────────────────────────────────────────

section("5. Per-card JSON file check");

// This function must match the logic in sync-cards.js getCardJsonFilename().
function getCardJsonFilename(filename) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const withoutPrefix = withoutExtension.replace(/^(Plane|Phenomenon)[-_ ]+/i, "");
  return withoutPrefix.toLowerCase().replace(/[_ ]+/g, "-") + ".json";
}

let missingCardJson = 0;
for (const card of cards) {
  const jsonFilename = getCardJsonFilename(card.file);
  const jsonPath = join(ROOT, "cards", jsonFilename);
  if (!existsSync(jsonPath)) {
    missingCardJson++;
  }
}
if (missingCardJson === 0) {
  pass(`All ${cards.length} per-card JSON files exist in cards/`);
} else {
  fail(`${missingCardJson} per-card JSON file(s) missing in cards/ — run "npm run sync"`);
}

// ── 6. version.json parses correctly ─────────────────────────────────────────

section("6. version.json");

const versionPath = join(ROOT, "version.json");
try {
  const raw = readFileSync(versionPath, "utf8");
  const versionData = JSON.parse(raw);
  if (typeof versionData.version === "string" && versionData.version) {
    pass(`version.json is valid (version: ${versionData.version})`);
  } else {
    fail("version.json missing \"version\" string field");
  }
} catch (e) {
  fail(`version.json failed to parse: ${e.message}`);
}

// ── 7. Key static assets exist ───────────────────────────────────────────────

section("7. Key static assets");

const requiredFiles = [
  "index.html",
  "style-themes.css",
  "style-gallery.css",
  "style-game.css",
  "gallery.js",
  "deck.js",
  "deck-codec.js",
  "changelog.js",
  "sw.js",
  "manifest.json",
  "version.json",
  "favicon.svg",
  "cards.json",
];

for (const file of requiredFiles) {
  const filePath = join(ROOT, file);
  if (existsSync(filePath)) {
    pass(`${file} exists`);
  } else {
    fail(`${file} is missing`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
