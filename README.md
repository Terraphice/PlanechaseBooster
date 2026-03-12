<div align="center">

<img src="assets/social-preview.jpg" alt="Planar Atlas, a feature-complete Planechase tool" width="100%" style="border-radius:12px;" />

# Planar Atlas

**A feature-complete Planechase tool for Magic: The Gathering**

Browse a fully searchable gallery of every plane and phenomenon, build and share custom decks, and simulate entire Planechase games, all in a single installable web app with no accounts and no servers.

[![Live Site](https://img.shields.io/badge/Live_Site-planechase.terraphice.dev-6366f1?style=for-the-badge&logo=firefox&logoColor=white)](https://planechase.terraphice.dev)
[![PWA](https://img.shields.io/badge/PWA-Installable_&_Offline-22c55e?style=for-the-badge&logo=pwa&logoColor=white)](https://planechase.terraphice.dev)
[![No Build](https://img.shields.io/badge/No_Build_Step-Vanilla_JS-3b82f6?style=for-the-badge)](https://github.com/Terraphice/PlanarAtlas)

[![Total Cards](https://img.shields.io/badge/Total_Cards-230-6366f1?style=for-the-badge)](https://planechase.terraphice.dev)
[![Official Cards](https://img.shields.io/badge/Official_Cards-206-22c55e?style=for-the-badge)](https://planechase.terraphice.dev)
[![Custom Cards](https://img.shields.io/badge/Custom_Cards-24-f59e0b?style=for-the-badge)](https://planechase.terraphice.dev)

</div>

---

## Overview

Planar Atlas started as a personal tool and grew into the most comprehensive Planechase companion available. Every card is rendered at full resolution with searchable transcripts, tagged by set and world, and ready to drop into a custom deck. The simulator handles the full game loop for both variants of Planechase, from the initial planeswalk through phenomena resolution and die rolls, with an undo stack so no accident is permanent.

There is no backend, no login, and nothing to install. The entire application is a static web page that caches itself for offline use the first time it loads.

---

## Features

| Feature | Details |
|---|---|
| **Gallery** | Grid, Singleton, Stack, and List views with paginated or infinite-scroll browsing. |
| **Search** | Full search syntax: keywords, tags, card types, oracle text, regex, and fuzzy matching. |
| **Deck Builder** | Multiple named deck slots, per-slot import and export, and drag-free card management. |
| **Classic Planechase** | Shared-deck game mode with planeswalking, phenomena resolution, and the planar die. |
| **Blind Eternities Map** | Shared-deck laid out as an explorable map, with risky hell-riding to unknown planes. |
| **Profile Seeds** | Export your entire setup (all preferences and every deck) as a single shareable string, or share decks individually. |
| **Undo History** | Reverse (and un-reverse!) up to 20 game actions from the Tools menu: Planeswalks, die rolls, card moves, etc. |
| **Keyboard Play** | Full keyboard control so you never have to reach for the mouse mid-game! |
| **Themes** | 8+ familiar color palette selections, applied consistently across the entire site. |
| **Offline / PWA** | Installs like a native app and works without an internet connection after first load! |
| **Onboarding** | First-run tutorial for both game modes so new players can jump straight in. |

---

## Gallery

The gallery is the heart of Planar Atlas. Every card in the library is available at full resolution, each with a readable transcript loaded on demand. Cards are tagged by set, world, content type, etc., and the tag system powers every filtering and grouping feature.

### View Modes

| Mode | Description |
|---|---|
| **Grid** | Compact thumbnail grid, ideal for browsing or picking cards for a deck. |
| **Singleton** | One card fills the viewport for a focused reading experience. |
| **Stack** | Overlapping fan of cards, providing a more compact aesthetic. |
| **List** | Condensed rows with badges, tags, and metadata visible at a glance. Geek view. |

### Filtering and Grouping

Cards can be filtered by any combination of search terms and toggled options. The group-by feature organises the gallery into collapsible sections by any tag value, useful for browsing by world, by set, or by card type.

Pagination modes include **paginated** browsing (10, 20, 50, or 100 cards per page) and **infinite scroll** with lazy loading and navigation buttons.

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

Multiple terms are combined with an implicit AND. Fuzzy matching uses Levenshtein distance and can be toggled on or off in preferences.

A toggleable inline autocomplete ghost suggests completions as you type. Press `Tab` to accept or use the arrow keys to navigate the suggestion list.

---

## Deck Builder

The deck builder supports multiple named deck slots saved to your browser's local storage. Cards can be added from the gallery or from within a game session. Each deck slot supports:

- **Rename and reorder**: Give each deck a meaningful name, for easier and better organization.
- **Import / Export**: Copy a deck as a plain text list or paste one in.
- **Sharing via seeds**: All decks generate a seed for portable sharing.

---

## Planechase Simulator

### Classic Mode

The traditional shared-deck format. All players share a single combined planar deck. 



### Blind Eternities Map

A shared planar deck is used to build an interconnected map. Planes are revealed as players move between adjacent nodes. Planar Atlas renders the full map layout, tracks the active position, and handles encountering phenomena mid-travel. Risk-takers may opt. to "hellride" to unknown (diagonal) face-down cards, which may come with risk of a phenomena encounter. (Risky-hellriding is a toggle-able 66.6% chance to encounter a phenomenon when hellriding, for a more interesting and impactful game.)

Planar Atlas handles:

- Shuffling and activating the opening plane.
- Encountering phenomena automatically when they surface.
- Rolling the planar die with cost, and animations.
- Tracking planes, the planar deck, etc.
- Multiple active planes and phenomenon at once, simultaneous planeswalking.
- Searching the planar library, revealing cards from the top/bottom, etc. all with multiple view styles.
- Detailed views & transcripts for each card, including cards not in play.
- Undo for every game action up to 20 steps back, and redo for undone actions.
- Shuffle, exile, place on top/bottom, etc. support for almost all cards in play/in the library.
- Planeswalking mode: Moving between planes, highlighting available choices, hellriding, and more. 
- More that I can't remember off the top of my head! Explore for yourself!

---

## Keyboard Shortcuts

The full game loop is playable without a mouse.

| Key | Action |
|---|---|
| `Space` | Roll the planar die |
| `Enter` | Planeswalk to the next plane, or enter Planeswalking mode/confirm selection |
| `I` | Inspect the current card in detailed view |
| `T` | Toggle the Tools menu |
| `Z` | Undo last game action |
| `R` | Redo next game action |
| `Escape` | Close any open panel or overlay |

---

## Theme System

Click the theme button in the top bar to cycle through three brightness modes: **System** (follows OS preference), **Dark**, and **Light**. Alt-click to cycle through the eight available colour palettes. (Long-press on mobile!)

| Palette | Inspiration |
|---|---|
| `standard` | Planar Atlas default, deep navy with blue accents |
| `gruvbox` | Warm retro tones from the Gruvbox colour scheme |
| `atom` | Cool-grey inspired by the Atom editor |
| `dracula` | Vivid purple and pink from the Dracula palette |
| `solarized` | Muted, low-contrast tones from Solarized |
| `nord` | Icy blue-grey from the Nord palette |
| `catppuccin` | Soft pastel mocha from Catppuccin |
| `scryfall` [WIP] | Familiar purple & blue tones echoing Scryfall's UI |

All palettes support both dark and light variants. Preferences persist across sessions via `localStorage`.

---

## Card Library

The library covers both official Wizards of the Coast Planechase releases and curated community custom content, and is actively growing. Each card is badged **Official** or **Custom** in the gallery for clarity.

Every card includes a high-resolution image and a plain-text transcript, as well as more efficient thumbnail images. Transcripts are loaded asynchronously in the card detail modal and are also indexed by the `oracle:` search operator.

---

## Profile Seeds

A profile seed is a compact encoded string that captures your entire Planar Atlas state: all preferences, all deck slots and their contents, and your current theme. Share a seed with another player and they can import it to get an identical setup in seconds, no account or file transfer needed.
(This was my solution to an account system, without requiring an account back-end. I am honestly a little sorry in advance if it feels clunky at first.)

Seeds are generated and imported inside the Settings panel, at the bottom, as well as within the deck-builder.

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

Contributions are welcome. The easiest way to contribute is to add card images or transcripts for planes and phenomena that are missing from the library. See the existing files in `cards/images/` and `cards/transcripts/` for the expected formats and naming conventions.

I'm honestly choosy about which custom cards are welcome in the library, for now. Please understand that any denied PR/contribution of custom cards
isn't so much an attack on the quality or design, but more so a desire to reduce duplicate/excessive design, or maintain game scope.

For code contributions, open an issue first to discuss the change, then submit a pull request. There are no automated tests, so manual verification against the checklist in the repository is expected.

---

## Disclaimer

Planar Atlas is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Wizards of the Coast. Magic: The Gathering, Planechase, and all associated card names and artwork are property of Wizards of the Coast LLC. Custom card images created by the community are the property of their respective creators. Please don't sue me, I'm broke.
