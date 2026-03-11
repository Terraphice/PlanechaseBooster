<div align="center">

<img src="images/assets/social-preview.jpg" alt="Planar Atlas, a feature-complete Planechase tool" width="100%" style="border-radius:12px;" />

# Planar Atlas

**A feature-complete Planechase tool for Magic: The Gathering.**

Browse a fully searchable gallery of every plane and phenomenon, build and share custom decks, and simulate entire Planechase games, all in a single installable web app with no accounts and no servers.

[![Live Site](https://img.shields.io/badge/Live_Site-planechase.terraphice.dev-6366f1?style=for-the-badge&logo=firefox&logoColor=white)](https://planechase.terraphice.dev)
[![PWA](https://img.shields.io/badge/PWA-Installable_&_Offline-22c55e?style=for-the-badge&logo=pwa&logoColor=white)](https://planechase.terraphice.dev)
[![No Build](https://img.shields.io/badge/No_Build_Step-Vanilla_JS-3b82f6?style=for-the-badge)](https://github.com/Terraphice/PlanarAtlas)

</div>

---

## Overview

Planar Atlas started as a personal tool and grew into the most comprehensive Planechase companion available. Every card is rendered at full resolution with searchable transcripts, tagged by set and world, and ready to drop into a custom deck. The simulator handles the full game loop for both variants of Planechase, from the initial planeswalk through phenomena resolution and die rolls, with an undo stack so no accident is permanent.

There is no backend, no login, and nothing to install. The entire application is a static web page that caches itself for offline use the first time it loads.

---

## Features

| Feature | Details |
|---|---|
| **Gallery** | Grid, Singleton, Stack, and List views with paginated or infinite-scroll browsing |
| **Search** | Full search syntax: keywords, tags, card types, oracle text, regex, and fuzzy matching |
| **Deck Builder** | Multiple named deck slots, per-slot import and export, and drag-free card management |
| **Classic Planechase** | Shared-deck game mode with planeswalking, phenomena resolution, and the planar die |
| **Blind Eternities Map** | Each player controls their own deck of planes laid out as an explorable map |
| **Profile Seeds** | Export your entire setup (all preferences and every deck) as a single shareable string |
| **Undo History** | Reverse up to 20 game actions from the Tools menu: planeswalks, die rolls, card moves |
| **Keyboard Play** | Full keyboard control so you never have to reach for the mouse mid-game |
| **Themes** | 8 colour palettes and 3 brightness modes, persisted across sessions |
| **Offline / PWA** | Installs like a native app and works without an internet connection after first load |
| **Onboarding** | First-run tutorial for both game modes so new players can jump straight in |

---

## Gallery

The gallery is the heart of Planar Atlas. Every card in the library is available at full resolution, each with a readable transcript loaded on demand. Cards are tagged by set, world, and content type, and the tag system powers every filtering and grouping feature.

### View Modes

| Mode | Description |
|---|---|
| **Grid** | Compact thumbnail grid, ideal for browsing or picking cards for a deck |
| **Singleton** | One card fills the viewport for a focused reading experience |
| **Stack** | Overlapping fan of cards, mirroring the physical Planechase aesthetic |
| **List** | Condensed rows with badges, tags, and metadata visible at a glance |

### Filtering and Grouping

Cards can be filtered by any combination of search terms and toggled options. The group-by feature organises the gallery into collapsible sections by any tag value, useful for browsing by world, by set, or by card type.

Pagination modes include **paginated** browsing (10, 20, 50, or 100 cards per page) and **infinite scroll**.

---

## Search Syntax

The search bar supports a rich query language for precise filtering.

| Syntax | Matches |
|---|---|
| `mishra` | Cards with that text anywhere in the name (fuzzy when fuzzy mode is on) |
| `name:workshop` | Cards whose display name contains the given word |
| `tag:Plane` | Cards tagged with the given value |
| `type:Phenomenon` | Cards of type Phenomenon |
| `oracle:whenever` | Cards whose transcript contains "whenever" |
| `"exact phrase"` | Cards containing the exact quoted phrase |
| `/expr[ae]ss/` | Cards matching the given regular expression |
| `-tag:hidden` | Negate any term with a leading `-` |

Multiple terms are combined with an implicit AND. Fuzzy matching uses Levenshtein distance and can be toggled on or off per session.

An inline autocomplete ghost suggests tag completions as you type. Press `Tab` to accept or use the arrow keys to navigate the suggestion list.

---

## Deck Builder

The deck builder supports multiple named deck slots saved to your browser's local storage. Cards can be added from the gallery or from within a game session. Each deck slot supports:

- **Rename and reorder**: give every deck a meaningful name
- **Import / Export**: copy a deck as a plain text list or paste one in
- **Per-deck validation**: minimum and maximum card counts are enforced before a game can start
- **Sharing via seeds**: include all decks in a profile seed for portable sharing

---

## Planechase Simulator

### Classic Mode

The traditional shared-deck format. All players draw from a single combined planar deck. Planar Atlas handles:

- Shuffling and drawing the opening plane
- Resolving phenomena automatically when they surface
- Rolling the planar die with animated feedback
- Tracking the current plane and the planes that have passed
- Undo for every game action up to 20 steps back

### Blind Eternities Map

Each player manages their own private planar deck arranged as an interconnected map. Planes are revealed as players move between adjacent nodes. Planar Atlas renders the full map layout, tracks each player's position, and resolves phenomena mid-travel.

---

## Keyboard Shortcuts

The full game loop is playable without a mouse.

| Key | Action |
|---|---|
| `Space` | Roll the planar die |
| `Enter` | Planeswalk to the next plane |
| `I` | Inspect the current card in detail |
| `T` | Toggle the Tools menu |
| `Escape` | Close any open panel or overlay |

---

## Theme System

Click the theme button in the top bar to cycle through three brightness modes: **System** (follows OS preference), **Dark**, and **Light**. Alt-click to cycle through the eight available colour palettes.

| Palette | Inspiration |
|---|---|
| `standard` | Planar Atlas default, deep navy with blue accents |
| `gruvbox` | Warm retro tones from the Gruvbox colour scheme |
| `atom` | Cool-grey inspired by the Atom editor |
| `dracula` | Vivid purple and pink from the Dracula palette |
| `solarized` | Muted, low-contrast tones from Solarized |
| `nord` | Icy blue-grey from the Nord palette |
| `catppuccin` | Soft pastel mocha from Catppuccin |
| `scryfall` | Familiar warm-ivory tones echoing Scryfall's UI |

All palettes support both dark and light variants. Preferences persist across sessions via `localStorage`.

---

## Card Library

The library covers both official Wizards of the Coast Planechase releases and curated community custom content, and is actively growing. Each card is badged **Official** or **Custom** in the gallery for clarity.

Every card includes a high-resolution image and a plain-text transcript. Transcripts are loaded asynchronously in the card detail modal and are also indexed by the `oracle:` search operator.

---

## Profile Seeds

A profile seed is a compact encoded string that captures your entire Planar Atlas state: all preferences, all deck slots and their contents, and your current theme. Share a seed with another player and they can import it to get an identical setup in seconds, no account or file transfer needed.

Seeds are generated and imported from the Settings panel inside the deck builder.

---

## Running Locally

No build step is required. Serve the repository root over HTTP and open it in a browser. The app uses ES6 modules and `fetch()`, so it must be served over HTTP rather than opened as a local file.

```bash
# Python (no install required)
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Any static file server works: `npx serve`, VS Code Live Server, Caddy, nginx, or whatever is convenient.

### Regenerating Card Data

If you add or remove card images, regenerate `cards.json` and the per-card files:

```bash
node generate-cards.js   # rebuild cards.json from images/cards/
node sync-cards.js       # sync cards/ JSON files from cards.json
```

Both scripts run automatically via GitHub Actions when changes to `images/cards/` or `cards.json` are pushed to `main`.

---

## Architecture

Planar Atlas is a vanilla JavaScript single-page application with no framework, no bundler, and no runtime dependencies beyond a few CDN-loaded libraries.

| Module | Purpose |
|---|---|
| `gallery.js` | Application entry point: fetches card data, wires DOM events, and delegates to all other modules |
| `gallery-render.js` | Card rendering in all view modes, pagination, and tag-based grouping |
| `gallery-search.js` | Search input, suggestion list, keyboard navigation, and ghost-text autocomplete |
| `gallery-modal.js` | Card detail modal: navigation, transcript loading, and phenomenon flip animation |
| `gallery-state.js` | Shared state objects for preferences, filters, display, and pagination |
| `gallery-utils.js` | Stateless helpers: search parsing, fuzzy matching, card enrichment, URL state |
| `gallery-ui.js` | Theme controller (palettes and modes) and toast notification manager |
| `deck.js` | Deck builder, game state machine for both game modes, profile seed encoding, undo history |
| `game-classic.js` | Rendering layer for the Classic shared-deck game mode |
| `game-bem.js` | Rendering layer for the Blind Eternities Map game mode |
| `sw.js` | Service worker: caches all modules, card images, and CDN assets for offline use |
| `generate-cards.js` | Node.js script to regenerate `cards.json` from the images directory |
| `sync-cards.js` | Node.js script to sync per-card JSON files in `cards/` from `cards.json` |

CDN runtime dependencies: [marked.js](https://marked.js.org/) (Markdown rendering), [DOMPurify](https://github.com/cure53/DOMPurify) (HTML sanitisation), [mana-font](https://mana.andrewgioia.com/) (MTG symbol font).

---

## Contributing

Contributions are welcome. The easiest way to contribute is to add card images or transcripts for planes and phenomena that are missing from the library. See the existing files in `images/cards/` and `transcripts/cards/complete/` for the expected formats and naming conventions.

For code contributions, open an issue first to discuss the change, then submit a pull request. There are no automated tests, so manual verification against the checklist in the repository is expected.

---

## Disclaimer

Planar Atlas is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Wizards of the Coast. Magic: The Gathering, Planechase, and all associated card names and artwork are property of Wizards of the Coast LLC. Custom card images created by the community are the property of their respective creators.
