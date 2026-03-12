# Copilot Instructions for Planar Atlas

## Project Summary

Planar Atlas is a full-featured Planechase tool for Magic: The Gathering, hosted via GitHub Pages at `planechase.terraphice.dev`. It provides a searchable card gallery, a deck builder, and a full game simulator supporting both Classic and Blind Eternities Map modes. There is no backend, no build system, and no framework — the entire site is vanilla HTML, CSS, and JavaScript (ES6 modules).

## Repository Overview

- **Type:** Static website (no build step for the site itself)
- **Languages:** HTML5, CSS3, JavaScript (ES6 modules, `"type": "module"` in `package.json`)
- **Runtime dependencies (CDN, no install needed):** `marked.js` (Markdown rendering), `DOMPurify` (sanitisation), `mana-font` (MTG icon font)
- **Node.js** is only needed to run the scripts in `scripts/`; no `npm install` is required for the site, but `npm install` is needed to run `npm run lint` (installs ESLint)
- **Linting:** ESLint (`eslint.config.js`); run with `npm run lint` (requires `npm install` first to install eslint)
- **Testing:** Node.js smoke and unit test scripts in `scripts/`; run with `npm test` or `npm run test:unit`
- **CI/CD:** Six GitHub Actions workflows automate card database generation, per-card JSON sync, smoke tests, service worker cache busting, version bumping on release, and README badge updates
- **Hosting:** GitHub Pages (CNAME: `planechase.terraphice.dev`)
- **PWA:** `sw.js` (service worker) + `manifest.json` enable offline caching and installability

## Project Layout

```
/
├── index.html              # Single-page app entry point
├── sw.js                   # Service worker for offline caching (CACHE_VERSION updated by CI)
├── manifest.json           # PWA web app manifest
├── cards.json              # Auto-generated master card database (230 cards); do not edit by hand
├── version.json            # Current release version {"version":"1.0.0"}; updated by CI on release
├── package.json            # "type": "module" + npm scripts; no runtime dependencies
├── eslint.config.js        # ESLint configuration (requires npm install to run)
├── CNAME                   # GitHub Pages custom domain
├── README.md               # Project description and badges
├── assets/                 # Static assets: favicon.svg, favicon-192.png, favicon-512.png, card-preview.jpg
├── styles/
│   ├── themes.css          # CSS custom properties for all 8 palettes and 3 theme modes
│   ├── gallery.css         # Gallery UI styles (~1956 lines)
│   └── game.css            # Game mode styles (~3876 lines)
├── src/
│   ├── changelog.js        # Fetches latest GitHub release; shows "What's New" panel once per version
│   ├── gallery/
│   │   ├── index.js        # Main app entry: init, DOM wiring, event orchestration (~1010 lines)
│   │   ├── ui.js           # ThemeController and ToastManager (~204 lines)
│   │   ├── utils.js        # Pure utility functions: enrichCard, parseSearchQuery, fuzzyIncludes (~638 lines)
│   │   ├── render.js       # Card rendering: grid/single/stack/list views, pagination (~835 lines)
│   │   ├── search.js       # Search suggestions, keyboard nav, inline ghost-text autocomplete (~279 lines)
│   │   ├── modal.js        # Modal card-detail viewer: navigation, transcript loading, image flip (~387 lines)
│   │   └── state.js        # Shared state objects and initStateManager() (~70 lines)
│   ├── deck/
│   │   ├── index.js        # Deck builder, game state orchestration, profile seeds (~743 lines)
│   │   ├── panel.js        # Deck panel UI: open/close, list rendering, import/export (~561 lines)
│   │   └── codec.js        # Pure encoding/decoding for deck and game state seeds (~109 lines)
│   └── game/
│       ├── ui.js           # Shared game UI: card reader, reveal overlay, die rolling, tutorials (~1641 lines)
│       ├── state.js        # Game state machine: history, undo/redo, encode/decode (~443 lines)
│       ├── classic.js      # Classic shared-deck Planechase game mode rendering (~357 lines)
│       └── bem.js          # Blind Eternities Map game mode rendering (~957 lines)
├── scripts/
│   ├── generate-cards.js   # Node.js: regenerates cards.json from cards/images/
│   ├── sync-cards.js       # Node.js: syncs per-card JSON files in cards/ from cards.json
│   ├── smoke-test.js       # Integration smoke tests (cards.json integrity, required files, etc.)
│   ├── test-codec.js       # Unit tests for deck/codec.js encoding/decoding
│   └── test-utils.js       # Unit tests for gallery/utils.js (search parsing, card matching)
├── cards/
│   ├── images/             # Card images (.png, .webp, etc.) — flat directory, no subdirs
│   ├── thumbs/             # Thumbnail images
│   └── *.json              # Per-card metadata JSON files (kebab-case, one per card)
├── transcripts/
│   └── cards/complete/     # Card text transcripts (.md and .txt, one per card)
└── MSE/                    # Magic Set Editor project files (offline editing only)
```

## Architecture

### JavaScript Modules

| Module | Lines | Purpose |
|---|---|---|
| `src/game/ui.js` | ~1641 | Shared game UI: card reader, reveal overlay, library view, die rolling, tutorials |
| `src/gallery/index.js` | ~1010 | App init, DOM wiring, event orchestration — the main entry point |
| `src/game/bem.js` | ~957 | Blind Eternities Map game mode rendering and interaction |
| `src/gallery/render.js` | ~835 | Card rendering (all view modes), tag grouping, pagination |
| `src/deck/index.js` | ~743 | Deck builder, game state orchestration, profile seeds, undo history |
| `src/gallery/utils.js` | ~638 | Stateless helpers: enrichCard, parseSearchQuery, fuzzyIncludes, badge parsing |
| `src/deck/panel.js` | ~561 | Deck panel UI: open/close, list rendering, slot management, import/export |
| `src/game/state.js` | ~443 | Game state machine: history management, undo/redo, encode/decode, game lifecycle |
| `src/gallery/modal.js` | ~387 | Modal card viewer: navigation, transcript loading, image flip animation |
| `src/game/classic.js` | ~357 | Classic shared-deck Planechase game mode rendering |
| `src/gallery/search.js` | ~279 | Search suggestions, keyboard navigation, inline ghost-text autocomplete |
| `src/gallery/ui.js` | ~204 | `ThemeController` (palettes + modes) and `ToastManager` (ephemeral notifications) |
| `src/gallery/state.js` | ~70 | State objects (`preferences`, `filters`, `displayState`, `paginationState`) |
| `src/deck/codec.js` | ~109 | Pure encoding/decoding for deck seeds and game state seeds |
| `src/changelog.js` | ~81 | Fetches latest GitHub release; shows "What's New" panel once per version |

### Module Responsibilities

- **`src/gallery/index.js`** — Imports from all other gallery modules and `src/deck/index.js`. Bootstraps the app: fetches `cards.json`, enriches cards, wires all DOM events, delegates to specialised modules.
- **`src/gallery/ui.js`** — `initThemeController({ button, initialTheme, initialPalette, onChange })` manages 8 palettes and 3 theme modes. `initToastManager(container)` creates ephemeral toast notifications.
- **`src/gallery/utils.js`** — `loadPreferences(storageKey)` / `savePreferences(storageKey, ...)`. `enrichCard()` adds image paths, normalises tags, detects card type. `parseSearchQuery()` handles advanced search syntax. `fuzzyIncludes()` uses Levenshtein distance.
- **`src/gallery/state.js`** — Exports `STORAGE_KEY = "planechaseGalleryPreferences.v2"` and shared state objects. `initStateManager()` connects UI toggles to state and persistence. Handles URL state serialisation via `readUrlState` / `writeUrlState` from `gallery/utils.js`.
- **`src/gallery/render.js`** — Renders cards in grid, single, stack, or list view. Handles paginated and infinite-scroll pagination. Parses illustrator info from transcripts.
- **`src/gallery/search.js`** — Builds suggestion list from tags and card names. Handles keyboard navigation (Arrow keys, Tab, Enter) and inline autocomplete ghost text.
- **`src/gallery/modal.js`** — Opens/closes the card-detail modal, loads transcripts asynchronously, navigates between adjacent cards, animates image flip for phenomena. Syncs state to URL hash (`#card=...`).
- **`src/deck/index.js`** — Full deck builder (10 named deck slots), orchestrates game mode start/stop, profile seed encoding/decoding, and undo history (up to 20 steps).
- **`src/deck/panel.js`** — Deck panel open/close/shelve, list rendering, slot dropdown, card overlays, auto-import, deck import/export.
- **`src/deck/codec.js`** — `compressKey`/`decompressKey` for card key compression. `encodeDeck`/`decodeDeck` for deck serialisation. `toBase64Url`/`fromBase64Url` for URL-safe base64.
- **`src/game/ui.js`** — Shared game UI rendering: card reader view, reveal overlay, library view, game menus, die rolling, cost display, BEM zoom, and tutorial overlay.
- **`src/game/state.js`** — Game state machine: `pushGameHistory`, `undoLastAction`, `redoNextAction`, `encodeGameState`, `decodeGameState`, `autoSaveGameState`. Max 20 history steps.
- **`src/game/classic.js`** / **`src/game/bem.js`** — Rendering layers for their respective game modes; driven by state in `src/deck/index.js`.
- **`src/changelog.js`** — Calls GitHub Releases API on startup; shows a modal overlay when a new version is detected. Last-seen version stored in localStorage key `planar-atlas-last-seen-version`.
- **`cards.json`** — Array of `{ file, tags[] }` objects. Consumed at runtime via `fetch()`. Do not edit by hand.
- **`styles/themes.css`** — CSS custom properties for theming. Each palette overrides `--bg`, `--text`, `--accent`, etc. on `:root`. No preprocessor.

## Card Data Format

```json
{ "file": "Plane_Akoum.png", "tags": ["badge:tr:green:Official", "Plane", "Zendikar"] }
```

- **`tags`**: Free-form strings with two special syntaxes:
  - **Badge:** `badge:<position>:<colour>:<label>` (e.g., `badge:tr:green:Official`) — renders a coloured corner badge. An optional `:top:` prefix (e.g., `:top:badge:tr:amber:Custom`) places it above the card in list view.
  - **Hidden:** the literal string `"hidden"` hides a card from the default gallery view (requires the "Show Hidden" toggle to see it).
- Card display names are derived from filenames: `Plane_Akoum.png` → `Akoum` (prefix `Plane_`/`Phenomenon_` stripped, underscores replaced with spaces).
- Card images live in `cards/images/` as a flat directory (no subdirectories).

## Theme System

- **8 palettes:** `standard`, `gruvbox`, `atom`, `dracula`, `solarized`, `nord`, `catppuccin`, `scryfall`
- **3 modes:** `system` (follows OS preference), `dark`, `light`
- Click the theme button to cycle modes (`system → dark → light`). Alt-click to cycle through palettes.
- Icons: system `◐`, dark `☾`, light `☀`
- Theme CSS variables defined in `styles/themes.css`; gallery and game styles in `styles/gallery.css` and `styles/game.css`.

## Search Syntax

The search input (`parseSearchQuery` in `src/gallery/utils.js`) supports:

| Syntax | Behaviour |
|---|---|
| `name:akoum` | Match card display name |
| `tag:Zendikar` | Match a specific tag |
| `type:Plane` | Match card type (`Plane` or `Phenomenon`) |
| `oracle:whenever` | Match card transcript text |
| `show:hidden` | Show hidden cards inline (sets `showHidden` flag) |
| `/regex/` | Regular expression match against card name |
| `"quoted phrase"` | Exact phrase match |
| `-term` | Negate any of the above |
| Plain text | Fuzzy name match (Levenshtein distance) when fuzzy mode is on; substring match when off |

## Preferences & State

- **localStorage key:** `"planechaseGalleryPreferences.v2"`
- **View modes:** `grid`, `single`, `stack`, `list`
- **Pagination modes:** `paginated` (page size: 10/20/50/100), `infinite` (scroll)
- **Group-by modes:** `none`, `tag` (groups by a selected tag value)
- **Toggles:** fuzzy search, inline autocomplete, show hidden cards, phenomenon animation, risky hellriding, smooth travel, BEM edge placeholders
- URL parameters encode search/filter/view state for shareable links

## Build and Data Generation

There is **no build step** for the website. To regenerate `cards.json` after adding or removing card images:

```bash
npm run generate
# or: node scripts/generate-cards.js
```

- Requires Node.js (any recent LTS, e.g., v18+). No `npm install` needed for data scripts.
- Scans `cards/images/` (flat directory) for `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif` files.
- Preserves existing tags from `cards.json` and merges in auto-inferred type tags (`Plane`, `Phenomenon`).
- Refuses to overwrite `cards.json` if no valid images found (exits with code 1).

To sync the per-card JSON files in `cards/` from `cards.json`:

```bash
npm run sync
# or: node scripts/sync-cards.js
```

- Writes `cards/<kebab-case-name>.json` for each card.
- Removes stale files in `cards/` with no corresponding entry in `cards.json`.

## Linting

ESLint is configured in `eslint.config.js`. To run:

```bash
npm install   # installs eslint (only needed once)
npm run lint
```

ESLint checks for unused variables, undefined references, `no-var`, `prefer-const`, and `eqeqeq`. Ignores `node_modules/`, `cards/`, `images/`, `transcripts/`, and `MSE/`.

## Testing

Three Node.js test scripts exist in `scripts/` (no `npm install` needed):

```bash
npm test           # runs scripts/smoke-test.js (integration: cards.json, file existence, DOM contracts)
npm run test:codec # runs scripts/test-codec.js (unit: deck codec encoding/decoding)
npm run test:utils # runs scripts/test-utils.js (unit: search parsing, card matching)
npm run test:unit  # runs test:codec + test:utils
```

**Always run `npm test` and `npm run test:unit` after making changes** to verify nothing is broken. The CI `smoke-tests.yml` workflow runs `npm test` on every PR and push to `main`.

## GitHub Actions Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `smoke-tests.yml` | PR and push to `main` | Runs `node scripts/smoke-test.js` to verify cards.json, required files, and DOM contracts |
| `generate-cards.yml` | Push to `main` touching `cards/images/**` or `scripts/generate-cards.js` | Runs `generate-cards.js`, commits updated `cards.json` if changed |
| `sync-cards.yml` | Push to `main` touching `cards.json` or `scripts/sync-cards.js` | Runs `sync-cards.js`, commits updated `cards/*.json` files if changed |
| `cache-bust.yml` | Push to `main` (non-`.github/**` files) | Updates `CACHE_VERSION` in `sw.js` to the short commit SHA, commits with `[skip ci]` |
| `release.yml` | GitHub Release published | Updates `version.json` with the new version string, commits to `main` |
| `update-readme-badges.yml` | Varies | Updates card count and other badges in `README.md` |

All auto-commit workflows check whether output actually changed before committing (no empty commits).

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
- **Filenames:** Kebab-case for JS/CSS source files; card images use `Plane_CardName.png` / `Phenomenon_CardName.png` convention
- No comments should be added unless they match the style of existing comments in the same file

## Validation Checklist

After making changes:

1. **Run tests:** `npm test && npm run test:unit` — all must pass
2. **Run linter:** `npm run lint` (after `npm install`) — fix any errors
3. **Run data scripts** if card images changed: `npm run generate && npm run sync`
4. **Serve locally** with `python3 -m http.server 8080` and open `http://localhost:8080`
5. **Check browser console** for JavaScript errors
6. **Manually verify** affected features:
   - **Gallery:** search, tag filtering, view mode switching, pagination, modal open/close, transcript display
   - **Theme:** palette cycling (alt-click), mode cycling (click), persistence across page reload
   - **Deck builder:** add/remove cards, save/load deck slots, import/export
   - **Game modes:** Classic and BEM game start, planeswalking, die roll, undo, keyboard shortcuts
   - **Profile seeds:** export seed, reload page, import seed, verify state restored

**Trust these instructions.** Only search or explore further if you find them incomplete or incorrect.
