#!/usr/bin/env node
// scripts/test-utils.js
// Unit tests for gallery-utils.js pure functions (no DOM or browser APIs).
// Run with: node scripts/test-utils.js

import {
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

// ── Helper: build a raw card in the new schema ────────────────────────────────

function makeCard({ id, name, type, tags = [] }) {
  return {
    id,
    name,
    type,
    image: `cards/images/${name}.png`,
    thumb: `cards/thumbs/${name}.webp`,
    transcript: `cards/transcripts/${name}.md`,
    tags
  };
}

// ── enrichCard ────────────────────────────────────────────────────────────────

section("enrichCard");
const rawAkoum = makeCard({
  id: "akoum",
  name: "Akoum",
  type: "Plane",
  tags: ["Zendikar", "badge:tr:green:Official"]
});
const enriched = enrichCard(rawAkoum);
assert(enriched.id === "akoum", "id is set");
assert(enriched.name === "Akoum", "name is set");
assert(enriched.displayName === "Akoum", "displayName alias equals name");
assert(enriched.type === "Plane", "type is set");
assert(enriched.imagePath === "cards/images/Akoum.png", "imagePath from image field");
assert(enriched.thumbPath === "cards/thumbs/Akoum.webp", "thumbPath from thumb field");
assert(enriched.transcriptPath === "cards/transcripts/Akoum.md", "transcriptPath from transcript field");
assert(Array.isArray(enriched.tags), "tags is an array");
assert(Array.isArray(enriched.normalizedTags), "normalizedTags is an array");
assert(enriched.normalizedTags[0] === "zendikar", "normalizedTags are lowercased");

const rawOfficial = {
  id: "bant",
  name: "Bant",
  type: "Plane",
  image: "https://api.scryfall.com/cards/named?exact=Bant&set=hop&format=image&version=large",
  thumb: "https://api.scryfall.com/cards/named?exact=Bant&set=hop&format=image&version=small",
  transcript: "cards/transcripts/Bant.md",
  tags: [":top:badge:tr:green:Official"]
};
const enrichedOfficial = enrichCard(rawOfficial);
assert(enrichedOfficial.imagePath.startsWith("https://api.scryfall.com/cards/named?"), "official image path accepts scryfall URL");

// ── sortCards ─────────────────────────────────────────────────────────────────

section("sortCards");
const unsorted = [
  enrichCard(makeCard({ id: "zendikar", name: "Zendikar", type: "Plane" })),
  enrichCard(makeCard({ id: "akoum", name: "Akoum", type: "Plane" })),
  enrichCard(makeCard({ id: "bant", name: "Bant", type: "Plane" })),
];
sortCards(unsorted);
assert(unsorted[0].name === "Akoum", "First after sort: Akoum");
assert(unsorted[1].name === "Bant", "Second after sort: Bant");
assert(unsorted[2].name === "Zendikar", "Third after sort: Zendikar");

// ── reconcileSelectedTags ─────────────────────────────────────────────────────

section("reconcileSelectedTags");
const cards = [
  enrichCard(makeCard({ id: "a", name: "A", type: "Plane", tags: ["Zendikar", "Official"] })),
  enrichCard(makeCard({ id: "b", name: "B", type: "Plane", tags: ["Ravnica"] })),
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
const badgeTags = ["Zendikar", "badge:tr:green:Official", ":top:badge:bl:amber:Custom"];
const badges = getBadgeTags(badgeTags);
assert(badges.length === 2, "Two badge tags found");
assert(badges.some((b) => b.label === "Official"), "Official badge found");
assert(badges.some((b) => b.label === "Custom"), "Custom badge found");

// ── getTagLabel / getTagToneClass ─────────────────────────────────────────────

section("getTagLabel / getTagToneClass");
assert(getTagLabel("badge:tr:green:Official") === "Official", "Label from badge tag");
assert(getTagLabel(":top:badge:tr:green:Official") === "Official", "Label from top badge tag");
assert(getTagLabel("Zendikar") === "Zendikar", "Non-badge tag: label is tag itself");
assert(getTagToneClass("badge:tr:green:Official", "chip") === "chip tone-green", "Badge tone class");
assert(getTagToneClass("Zendikar", "chip") === "chip", "Non-badge: base class only");

// ── stripQuotes ───────────────────────────────────────────────────────────────

section("stripQuotes");
assert(stripQuotes('"hello world"') === "hello world", "Removes surrounding quotes");
assert(stripQuotes("hello") === "hello", "No quotes: unchanged");
assert(stripQuotes('"a"') === "a", "Single char in quotes");
assert(stripQuotes('"') === '"', "Lone quote unchanged");

// ── escapeHtml ────────────────────────────────────────────────────────────────

section("escapeHtml");
assert(escapeHtml("<div>") === "&lt;div&gt;", "Escapes angle brackets");
assert(escapeHtml("a & b") === "a &amp; b", "Escapes ampersand");
assert(escapeHtml('"quoted"') === "&quot;quoted&quot;", "Escapes double quotes");
assert(escapeHtml("it's") === "it&#39;s", "Escapes single quotes");
assert(escapeHtml("no special chars") === "no special chars", "No change needed");

// ── shuffleArray ──────────────────────────────────────────────────────────────

section("shuffleArray");
const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
  id: "akoum",
  name: "Akoum",
  type: "Plane",
  image: "cards/images/Akoum.png",
  thumb: "cards/thumbs/Akoum.webp",
  transcript: "cards/transcripts/Akoum.md",
  tags: ["Zendikar", "badge:tr:green:Official"]
});
const baseFilters = { fuzzy: false, showHidden: false, tags: new Set() };

const noTermsQuery2 = parseSearchQuery("");
assert(matchesParsedQuery(testCard, noTermsQuery2, baseFilters) === true, "Empty query matches any card");

const matchingQuery2 = parseSearchQuery("akoum");
assert(matchesParsedQuery(testCard, matchingQuery2, baseFilters) === true, "Name matches plain text");

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
