#!/usr/bin/env node
// scripts/test-utils.js
// Unit tests for gallery-utils.js pure functions (no DOM or browser APIs).
// Run with: node scripts/test-utils.js

import {
  getCardKey,
  getDisplayName,
  getCardType,
  enrichCard,
  sortCards,
  reconcileSelectedTags,
  parseSearchQuery,
  matchesParsedQuery,
  fuzzyIncludes,
  createCandidateSlices,
  getFuzzyThreshold,
  levenshteinDistance,
  isHiddenCard,
  isTopTag,
  stripTopPrefix,
  parseBadgeTag,
  getBadgeTags,
  getTagLabel,
  getTagToneClass,
  stripQuotes,
  escapeHtml,
  shuffleArray,
  getManaClasses,
  enhanceManaSymbols,
} from "../src/gallery/utils.js";

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
assert(getCardKey("Phenomenon_Interplanar_Tunnel.jpg") === "Phenomenon_Interplanar_Tunnel", "Strips .jpg");
assert(getCardKey("Card.webp") === "Card", "Strips .webp");
assert(getCardKey("noext") === "noext", "No extension stays as-is");

// ── getDisplayName ────────────────────────────────────────────────────────────

section("getDisplayName");
assert(getDisplayName("Plane_Akoum.png") === "Akoum", "Strips 'Plane_' prefix and .png");
assert(getDisplayName("Phenomenon_Interplanar_Tunnel.jpg") === "Interplanar Tunnel", "Strips Phenomenon_ and converts underscores");
assert(getDisplayName("Plane_The_Library_of_Leng.png") === "The Library of Leng", "Multi-word names");
assert(getDisplayName("Card_Name.png") === "Card Name", "Underscores become spaces without prefix");

// ── getCardType ───────────────────────────────────────────────────────────────

section("getCardType");
assert(getCardType(["plane", "zendikar"]) === "Plane", "Tags with 'plane' → Plane");
assert(getCardType(["phenomenon"]) === "Phenomenon", "Tags with 'phenomenon' → Phenomenon");
assert(getCardType(["zendikar"]) === "Unknown", "No type tags → Unknown");
assert(getCardType([]) === "Unknown", "Empty tags → Unknown");
assert(getCardType(["plane", "phenomenon"]) === "Plane", "Plane takes precedence");

// ── enrichCard ────────────────────────────────────────────────────────────────

section("enrichCard");
const raw = { file: "Plane_Akoum.png", folder: "complete", tags: ["Plane", "Zendikar", "badge:tr:green:Official"] };
const enriched = enrichCard(raw);
assert(enriched.key === "Plane_Akoum", "key is set");
assert(enriched.displayName === "Akoum", "displayName is set");
assert(enriched.type === "Plane", "type is set");
assert(enriched.imagePath === "images/cards/complete/Plane_Akoum.png", "imagePath is set");
assert(enriched.thumbPath === "images/thumb/Plane_Akoum.webp", "thumbPath is set");
assert(enriched.transcriptPath === "transcripts/cards/complete/Plane_Akoum.md", "transcriptPath is set");
assert(Array.isArray(enriched.tags), "tags is an array");
assert(Array.isArray(enriched.normalizedTags), "normalizedTags is an array");
assert(enriched.normalizedTags[0] === "plane", "normalizedTags are lowercased");

const incomplete = enrichCard({ file: "Plane_Test.png", folder: "incomplete", tags: ["Plane"] });
assert(incomplete.imagePath.includes("incomplete"), "incomplete folder in imagePath");
assert(incomplete.transcriptPath.includes("incomplete"), "incomplete folder in transcriptPath");

// ── sortCards ─────────────────────────────────────────────────────────────────

section("sortCards");
const unsorted = [
  enrichCard({ file: "Plane_Zendikar.png", folder: "complete", tags: ["Plane"] }),
  enrichCard({ file: "Plane_Akoum.png", folder: "complete", tags: ["Plane"] }),
  enrichCard({ file: "Plane_Bant.png", folder: "complete", tags: ["Plane"] }),
];
sortCards(unsorted);
assert(unsorted[0].displayName === "Akoum", "First after sort: Akoum");
assert(unsorted[1].displayName === "Bant", "Second after sort: Bant");
assert(unsorted[2].displayName === "Zendikar", "Third after sort: Zendikar");

// ── reconcileSelectedTags ─────────────────────────────────────────────────────

section("reconcileSelectedTags");
const cards = [
  enrichCard({ file: "Plane_A.png", folder: "complete", tags: ["Zendikar", "Official"] }),
  enrichCard({ file: "Plane_B.png", folder: "complete", tags: ["Ravnica"] }),
];
const reconciled = reconcileSelectedTags(new Set(["zendikar", "ravnica"]), cards);
assert(reconciled.has("Zendikar"), "Reconciled 'zendikar' → 'Zendikar' (canonical)");
assert(reconciled.has("Ravnica"), "Reconciled 'ravnica' → 'Ravnica' (canonical)");
assert(!reconciled.has("zendikar"), "Original lowercased form removed");

// ── levenshteinDistance ───────────────────────────────────────────────────────

section("levenshteinDistance");
assert(levenshteinDistance("", "") === 0, "Empty strings: distance=0");
assert(levenshteinDistance("abc", "abc") === 0, "Identical strings: distance=0");
assert(levenshteinDistance("abc", "abd") === 1, "One substitution: distance=1");
assert(levenshteinDistance("abc", "ab") === 1, "One deletion: distance=1");
assert(levenshteinDistance("ab", "abc") === 1, "One insertion: distance=1");
assert(levenshteinDistance("kitten", "sitting") === 3, "kitten→sitting: distance=3");
assert(levenshteinDistance("akoum", "akoom") === 1, "Transposition-like: distance=1");

// ── getFuzzyThreshold ─────────────────────────────────────────────────────────

section("getFuzzyThreshold");
assert(getFuzzyThreshold(1) === 0, "Length 1: threshold=0");
assert(getFuzzyThreshold(3) === 0, "Length 3: threshold=0");
assert(getFuzzyThreshold(4) === 1, "Length 4: threshold=1");
assert(getFuzzyThreshold(5) === 1, "Length 5: threshold=1");
assert(getFuzzyThreshold(6) === 2, "Length 6: threshold=2");
assert(getFuzzyThreshold(8) === 2, "Length 8: threshold=2");
assert(getFuzzyThreshold(9) === 3, "Length 9: threshold=3");
assert(getFuzzyThreshold(100) === 3, "Length 100: threshold=3");

// ── createCandidateSlices ─────────────────────────────────────────────────────

section("createCandidateSlices");
const slices = createCandidateSlices("abcde", 3);
assert(Array.isArray(slices), "Returns an array");
assert(slices.includes("abc"), "Contains expected slice 'abc'");
assert(slices.includes("bcd"), "Contains expected slice 'bcd'");
assert(slices.includes("cde"), "Contains expected slice 'cde'");

// ── fuzzyIncludes ─────────────────────────────────────────────────────────────

section("fuzzyIncludes");
assert(fuzzyIncludes("akoum", "akoum") === true, "Exact match");
assert(fuzzyIncludes("akoum boulders", "akoum") === true, "Substring match");
assert(fuzzyIncludes("akoum", "") === true, "Empty needle matches anything");
assert(fuzzyIncludes("akoum", "akoom") === true, "One-char diff in short word");
assert(fuzzyIncludes("zendikar", "zendikra") === true, "Transposed chars in longer word");
assert(fuzzyIncludes("xyz", "abc") === false, "No match: completely different");
assert(fuzzyIncludes("akoum", "zendikar") === false, "No match: different words");

// ── isHiddenCard ──────────────────────────────────────────────────────────────

section("isHiddenCard");
assert(isHiddenCard(["hidden"]) === true, "Tag 'hidden' marks card as hidden");
assert(isHiddenCard(["plane", "hidden"]) === true, "Multiple tags with 'hidden'");
assert(isHiddenCard(["plane"]) === false, "No 'hidden' tag");
assert(isHiddenCard([]) === false, "Empty tags");

// ── isTopTag / stripTopPrefix ─────────────────────────────────────────────────

section("isTopTag / stripTopPrefix");
assert(isTopTag(":top:badge:tr:green:Label") === true, "Tag starting with :top:");
assert(isTopTag("badge:tr:green:Label") === false, "No :top: prefix");
assert(stripTopPrefix(":top:badge:tr:green:Label") === "badge:tr:green:Label", "Strips :top: prefix");
assert(stripTopPrefix("badge:tr:green:Label") === "badge:tr:green:Label", "No-op without :top:");

// ── parseBadgeTag ─────────────────────────────────────────────────────────────

section("parseBadgeTag");
const badge = parseBadgeTag("badge:tr:green:Official");
assert(badge !== null, "Valid badge parses successfully");
assert(badge?.corner === "tr", "Corner is 'tr'");
assert(badge?.color === "green", "Color is 'green'");
assert(badge?.label === "Official", "Label is 'Official'");
assert(parseBadgeTag("badge:xx:green:Label") === null, "Invalid corner returns null");
assert(parseBadgeTag("badge:tr:pink:Label") === null, "Invalid color returns null");
assert(parseBadgeTag("notabadge") === null, "Non-badge tag returns null");
assert(parseBadgeTag("badge:tr:green:") === null, "Empty label returns null");

const topBadge = parseBadgeTag(":top:badge:bl:amber:Custom");
assert(topBadge !== null, "Top badge parses successfully");
assert(topBadge?.corner === "bl", "Top badge corner is 'bl'");
assert(topBadge?.color === "amber", "Top badge color is 'amber'");
assert(topBadge?.label === "Custom", "Top badge label is 'Custom'");

// ── getBadgeTags ──────────────────────────────────────────────────────────────

section("getBadgeTags");
const tags = ["Plane", "badge:tr:green:Official", "Zendikar", ":top:badge:bl:amber:Custom"];
const badges = getBadgeTags(tags);
assert(badges.length === 2, "Two badge tags found");
assert(badges[0].label === "Official", "First badge label");
assert(badges[1].label === "Custom", "Second badge label");

// ── getTagLabel ───────────────────────────────────────────────────────────────

section("getTagLabel");
assert(getTagLabel("badge:tr:green:Official") === "Official", "Badge tag → label");
assert(getTagLabel("Zendikar") === "Zendikar", "Non-badge tag → itself");
assert(getTagLabel(":top:badge:bl:amber:Custom") === "Custom", "Top badge → label");

// ── getTagToneClass ───────────────────────────────────────────────────────────

section("getTagToneClass");
assert(getTagToneClass("badge:tr:green:Official", "tag") === "tag tone-green", "Badge gets tone class");
assert(getTagToneClass("Zendikar", "tag") === "tag", "Non-badge keeps base class only");

// ── stripQuotes ───────────────────────────────────────────────────────────────

section("stripQuotes");
assert(stripQuotes('"hello world"') === "hello world", "Strips double quotes");
assert(stripQuotes("noquotes") === "noquotes", "No quotes → unchanged");
assert(stripQuotes('"only open') === '"only open', "Unmatched quote → unchanged");

// ── escapeHtml ────────────────────────────────────────────────────────────────

section("escapeHtml");
assert(escapeHtml("<script>") === "&lt;script&gt;", "Escapes < and >");
assert(escapeHtml("a & b") === "a &amp; b", "Escapes &");
assert(escapeHtml('"quoted"') === "&quot;quoted&quot;", "Escapes double quotes");
assert(escapeHtml("it's") === "it&#39;s", "Escapes single quotes");
assert(escapeHtml("plain") === "plain", "Plain text unchanged");

// ── shuffleArray ──────────────────────────────────────────────────────────────

section("shuffleArray");
const original = [1, 2, 3, 4, 5, 6, 7, 8];
const shuffled = shuffleArray(original);
assert(shuffled.length === original.length, "Shuffled array has same length");
assert(original[0] === 1, "Original array is not mutated");
const sortedOriginal = [...original].sort((a, b) => a - b);
const sortedShuffled = [...shuffled].sort((a, b) => a - b);
assert(deepEqual(sortedOriginal, sortedShuffled), "Shuffled array has same elements");

// ── getManaClasses ────────────────────────────────────────────────────────────

section("getManaClasses");
assert(getManaClasses("w") === "ms ms-w ms-cost", "White mana");
assert(getManaClasses("chaos") === "ms ms-chaos ms-cost", "Chaos symbol");
assert(getManaClasses("tap") === "ms ms-tap", "Tap symbol (no ms-cost)");
assert(getManaClasses("t") === "ms ms-tap", "Tap alias");
assert(getManaClasses("planeswalker") === "ms ms-planeswalker", "Planeswalker symbol (no ms-cost)");
assert(getManaClasses("planeswalk") === "ms ms-planeswalker", "Planeswalk alias");
assert(getManaClasses("3") === "ms ms-3 ms-cost", "Numeric mana");
assert(getManaClasses("w/u") === "ms ms-wu ms-cost", "Hybrid mana");
assert(getManaClasses("xyz") === null, "Unknown symbol → null");

// ── enhanceManaSymbols ────────────────────────────────────────────────────────

section("enhanceManaSymbols");
const enhanced = enhanceManaSymbols("Roll {CHAOS} or {T}.");
assert(enhanced.includes('<i class="ms ms-chaos ms-cost"'), "CHAOS symbol enhanced");
assert(enhanced.includes('<i class="ms ms-tap"'), "T (tap) symbol enhanced");
assert(!enhanced.includes("{CHAOS}"), "Original {CHAOS} removed");
const noSymbol = enhanceManaSymbols("No mana symbols here.");
assert(noSymbol === "No mana symbols here.", "Text without symbols unchanged");
const unknown = enhanceManaSymbols("{UNKNOWN}");
assert(unknown.includes("{UNKNOWN}"), "Unknown symbol preserved as-is");

// ── parseSearchQuery ──────────────────────────────────────────────────────────

section("parseSearchQuery");
const emptyQuery = parseSearchQuery("");
assert(deepEqual(emptyQuery.textTerms, []), "Empty query: no text terms");

const plainQuery = parseSearchQuery("akoum");
assert(deepEqual(plainQuery.textTerms, ["akoum"]), "Plain text → textTerms");

const tagQuery = parseSearchQuery("tag:Zendikar");
assert(deepEqual(tagQuery.tagTerms, ["zendikar"]), "tag: prefix → tagTerms (lowercased)");

const nameQuery = parseSearchQuery("name:akoum");
assert(deepEqual(nameQuery.nameTerms, ["akoum"]), "name: prefix → nameTerms");

const oracleQuery = parseSearchQuery("oracle:whenever");
assert(deepEqual(oracleQuery.oracleTerms, ["whenever"]), "oracle: prefix → oracleTerms");

const negQuery = parseSearchQuery("-akoum");
assert(deepEqual(negQuery.negTextTerms, ["akoum"]), "Negated plain text → negTextTerms");

const negTagQuery = parseSearchQuery("-tag:Zendikar");
assert(deepEqual(negTagQuery.negTagTerms, ["zendikar"]), "Negated tag → negTagTerms");

const quotedQuery = parseSearchQuery('"The Library"');
assert(deepEqual(quotedQuery.textTerms, ["the library"]), "Quoted phrase → single term");

const regexQuery = parseSearchQuery("/ak.*/");
assert(regexQuery.regex !== null, "Regex query parsed");
assert(regexQuery.regex?.test("akoum"), "Regex matches expected string");

const showHiddenQuery = parseSearchQuery("show:hidden");
assert(showHiddenQuery.showHidden === true, "show:hidden sets showHidden flag");

const multiQuery = parseSearchQuery("akoum tag:Zendikar -tag:Custom");
assert(deepEqual(multiQuery.textTerms, ["akoum"]), "Multi-term: textTerms");
assert(deepEqual(multiQuery.tagTerms, ["zendikar"]), "Multi-term: tagTerms");
assert(deepEqual(multiQuery.negTagTerms, ["custom"]), "Multi-term: negTagTerms");

// ── matchesParsedQuery ────────────────────────────────────────────────────────

section("matchesParsedQuery");
const testCard = enrichCard({
  file: "Plane_Akoum.png",
  folder: "complete",
  tags: ["Plane", "Zendikar", "badge:tr:green:Official"],
});
const baseFilters = { fuzzy: false, showHidden: false, tags: new Set() };

const noTermsQuery = parseSearchQuery("");
assert(matchesParsedQuery(testCard, noTermsQuery, baseFilters) === true, "Empty query matches any card");

const matchingQuery = parseSearchQuery("akoum");
assert(matchesParsedQuery(testCard, matchingQuery, baseFilters) === true, "Name matches plain text");

const nonMatchingQuery = parseSearchQuery("zendikar extra xyz");
assert(matchesParsedQuery(testCard, nonMatchingQuery, baseFilters) === false, "No match for unknown text");

const tagMatchQuery = parseSearchQuery("tag:zendikar");
assert(matchesParsedQuery(testCard, tagMatchQuery, baseFilters) === true, "Tag matches tag query");

const negTagQuery2 = parseSearchQuery("-tag:zendikar");
assert(matchesParsedQuery(testCard, negTagQuery2, baseFilters) === false, "Negated matching tag excludes card");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
