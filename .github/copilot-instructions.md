# Copilot Instructions for Planar Atlas

## Project Summary

Planar Atlas is a static web gallery and searchable database for Magic: The Gathering's Planechase format. It is hosted via GitHub Pages at `planechase.terraphice.dev`. There is no backend, no build system, and no framework — the entire site is vanilla HTML, CSS, and JavaScript (ES6 modules).

## Repository Overview

- **Type:** Static website (no build step for the site itself)
- **Languages:** HTML5, CSS3, JavaScript (ES6 modules, `type="module"`)
- **Runtime dependencies (CDN, no install needed):** `marked.js` (Markdown rendering), `DOMPurify` (sanitisation), `mana-font` (MTG icon font)
- **Node.js** is only needed to run `generate-cards.js` and `sync-cards.js` (data generation scripts)
- **No test framework, no linter, no bundler, no CI/CD pipelines**
- **Hosting:** GitHub Pages (CNAME: `planechase.terraphice.dev`)
- **package.json** is empty (`{}`); there are no npm dependencies to install

## Project Layout

```
/
├── index.html            # Single-page app entry point
├── style.css             # All styling (~1700 lines), CSS variables, themes
├── gallery.js            # Main application logic, state management, event wiring
├── gallery-ui.js         # Theme system and toast notification controllers
├── gallery-utils.js      # Pure utility functions: preferences, search parsing, card enrichment
├── generate-cards.js     # Node.js script to regenerate cards.json from image files
├── sync-cards.js         # Node.js script to sync per-card JSON files from cards.json
├── cards.json            # Auto-generated master card database (230 cards); do not edit by hand
├── CNAME                 # GitHub Pages custom domain
├── README.md             # Minimal project description
├── package.json          # Empty — no dependencies
├── cards/                # Per-card metadata JSON files (one per card)
├── images/
│   ├── assets/           # Static assets (e.g., social-preview.jpg)
│   ├── cards/
│   │   ├── complete/     # Full card images (.png, .jpg, .webp, .avif)
│   │   └── incomplete/   # Partial/work-in-progress card images
│   └── thumb/            # Thumbnail images
├── transcripts/
│   └── cards/complete/   # Card text transcripts (.md and .txt, one per card)
└── MSE/                  # Magic Set Editor project files (offline editing only)
```

## Architecture

- **`gallery.js`** — Initialises the app, manages state (filters, display mode, current card), wires all DOM events, handles modal navigation, search suggestions, tag filtering, and card rendering. Imports from `gallery-ui.js` and `gallery-utils.js`.
- **`gallery-ui.js`** — `ThemeController` (7 palettes: `standard`, `gruvbox`, `atom`, `dracula`, `solarized`, `nord`, `catppuccin`; 3 modes: `system`, `dark`, `light`) and `ToastManager` (ephemeral notifications).
- **`gallery-utils.js`** — Stateless helpers: `loadPreferences`/`savePreferences` (localStorage key `planar-atlas-prefs-v2`), `getCardKey`, `getDisplayName`, search/filter logic, tag badge parsing.
- **`cards.json`** — Array of card objects `{ file, folder, tags[] }`. Consumed at runtime via `fetch()`. Do not edit by hand; regenerate with `generate-cards.js` when adding/removing card images.
- **`style.css`** — Uses CSS custom properties for theming. Each palette sets `--bg`, `--fg`, `--accent`, etc. on `:root`. No preprocessor.

## Card Data Format

```json
{ "file": "Plane_Akoum.png", "folder": "complete", "tags": ["badge:tr:green:Official", "Plane", "Zendikar"] }
```

- **`folder`**: `"complete"` or `"incomplete"`
- **`tags`**: Free-form strings; badge syntax is `badge:<position>:<colour>:<label>` (e.g., `badge:tr:green:Official`)
- Card display names are derived from filenames: `Plane_Akoum.png` → `Akoum` (prefix `Plane_`/`Phenomenon_` and underscores are stripped)

## Build and Data Generation

There is **no build step** for the website. To regenerate `cards.json` after adding or removing card images:

```bash
node generate-cards.js
```

- Requires Node.js (any recent LTS, e.g., v18+). No `npm install` needed.
- Scans `images/cards/complete/` and `images/cards/incomplete/` for `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif` files.
- Preserves existing metadata from `cards.json` and merges in newly inferred type tags (`Plane`, `Phenomenon`).
- Refuses to overwrite `cards.json` if no valid images are found (exits with code 1).
- Output is written to `cards.json` in the repo root.

To sync the per-card JSON files in `cards/` from `cards.json`:

```bash
node sync-cards.js
```

- Writes one JSON file per card to `cards/` (e.g., `cards/akoum.json`).
- Removes any stale files in `cards/` that no longer have a corresponding entry in `cards.json`.

Both scripts can also be run via npm:

```bash
npm run generate   # runs generate-cards.js
npm run sync       # runs sync-cards.js
```

These scripts are also run automatically by GitHub Actions:
- **`generate-cards.yml`** — triggers when images in `images/cards/**` are pushed, commits updated `cards.json`.
- **`sync-cards.yml`** — triggers when `cards.json` is pushed, commits updated files in `cards/`.

## Running Locally

Open `index.html` in a browser **served over HTTP** (not `file://`), because the app uses ES6 `import` and `fetch()`:

```bash
# Using Python (no install required)
python3 -m http.server 8080
# Then open http://localhost:8080
```

Or use any static file server (e.g., `npx serve`, VS Code Live Server extension).

## Coding Conventions

- **JavaScript:** ES6 modules (`import`/`export`), camelCase functions and variables, no TypeScript, no transpilation
- **CSS:** Kebab-case class names (e.g., `.sidebar-toggle`, `.modal-header`), CSS custom properties for all theme values
- **HTML:** Lowercase element IDs and class names, ARIA labels on interactive controls, semantic markup
- **Filenames:** Kebab-case for JS/CSS (e.g., `gallery-utils.js`); card images use `Plane_CardName.png` / `Phenomenon_CardName.png` convention
- No comments should be added unless they match the style of existing comments in the same file

## Validation

There are no automated tests or linters. To validate changes:

1. Run `node generate-cards.js` if card images changed (verify no errors and count is non-zero)
2. Run `node sync-cards.js` to verify per-card JSON files are up to date
3. Serve locally with `python3 -m http.server 8080` and open `http://localhost:8080`
4. Check the browser console for JavaScript errors
5. Manually verify affected features (search, filtering, modal, theme switching)

**Trust these instructions.** Only search or explore further if you find them incomplete or incorrect.
