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
  if (typeof card.id !== "string" || !card.id) {
    fail(`Card missing "id" field: ${JSON.stringify(card)}`);
    schemaErrors++;
  }
  if (typeof card.name !== "string" || !card.name) {
    fail(`Card "${card.id}" is missing "name" string`);
    schemaErrors++;
  }
  if (card.type !== "Plane" && card.type !== "Phenomenon") {
    fail(`Card "${card.id}" has invalid "type": ${JSON.stringify(card.type)}`);
    schemaErrors++;
  }
  if (typeof card.image !== "string" || !card.image) {
    fail(`Card "${card.id}" is missing "image" string`);
    schemaErrors++;
  }
  if (!Array.isArray(card.tags)) {
    fail(`Card "${card.id}" is missing "tags" array`);
    schemaErrors++;
  }
}
if (schemaErrors === 0) {
  pass(`All ${cards.length} cards have valid schema`);
} else {
  fail(`${schemaErrors} card(s) with schema errors`);
}

// ── 3. Referenced image files exist ──────────────────────────────────────────

section("3. Image reference validation");

let invalidImageRefs = 0;
for (const card of cards) {
  if (card.image.startsWith("http://") || card.image.startsWith("https://")) {
    continue;
  }
  const imagePath = join(ROOT, card.image);
  if (!existsSync(imagePath)) {
    console.warn(`  ⚠ Local image not found: ${card.image}`);
    invalidImageRefs++;
  }
}
if (invalidImageRefs === 0) {
  pass(`All ${cards.length} image references are valid (remote URL or existing local file)`);
} else {
  fail(`${invalidImageRefs} card(s) reference missing local image paths`);
}

// ── 4. Transcript files (soft check — not all cards need transcripts) ─────────

section("4. Transcript file check");

let missingTranscripts = 0;
for (const card of cards) {
  const mdPath = join(ROOT, card.transcript);
  const txtPath = mdPath.replace(/\.md$/, ".txt");
  if (!existsSync(mdPath) && !existsSync(txtPath)) {
    missingTranscripts++;
  }
}
if (missingTranscripts === 0) {
  pass(`All ${cards.length} cards have transcript files`);
} else {
  pass(`${cards.length - missingTranscripts} of ${cards.length} cards have transcripts (${missingTranscripts} missing — may be intentional)`);
}

// ── 5. Per-card JSON files in cards/ ─────────────────────────────────────────

section("5. Per-card JSON file check");

let missingCardJson = 0;
for (const card of cards) {
  const jsonFilename = card.id + ".json";
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
  "styles/themes.css",
  "styles/gallery.css",
  "styles/game.css",
  "src/gallery/index.js",
  "src/deck/index.js",
  "src/deck/codec.js",
  "src/deck/panel.js",
  "src/game/state.js",
  "src/game/ui.js",
  "src/changelog.js",
  "sw.js",
  "manifest.json",
  "version.json",
  "assets/favicon.svg",
  "assets/card-preview.jpg",
  "assets/favicon-192.png",
  "assets/favicon-512.png",
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

// ── 8. Changelog DOM elements exist in index.html ────────────────────────────

section("8. Changelog integration");

const indexHtmlPath = join(ROOT, "index.html");
try {
  const indexHtml = readFileSync(indexHtmlPath, "utf8");
  const changelogIds = [
    "changelog-overlay",
    "changelog-backdrop",
    "changelog-close",
    "changelog-dismiss",
    "changelog-version",
    "changelog-body",
  ];
  let missingIds = 0;
  for (const id of changelogIds) {
    if (indexHtml.includes(`id="${id}"`)) {
      pass(`#${id} element exists in index.html`);
    } else {
      fail(`#${id} element missing from index.html — required by changelog.js`);
      missingIds++;
    }
  }
  if (missingIds === 0) {
    pass("changelog.js DOM contract is satisfied by index.html");
  }
} catch (e) {
  fail(`Failed to read index.html: ${e.message}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
