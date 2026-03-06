const fs = require("fs");
const path = require("path");

const STATUS_FOLDERS = ["complete", "incomplete"];
const VALID_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

const cards = [];
const generatedCardData = {};

const existingCardData = readExistingCardData("cardData.json");

for (const folder of STATUS_FOLDERS) {
  const folderPath = path.join("images", "cards", folder);

  if (!fs.existsSync(folderPath)) continue;

  const files = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const entry of files) {
    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name).toLowerCase();
    if (!VALID_EXTENSIONS.has(extension)) continue;

    const type = getCardType(entry.name);
    if (!type) {
      console.warn(`Skipping file without valid type prefix: ${entry.name}`);
      continue;
    }

    const key = getCardKey(entry.name);
    const statusTag = folder === "complete" ? "complete" : "wip";
    const typeTag = type.toLowerCase();

    cards.push({
      file: entry.name,
      folder,
      type
    });

    const existing = existingCardData[key] || {};
    const existingTags = Array.isArray(existing.tags) ? existing.tags : [];

    generatedCardData[key] = {
      ...existing,
      tags: uniqueTags([
        typeTag,
        statusTag,
        ...existingTags
      ])
    };
  }
}

cards.sort((a, b) => {
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  if (a.folder !== b.folder) return a.folder.localeCompare(b.folder);
  return a.file.localeCompare(b.file, undefined, {
    numeric: true,
    sensitivity: "base"
  });
});

const sortedCardData = Object.fromEntries(
  Object.entries(generatedCardData).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  )
);

fs.writeFileSync("cards.json", JSON.stringify(cards, null, 2) + "\n");
fs.writeFileSync("cardData.json", JSON.stringify(sortedCardData, null, 2) + "\n");

console.log(`Generated cards.json with ${cards.length} cards.`);
console.log(`Generated cardData.json with ${Object.keys(sortedCardData).length} entries.`);

function getCardType(filename) {
  if (/^Plane[-_ ]/i.test(filename)) return "Plane";
  if (/^Phenomenon[-_ ]/i.test(filename)) return "Phenomenon";
  return null;
}

function getCardKey(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

function uniqueTags(tags) {
  return [...new Set(
    tags
      .map(tag => String(tag).trim().toLowerCase())
      .filter(Boolean)
  )];
}

function readExistingCardData(filepath) {
  if (!fs.existsSync(filepath)) return {};

  try {
    const raw = fs.readFileSync(filepath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn(`Could not parse ${filepath}; starting fresh.`);
    return {};
  }
}