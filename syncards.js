const fs = require("fs");
const path = require("path");

const CARDS_JSON = "cards.json";
const CARDS_DIR = "cards";

const raw = fs.readFileSync(CARDS_JSON, "utf8");
const cards = JSON.parse(raw);

if (!Array.isArray(cards) || cards.length === 0) {
  console.error("No cards found in cards.json.");
  process.exit(1);
}

if (!fs.existsSync(CARDS_DIR)) {
  fs.mkdirSync(CARDS_DIR);
}

const expectedFiles = new Set();
let written = 0;
let unchanged = 0;

for (const card of cards) {
  const jsonFilename = getCardJsonFilename(card.file);
  expectedFiles.add(jsonFilename);

  const outputPath = path.join(CARDS_DIR, jsonFilename);
  const output = { file: card.file, tags: card.tags };
  const content = JSON.stringify(output, null, 2) + "\n";

  if (fs.existsSync(outputPath) && fs.readFileSync(outputPath, "utf8") === content) {
    unchanged++;
    continue;
  }

  fs.writeFileSync(outputPath, content);
  console.log(`Written: ${jsonFilename}`);
  written++;
}

const existingFiles = fs.readdirSync(CARDS_DIR).filter((f) => f.endsWith(".json"));
let removed = 0;

for (const file of existingFiles) {
  if (!expectedFiles.has(file)) {
    fs.unlinkSync(path.join(CARDS_DIR, file));
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
