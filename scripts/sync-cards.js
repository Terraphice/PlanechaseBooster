import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

// ── Exported helper functions (also used by tests) ────────────────────────────

export function getCardJsonFilename(filename) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const withoutPrefix = withoutExtension.replace(/^(Plane|Phenomenon)[-_ ]+/i, "");
  return withoutPrefix.toLowerCase().replace(/[_ ]+/g, "-") + ".json";
}

// ── Main script (only runs when executed directly) ────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const isDirectRun = resolve(process.argv[1]) === resolve(__filename);

if (isDirectRun) {
  const __dirname = dirname(__filename);
  const ROOT = join(__dirname, "..");

  const CARDS_JSON = join(ROOT, "cards.json");
  const CARDS_DIR = join(ROOT, "cards");

  let cards;
  try {
    const raw = readFileSync(CARDS_JSON, "utf8");
    cards = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read or parse cards.json: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(cards) || cards.length === 0) {
    console.error("No cards found in cards.json.");
    process.exit(1);
  }

  if (!existsSync(CARDS_DIR)) {
    mkdirSync(CARDS_DIR);
  }

  const expectedFiles = new Set();
  let written = 0;
  let unchanged = 0;

  for (const card of cards) {
    if (typeof card.file !== "string" || !card.file) {
      console.warn(`Skipping card with missing or invalid "file" field: ${JSON.stringify(card)}`);
      continue;
    }
    const jsonFilename = getCardJsonFilename(card.file);
    expectedFiles.add(jsonFilename);

    const outputPath = join(CARDS_DIR, jsonFilename);
    const output = { file: card.file, tags: Array.isArray(card.tags) ? card.tags : [] };
    const content = JSON.stringify(output, null, 2) + "\n";

    try {
      if (existsSync(outputPath) && readFileSync(outputPath, "utf8") === content) {
        unchanged++;
        continue;
      }
    } catch {
      // File read failed — treat as changed and rewrite.
    }

    try {
      writeFileSync(outputPath, content);
      console.log(`Written: ${jsonFilename}`);
      written++;
    } catch (err) {
      console.error(`Failed to write ${jsonFilename}: ${err.message}`);
    }
  }

  let existingFiles;
  try {
    existingFiles = readdirSync(CARDS_DIR).filter((f) => f.endsWith(".json"));
  } catch (err) {
    console.error(`Failed to list files in cards/ directory: ${err.message}`);
    existingFiles = [];
  }
  let removed = 0;

  for (const file of existingFiles) {
    if (!expectedFiles.has(file)) {
      try {
        unlinkSync(join(CARDS_DIR, file));
        console.log(`Removed: ${file}`);
        removed++;
      } catch (err) {
        console.error(`Failed to remove ${file}: ${err.message}`);
      }
    }
  }

  console.log(`Sync complete: ${written} updated, ${unchanged} unchanged, ${removed} removed.`);
}
