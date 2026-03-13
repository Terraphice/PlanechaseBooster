import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, extname, dirname, resolve } from "path";
import { fileURLToPath } from "url";

// ── Exported helper functions (also used by tests) ────────────────────────────

export function getInferredType(filename) {
  if (/^plane[-_ ]/i.test(filename)) return "Plane";
  if (/^phenomenon[-_ ]/i.test(filename)) return "Phenomenon";
  return null;
}

export function getDisplayName(filename) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const withoutTypePrefix = withoutExtension.replace(/^(Plane|Phenomenon)[-_ ]+/i, "");
  return withoutTypePrefix.replace(/[_-]+/g, " ").trim();
}

export function getCardId(filename) {
  // id is derived purely from the card name (no type prefix).
  // Planes and phenomena won't share names in practice, so there is no collision risk.
  const type = getInferredType(filename);
  if (!type) return null;
  const name = getDisplayName(filename);
  return name
    .toLowerCase()
    .replace(/\u2014/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

export function uniqueTags(tags) {
  const seen = new Set();
  return tags
    .filter((tag) => {
      const key = String(tag).trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((tag) => String(tag).trim());
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function readExistingCards(filepath) {
  if (!existsSync(filepath)) return [];

  try {
    const raw = readFileSync(filepath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn(`Could not parse ${filepath}; starting with empty metadata.`);
    return [];
  }
}

// ── Main script (only runs when executed directly) ────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const isDirectRun = resolve(process.argv[1]) === resolve(__filename);

if (isDirectRun) {
  const __dirname = dirname(__filename);
  const ROOT = join(__dirname, "..");

  const IMAGES_DIR = join(ROOT, "cards", "images");
  const VALID_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
  const OUTPUT_FILE = join(ROOT, "cards.json");

  const existingCards = readExistingCards(OUTPUT_FILE);
  const existingById = new Map(existingCards.map((card) => [card.id, card]));

  const cards = [];

  if (!existsSync(IMAGES_DIR)) {
    console.error(`Image directory not found: cards/images/`);
    process.exit(1);
  }

  let files;
  try {
    files = readdirSync(IMAGES_DIR, { withFileTypes: true });
  } catch (err) {
    console.error(`Failed to read image directory: ${err.message}`);
    process.exit(1);
  }

  for (const entry of files) {
    if (!entry.isFile()) continue;

    const extension = extname(entry.name).toLowerCase();
    if (!VALID_EXTENSIONS.has(extension)) continue;

    const type = getInferredType(entry.name);
    if (!type) continue;

    const id = getCardId(entry.name);
    const name = getDisplayName(entry.name);
    const existing = existingById.get(id) || {};

    const mergedTags = uniqueTags(
      Array.isArray(existing.tags) ? existing.tags : []
    ).filter((tag) => {
      const lower = tag.toLowerCase().trim();
      return lower !== "plane" && lower !== "phenomenon";
    });

    const card = {
      id,
      name,
      type,
      image: `cards/images/${name}${extname(entry.name)}`,
      thumb: `cards/thumbs/${name}.webp`,
      transcript: `cards/transcripts/${name}.md`,
      tags: mergedTags
    };

    cards.push(card);
  }

  cards.sort((a, b) => {
    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base"
    });
  });

  if (cards.length === 0) {
    console.error("No valid card images found. Refusing to overwrite cards.json.");
    process.exit(1);
  }

  try {
    writeFileSync(OUTPUT_FILE, JSON.stringify(cards, null, 2) + "\n");
    console.log(`Generated cards.json with ${cards.length} cards.`);
  } catch (err) {
    console.error(`Failed to write cards.json: ${err.message}`);
    process.exit(1);
  }
}
