import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const CARDS_JSON = join(ROOT, "cards.json");
const CARDS_DIR = join(ROOT, "cards");

const raw = readFileSync(CARDS_JSON, "utf8");
const cards = JSON.parse(raw);

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
  const jsonFilename = getCardJsonFilename(card.file);
  expectedFiles.add(jsonFilename);

  const outputPath = join(CARDS_DIR, jsonFilename);
  const output = { file: card.file, tags: card.tags };
  const content = JSON.stringify(output, null, 2) + "\n";

  if (existsSync(outputPath) && readFileSync(outputPath, "utf8") === content) {
    unchanged++;
    continue;
  }

  writeFileSync(outputPath, content);
  console.log(`Written: ${jsonFilename}`);
  written++;
}

const existingFiles = readdirSync(CARDS_DIR).filter((f) => f.endsWith(".json"));
let removed = 0;

for (const file of existingFiles) {
  if (!expectedFiles.has(file)) {
    unlinkSync(join(CARDS_DIR, file));
    console.log(`Removed: ${file}`);
    removed++;
  }
}

console.log(`Sync complete: ${written} updated, ${unchanged} unchanged, ${removed} removed.`);

function getCardJsonFilename(filename) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const withoutPrefix = withoutExtension.replace(/^(Plane|Phenomenon)[-_ ]+/i, "");
  return withoutPrefix.toLowerCase().replace(/[_ ]+/g, "-") + ".json";
}
