# Copilot Instructions for Planar Atlas

## Project Summary

Planar Atlas is a full-featured Planechase tool for Magic: The Gathering, hosted via GitHub Pages at `planechase.terraphice.dev`. It provides a searchable card gallery, a deck builder, and a full game simulator supporting both Classic and Blind Eternities Map modes. There is no backend, no build system, and no framework — the entire site is vanilla HTML, CSS, and JavaScript (ES6 modules).

## Repository Overview

- **Type:** Static website (no build step for the site itself)
- **Languages:** HTML5, CSS3, JavaScript (ES6 modules, `"type": "module"` in package.json)
- **Runtime dependencies (CDN, no install needed):** `marked.js` (Markdown rendering), `DOMPurify` (sanitisation), `mana-font` (MTG icon font)
- **Node.js** is only needed to run `generate-cards.js` and `sync-cards.js` (data generation scripts); no `npm install` is required
- **No test framework, no linter, no bundler**
- **CI/CD:** Two GitHub Actions workflows (`.github/workflows/`) automate `cards.json` regeneration and per-card JSON sync on push to `main`
- **Hosting:** GitHub Pages (CNAME: `planechase.terraphice.dev`)
- **PWA:** `sw.js` (service worker) + `manifest.json` enable offline caching and installability

## Project Layout

```
/
├── index.html            # Single-page app entry point
├── style.css             # All styling (~1700 lines), CSS variables, themes
├── gallery.js            # Main application: initialisation, DOM wiring, event orchestration
├── gallery-ui.js         # Theme system (ThemeController) and toast notifications (ToastManager)
├── gallery-utils.js      # Pure utility functions: preferences, search parsing, card enrichment
├── gallery-render.js     # Card rendering: grid/single/stack/list views, pagination, tag grouping
├── gallery-search.js     # Search input handling, suggestion building, inline autocomplete
├── gallery-modal.js      # Modal card-detail viewer: navigation, transcript loading, image flip
├── gallery-state.js      # Centralised state: preferences, filters, displayState, paginationState
├── deck.js               # Deck builder and game state management (Classic + BEM game modes)
├── game-classic.js       # Classic shared-deck Planechase game mode rendering
├── game-bem.js           # Blind Eternities Map game mode rendering
├── sw.js                 # Service worker for offline caching (cache name: planar-atlas-v1)
├── manifest.json         # PWA web app manifest
├── favicon.svg           # Site favicon
├── generate-cards.js     # Node.js script to regenerate cards.json from image files
├── sync-cards.js         # Node.js script to sync per-card JSON files from cards.json
├── cards.json            # Auto-generated master card database (230 cards); do not edit by hand
├── package.json          # "type": "module" + npm scripts (generate, sync); no dependencies
├── package-lock.json     # Lock file (no installable packages; exists due to module type)
├── CNAME                 # GitHub Pages custom domain
├── README.md             # Project description
├── cards/                # Per-card metadata JSON files (one per card, kebab-case filenames)
├── images/
│   ├── assets/           # Static assets (favicons, social preview image)
│   ├── cards/
│   │   ├── complete/     # Full card images (.png, .jpg, .webp, .avif)
│   │   └── incomplete/   # Work-in-progress card images
│   └── thumb/            # Thumbnail images
├── transcripts/
│   └── cards/complete/   # Card text transcripts (.md and .txt, one per card)
└── MSE/                  # Magic Set Editor project files (offline editing only)
```

## Architecture

### JavaScript Modules

| Module | Lines | Purpose |
|---|---|---|
| `deck.js` | ~2750 | Deck builder, game state, Classic + BEM logic, profile seeds, undo history |
| `gallery.js` | ~975 | App init, DOM wiring, event orchestration — the main entry point |
| `gallery-render.js` | ~775 | Card rendering (all view modes), tag grouping, pagination |
| `game-bem.js` | ~750 | Blind Eternities Map game mode rendering |
| `gallery-utils.js` | ~580 | Stateless helpers: preferences, search/filter, card enrichment, badge parsing |
| `gallery-modal.js` | ~385 | Modal card viewer: navigation, transcript loading, image flip animation |
| `game-classic.js` | ~320 | Classic shared-deck game mode rendering |
| `gallery-search.js` | ~280 | Search suggestions, keyboard navigation, inline ghost-text autocomplete |
| `gallery-ui.js` | ~205 | `ThemeController` (palettes + modes) and `ToastManager` (ephemeral notifications) |
| `gallery-state.js` | ~66 | State objects (`preferences`, `filters`, `displayState`, `paginationState`) and `initStateManager()` |

### Module Responsibilities

- **`gallery.js`** — Imports from all other gallery modules and `deck.js`. Bootstraps the app: fetches `cards.json`, enriches cards, wires all DOM events, and delegates rendering/search/modal/state to specialised modules.
- **`gallery-ui.js`** — `initThemeController({ button, initialTheme, initialPalette, onChange })` manages 8 palettes and 3 theme modes. `initToastManager(container)` creates ephemeral toast notifications. Palettes cycle with alt-click (hidden palette list).
- **`gallery-utils.js`** — `loadPreferences(storageKey)` / `savePreferences(storageKey, ...)` (localStorage key `"planechaseGalleryPreferences.v2"`). `enrichCard()` adds image paths, normalises tags, detects card type. `parseSearchQuery()` handles advanced search syntax. `fuzzyIncludes()` uses Levenshtein distance.
- **`gallery-state.js`** — Exports `STORAGE_KEY = "planechaseGalleryPreferences.v2"` and shared state objects. `initStateManager()` connects UI toggles to state and persistence. Also handles URL state serialisation (`readUrlState` / `writeUrlState` from `gallery-utils.js`).
- **`gallery-render.js`** — Renders cards in grid, single, stack, or list view. Handles paginated and infinite-scroll pagination. Parses illustrator info from transcripts.
- **`gallery-search.js`** — Builds suggestion list from tags and card names. Handles keyboard navigation (Arrow keys, Tab, Enter) and inline autocomplete ghost text.
- **`gallery-modal.js`** — Opens/closes the card-detail modal, loads transcripts asynchronously, navigates between adjacent cards, animates image flip for phenomena. Syncs state to URL hash (`#card=...`).
- **`deck.js`** — Full deck builder (multiple named deck slots), game state machine for Classic and BEM modes, profile seed encoding/decoding (shareable string that encodes all preferences + decks), and undo history (up to 20 steps).
- **`game-classic.js`** / **`game-bem.js`** — Rendering layers for their respective game modes; driven by state in `deck.js`.
- **`cards.json`** — Array of `{ file, folder, tags[] }` objects. Consumed at runtime via `fetch()`. Do not edit by hand.
- **`style.css`** — CSS custom properties for theming. Each palette overrides `--bg`, `--fg`, `--accent`, etc. on `:root`. No preprocessor.

## Card Data Format

```json
{ "file": "Plane_Akoum.png", "folder": "complete", "tags": ["badge:tr:green:Official", "Plane", "Zendikar"] }
```

- **`folder`**: `"complete"` or `"incomplete"`
- **`tags`**: Free-form strings with two special syntaxes:
  - **Badge:** `badge:<position>:<colour>:<label>` (e.g., `badge:tr:green:Official`) — renders a coloured corner badge. An optional `:top:` prefix (e.g., `:top:badge:tr:amber:Custom`) places it above the card in list view.
  - **Hidden:** the literal string `"hidden"` hides a card from the default gallery view (requires the "Show Hidden" toggle to see it).
- Card display names are derived from filenames: `Plane_Akoum.png` → `Akoum` (prefix `Plane_`/`Phenomenon_` stripped, underscores replaced with spaces)

## Theme System

- **8 palettes:** `standard`, `gruvbox`, `atom`, `dracula`, `solarized`, `nord`, `catppuccin`, `scryfall`
- **3 modes:** `system` (follows OS preference), `dark`, `light`
- Click the theme button to cycle modes (`system → dark → light`). Alt-click to cycle through hidden palettes.
- Icons: system `◐`, dark `☾`, light `☀`

## Search Syntax

The search input in `gallery-utils.js` (`parseSearchQuery`) supports:

| Syntax | Behaviour |
|---|---|
| `name:akoum` | Match card display name |
| `tag:Zendikar` | Match a specific tag |
| `type:Plane` | Match card type (`Plane` or `Phenomenon`) |
| `oracle:whenever` | Match card transcript text |
| `/regex/` | Regular expression match against card name |
| `"quoted phrase"` | Exact phrase match |
| `-term` | Negate any of the above |
| Plain text | Fuzzy name match (Levenshtein distance) when fuzzy mode is on; substring match when off |

## Preferences & State

- **localStorage key:** `"planechaseGalleryPreferences.v2"`
- **View modes:** `grid`, `single`, `stack`, `list`
- **Pagination modes:** `paginated` (page size: 10/20/50/100), `infinite` (scroll)
- **Group-by modes:** `none`, `tag` (groups by a selected tag value)
- **Toggles:** fuzzy search, inline autocomplete, show hidden cards, phenomenon animation, risky hellriding
- URL parameters are used to encode search/filter/view state for shareable links

## Build and Data Generation

There is **no build step** for the website. To regenerate `cards.json` after adding or removing card images:

```bash
node generate-cards.js
# or: npm run generate
```

- Requires Node.js (any recent LTS, e.g., v18+). No `npm install` needed.
- Scans `images/cards/complete/` and `images/cards/incomplete/` for `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif` files.
- Preserves existing tags from `cards.json` and merges in auto-inferred type tags (`Plane`, `Phenomenon`).
- Refuses to overwrite `cards.json` if no valid images are found (exits with code 1).

To sync the per-card JSON files in `cards/` from `cards.json`:

```bash
node sync-cards.js
# or: npm run sync
```

- Writes `cards/<kebab-case-name>.json` for each card.
- Removes stale files in `cards/` with no corresponding entry in `cards.json`.

These scripts are also run automatically by GitHub Actions on push to `main`:
- **`generate-cards.yml`** — triggers on changes to `images/cards/**` or `generate-cards.js`; commits updated `cards.json`.
- **`sync-cards.yml`** — triggers on changes to `cards.json` or `sync-cards.js`; commits updated files in `cards/`.

Both workflows check whether the output actually changed before committing (no empty commits).

## Running Locally

Open `index.html` in a browser **served over HTTP** (not `file://`), because the app uses ES6 `import` and `fetch()`:

```bash
# Using Python (no install required)
python3 -m http.server 8080
# Then open http://localhost:8080
```

Or use any static file server (e.g., `npx serve`, VS Code Live Server extension).

The service worker (`sw.js`) caches all JS modules, `cards.json`, and CDN assets on first load for offline use.

## Keyboard Shortcuts (Game Mode)

| Key | Action |
|---|---|
| `Space` | Roll the planar die |
| `Enter` | Planeswalk (move to next plane) |
| `I` | Inspect the current card |
| `T` | Toggle the Tools menu |
| `Escape` | Close any open overlay |

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
5. Manually verify affected features:
   - **Gallery:** search, tag filtering, view mode switching, pagination, modal open/close, transcript display
   - **Theme:** palette cycling (click), mode cycling (alt-click), persistence across page reload
   - **Deck builder:** add/remove cards, save/load deck slots, import/export
   - **Game modes:** Classic and BEM game start, planeswalking, die roll, undo, keyboard shortcuts
   - **Profile seeds:** export seed, reload page, import seed, verify state restored

**Trust these instructions.** Only search or explore further if you find them incomplete or incorrect.
