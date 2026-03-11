import { escapeHtml, shuffleArray, isHiddenCard } from "./gallery-utils.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const DECK_STORAGE_KEY = "planar-atlas-decks-v2";
const DECK_NAMES_KEY = "planar-atlas-deck-names-v1";
const DECK_INIT_FLAG_KEY = "planar-atlas-deck-init-v1";
const TUTORIAL_CLASSIC_KEY = "planar-atlas-tutorial-classic-v1";
const TUTORIAL_BEM_KEY = "planar-atlas-tutorial-bem-v1";
const NUM_DECK_SLOTS = 10;
const MAX_CARD_COUNT = 9;

// ── Module state ──────────────────────────────────────────────────────────────

let allCards = [];
let allDecks = Array.from({ length: NUM_DECK_SLOTS }, () => new Map());
let deckNames = Array.from({ length: NUM_DECK_SLOTS }, (_, i) => i === 0 ? "Default Official Deck" : `Deck ${i + 1}`);
let currentSlot = 0;
let deckPanelOpen = false;
let deckPanelShelved = false;
let gameActive = false;
let gameState = null;
let showToastFn = null;
let onDeckChangeFn = null;
let revealedCards = [];
let revealViewMode = "list";
let easyPlaneswalk = false;
let readerCardPath = "";
let bemPlaneswalkPending = false;
let bemDragPointerId = null;
let bemDragStart = null;
let bemDragHandled = false;
let pendingGameMode = null;
const readerTranscriptCache = new Map();

// ── BEM (Blind Eternities Map) constants ──────────────────────────────────────

const BEM_VIEW_RADIUS = 1;   // cells visible each side of player (3×3 grid)
const BEM_FALLOFF_DIST = 3;  // Chebyshev distance before card falls off deck
const BEM_FACEDOWN_IMG = "images/assets/card-preview.jpg";
const BEM_DRAG_THRESHOLD = 44; // px drag needed to trigger navigation

function deckCards() {
  return allDecks[currentSlot];
}

function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches;
}

// ── DOM references ────────────────────────────────────────────────────────────

const deckPanel = document.getElementById("deck-panel");
const deckCardList = document.getElementById("deck-card-list");
const deckTotalEl = document.getElementById("deck-total-count");
const deckPlayBtn = document.getElementById("deck-play-btn");
const deckImportBtn = document.getElementById("deck-import-btn");
const deckExportBtn = document.getElementById("deck-export-btn");
const deckLinkBtn = document.getElementById("deck-link-btn");
const deckClearBtn = document.getElementById("deck-clear-btn");
const deckCloseBtn = document.getElementById("deck-close-btn");
const deckButton = document.getElementById("deck-button");
const deckButtonBadge = document.getElementById("deck-button-badge");
const deckAutoimportBtn = document.getElementById("deck-autoimport-btn");
const deckAutoimportMenu = document.getElementById("deck-autoimport-menu");
const deckAutoimportTagList = document.getElementById("deck-autoimport-tag-list");
const deckSlotSelect = document.getElementById("deck-slot-select");
const deckSlotNameInput = document.getElementById("deck-slot-name-input");
const deckPanelLip = document.getElementById("deck-panel-lip");
const modalAddToDeckBtn = document.getElementById("modal-add-to-deck");
const modalDeckQty = document.getElementById("modal-deck-qty");
const modalDeckDec = document.getElementById("modal-deck-dec");
const modalDeckInc = document.getElementById("modal-deck-inc");
const modalDeckCount = document.getElementById("modal-deck-count");

const gameView = document.getElementById("game-view");
const gameCardImageBtn = document.getElementById("game-card-image-btn");
const gameCardImage = document.getElementById("game-card-image");
const gameSidePanel = document.getElementById("game-side-panel");
const gameBtnTl = document.getElementById("game-btn-tl");
const gameBtnTr = document.getElementById("game-btn-tr");
const gameBtnBl = document.getElementById("game-btn-bl");
const gameBtnBr = document.getElementById("game-btn-br");
const gameDieIcon = document.getElementById("game-die-icon");
const gameToolsMenu = document.getElementById("game-tools-menu");
const gameOptionsMenu = document.getElementById("game-options-menu");
const gameToolsShuffle = document.getElementById("game-tools-shuffle");
const gameToolsAddTop = document.getElementById("game-tools-add-top");
const gameToolsAddBottom = document.getElementById("game-tools-add-bottom");
const gameToolsReturnTop = document.getElementById("game-tools-return-top");
const gameToolsReturnBottom = document.getElementById("game-tools-return-bottom");
const gameToolsSearchInput = document.getElementById("game-tools-search-input");
const gameToolsSearchResults = document.getElementById("game-tools-search-results");
const gameLibraryViewList = document.getElementById("game-library-view-list");
const gameMenuSearchSection = document.getElementById("game-menu-search-section");
const gameLibraryToggle = document.getElementById("game-tools-library-toggle");
const gameOptExit = document.getElementById("game-opt-exit");
const gameOptReset = document.getElementById("game-opt-reset");
const gameOptDeckBuilder = document.getElementById("game-opt-deck-builder");
const gameCostValue = document.getElementById("game-cost-value");
const gameCostDisplay = document.getElementById("game-cost-display");
const gameCostReset = document.getElementById("game-cost-reset");
const gameReaderView = document.getElementById("game-reader-view");
const gameReaderImage = document.getElementById("game-reader-image");
const gameReaderImageWrap = document.getElementById("game-reader-image-wrap");
const gameReaderZoomOverlay = document.getElementById("game-reader-zoom-overlay");
const gameReaderZoomImg = document.getElementById("game-reader-zoom-img");
const gameReaderClose = document.getElementById("game-reader-close");
const gameReaderBackdrop = document.getElementById("game-reader-backdrop");
const gameReaderCardName = document.getElementById("game-reader-card-name");
const gameReaderCardType = document.getElementById("game-reader-card-type");
const gameReaderTranscript = document.getElementById("game-reader-transcript");
const gameReaderActions = document.getElementById("game-reader-actions");
const gameEasyPlaneswalkToggle = document.getElementById("game-easy-planeswalk-toggle");
const gameOptSaveState = document.getElementById("game-opt-save-state");
const gameOptLoadState = document.getElementById("game-opt-load-state");
const gameOptStateLink = document.getElementById("game-opt-state-link");

const gameToolsRevealToggle = document.getElementById("game-tools-reveal-toggle");
const gameRevealInputRow = document.getElementById("game-reveal-input-row");
const gameRevealCountInput = document.getElementById("game-reveal-count-input");
const gameRevealGoBtn = document.getElementById("game-reveal-go-btn");
const gameRevealOverlay = document.getElementById("game-reveal-overlay");
const gameRevealBackdrop = document.getElementById("game-reveal-backdrop");
const gameRevealCardsContainer = document.getElementById("game-reveal-cards-container");
const gameRevealClose = document.getElementById("game-reveal-close");
const gameRevealTitleCount = document.getElementById("game-reveal-title-count");
const gameRevealShuffleIn = document.getElementById("game-reveal-shuffle-in");
const gameRevealTopAll = document.getElementById("game-reveal-top-all");
const gameRevealBottomAll = document.getElementById("game-reveal-bottom-all");
const gameRevealExileAll = document.getElementById("game-reveal-exile-all");
const gameRevealListBtn = document.getElementById("game-reveal-list-btn");
const gameRevealGalleryBtn = document.getElementById("game-reveal-gallery-btn");

const gameModeDialog = document.getElementById("game-mode-dialog");
const gameModeDialogBackdrop = document.getElementById("game-mode-dialog-backdrop");
const gameModeClassicBtn = document.getElementById("game-mode-classic-btn");
const gameModeBemBtn = document.getElementById("game-mode-bem-btn");
const gameModeDialogCancel = document.getElementById("game-mode-dialog-cancel");

const bemMapArea = document.getElementById("bem-map-area");
const bemMapEl = document.getElementById("bem-map");
const bemViewCardBtn = document.getElementById("bem-view-card-btn");
const bemCardNameLabel = document.getElementById("bem-card-name");
const bemStatusLabel = document.getElementById("bem-status-label");
const classicViewCardBtn = document.getElementById("classic-view-card-btn");
const classicCardNameLabel = document.getElementById("classic-card-name-label");
const classicLibraryLabel = document.getElementById("classic-library-label");

const gameTutorialOverlay = document.getElementById("game-tutorial-overlay");
const gameTutorialTitle = document.getElementById("game-tutorial-title");
const gameTutorialBody = document.getElementById("game-tutorial-body");
const gameTutorialClose = document.getElementById("game-tutorial-close");

// ── Initialization ────────────────────────────────────────────────────────────

export function initDeck({ cards, showToast, onDeckChange }) {
  allCards = cards;
  showToastFn = showToast;
  onDeckChangeFn = onDeckChange;

  const stored = loadDecksFromStorage();
  allDecks = stored.decks;
  currentSlot = stored.slot;
  deckNames = stored.names;

  maybeAutoPopulateFirstSlot();

  const urlParams = new URLSearchParams(window.location.search);
  const seedParam = urlParams.get("deck");
  if (seedParam) {
    const decoded = decodeDeck(seedParam);
    if (decoded.size > 0) {
      const valid = filterValidDeck(decoded);
      if (valid.size > 0) {
        allDecks[currentSlot] = valid;
        saveDecksToStorage();
        const newParams = new URLSearchParams(urlParams);
        newParams.delete("deck");
        const query = newParams.toString();
        history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
        showToastFn?.("Deck imported from link.");
      }
    }
  }

  bindDeckEvents();
  renderDeckSlotDropdown();
  updateDeckButton();

  const gameParam = urlParams.get("game");
  if (gameParam) {
    const decoded = decodeGameState(gameParam);
    if (decoded) {
      const newParams = new URLSearchParams(urlParams);
      newParams.delete("game");
      const query = newParams.toString();
      history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}#play`);
      startGameFromState(decoded);
      showToastFn?.("Game state restored from link.");
      return;
    }
  }

  if (window.location.hash === "#play") {
    if (getDeckTotal() > 0) {
      startGame();
    } else {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }
}

// ── Deck slot management ──────────────────────────────────────────────────────

function renderDeckSlotDropdown({ updateNameInput = true } = {}) {
  if (!deckSlotSelect) return;
  deckSlotSelect.innerHTML = "";
  for (let i = 0; i < NUM_DECK_SLOTS; i++) {
    const total = [...allDecks[i].values()].reduce((a, b) => a + b, 0);
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.selected = i === currentSlot;
    opt.textContent = `${deckNames[i]}${total > 0 ? ` (${total})` : ""}`;
    deckSlotSelect.appendChild(opt);
  }
  if (updateNameInput && deckSlotNameInput) {
    deckSlotNameInput.value = deckNames[currentSlot];
  }
}

function switchDeckSlot(slot) {
  if (slot === currentSlot) return;
  currentSlot = slot;
  saveDecksToStorage();
  renderDeckSlotDropdown();
  updateDeckButton();
  if (deckPanelOpen) renderDeckList();
  updateAllCardOverlays();
}

// ── Auto-populate first slot ──────────────────────────────────────────────────

function maybeAutoPopulateFirstSlot() {
  try {
    if (localStorage.getItem(DECK_INIT_FLAG_KEY)) return;
    localStorage.setItem(DECK_INIT_FLAG_KEY, "1");
  } catch {
    return;
  }
  if (allDecks[0].size > 0) return;
  let count = 0;
  for (const card of allCards) {
    if (!isHiddenCard(card.normalizedTags) && card.normalizedTags.some((t) => t.includes("official"))) {
      allDecks[0].set(card.key, 1);
      count++;
    }
  }
  if (count > 0) saveDecksToStorage();
}

// ── Auto-import ───────────────────────────────────────────────────────────────

function buildAutoimportTagList() {
  if (!deckAutoimportTagList) return;
  deckAutoimportTagList.innerHTML = "";
  const allTags = [...new Set(allCards.flatMap((c) => c.tags))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  for (const tag of allTags) {
    if (tag.toLowerCase() === "hidden" || tag.startsWith("badge:") || tag.startsWith(":top:badge:")) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "deck-autoimport-tag-item";
    btn.textContent = tag;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      autoImportCards(tag);
      deckAutoimportMenu?.classList.add("hidden");
    });
    deckAutoimportTagList.appendChild(btn);
  }
}

function autoImportCards(filter) {
  const deck = deckCards();
  let count = 0;
  for (const card of allCards) {
    if (isHiddenCard(card.normalizedTags)) continue;
    let match = false;
    switch (filter) {
      case "official":
        match = card.normalizedTags.some((t) => t.includes("official"));
        break;
      case "custom":
        match = card.normalizedTags.some((t) => t.includes("custom"));
        break;
      case "planes":
        match = card.type === "Plane";
        break;
      case "phenomena":
        match = card.type === "Phenomenon";
        break;
      default:
        match = card.normalizedTags.includes(filter.toLowerCase());
    }
    if (match && !deck.has(card.key)) {
      deck.set(card.key, 1);
      count++;
    }
  }
  saveDecksToStorage();
  updateDeckButton();
  renderDeckList();
  updateAllCardOverlays();
  renderDeckSlotDropdown();
  showToastFn?.(count > 0 ? `Added ${count} card${count !== 1 ? "s" : ""} to deck.` : "No new cards to add.");
}

// ── Events ────────────────────────────────────────────────────────────────────

function bindDeckEvents() {
  deckButton?.addEventListener("click", toggleDeckPanel);
  deckCloseBtn?.addEventListener("click", closeDeckPanel);
  deckPlayBtn?.addEventListener("click", showGameModeDialog);
  deckClearBtn?.addEventListener("click", clearDeck);
  deckExportBtn?.addEventListener("click", exportDeckSeed);
  deckImportBtn?.addEventListener("click", importDeckPrompt);
  deckLinkBtn?.addEventListener("click", shareDeckLink);

  deckSlotSelect?.addEventListener("change", () => {
    const slot = parseInt(deckSlotSelect.value, 10);
    if (!isNaN(slot)) switchDeckSlot(slot);
  });

  deckSlotNameInput?.addEventListener("input", () => {
    const rawValue = deckSlotNameInput.value;
    deckNames[currentSlot] = rawValue.trim() || `Deck ${currentSlot + 1}`;
    saveDeckNamesToStorage();
    const savedValue = rawValue;
    renderDeckSlotDropdown({ updateNameInput: false });
    if (deckSlotNameInput) deckSlotNameInput.value = savedValue;
  });

  deckSlotNameInput?.addEventListener("blur", () => {
    if (deckSlotNameInput && !deckSlotNameInput.value.trim()) {
      deckNames[currentSlot] = `Deck ${currentSlot + 1}`;
      saveDeckNamesToStorage();
      renderDeckSlotDropdown();
    }
  });

  deckPanelLip?.addEventListener("click", () => {
    if (deckPanelShelved) {
      unshelvePanel();
    } else {
      shelvePanel();
    }
  });

  deckAutoimportBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    const hidden = deckAutoimportMenu?.classList.contains("hidden");
    if (hidden) {
      buildAutoimportTagList();
      deckAutoimportMenu?.classList.remove("hidden");
    } else {
      deckAutoimportMenu?.classList.add("hidden");
    }
  });

  deckAutoimportMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
    const item = event.target.closest(".deck-autoimport-item[data-action]");
    if (!item) return;
    autoImportCards(item.dataset.action);
    deckAutoimportMenu?.classList.add("hidden");
  });

  const tagToggle = deckAutoimportMenu?.querySelector(".deck-autoimport-tag-toggle");
  tagToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    deckAutoimportTagList?.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    deckAutoimportMenu?.classList.add("hidden");
  });

  modalAddToDeckBtn?.addEventListener("click", () => {
    const cardKey = modalAddToDeckBtn.dataset.cardKey;
    if (!cardKey) return;
    const count = deckCards().get(cardKey) || 0;
    if (count === 0) addCardToDeck(cardKey);
  });

  modalDeckDec?.addEventListener("click", () => {
    const cardKey = modalAddToDeckBtn?.dataset.cardKey;
    if (cardKey) removeCardFromDeck(cardKey);
  });

  modalDeckInc?.addEventListener("click", () => {
    const cardKey = modalAddToDeckBtn?.dataset.cardKey;
    if (cardKey) addCardToDeck(cardKey);
  });

  gameBtnTr?.addEventListener("click", () => {
    if (gameState?.mode === "bem") {
      const cell = gameState.bemGrid?.get(bemKey(gameState.bemPos.x, gameState.bemPos.y));
      if (cell?.card?.type === "Phenomenon") {
        bemResolvePhenomenon();
      } else {
        toggleBemPlaneswalkMode();
      }
    } else {
      gamePlaneswalk();
    }
  });
  gameBtnTl?.addEventListener("click", gameRollDie);
  gameBtnBr?.addEventListener("click", toggleGameToolsMenu);
  gameBtnBl?.addEventListener("click", toggleGameOptionsMenu);

  gameToolsShuffle?.addEventListener("click", () => {
    if (!gameState) return;
    gameState.remaining = shuffleArray(gameState.remaining);
    showToastFn?.("Remaining library shuffled.");
    if (!gameMenuSearchSection?.classList.contains("hidden")) renderGameLibraryView();
  });

  gameToolsAddTop?.addEventListener("click", () => {
    if (!gameState || gameState.remaining.length === 0) {
      showToastFn?.("No cards remaining in the library.");
      return;
    }
    const top = gameState.remaining.shift();
    gameState.activePlanes.push(top);
    updateGameView();
    showToastFn?.(`${top.displayName} added simultaneously.`);
    if (!gameMenuSearchSection?.classList.contains("hidden")) renderGameLibraryView();
  });

  gameToolsAddBottom?.addEventListener("click", () => {
    if (!gameState || gameState.remaining.length === 0) {
      showToastFn?.("No cards remaining in the library.");
      return;
    }
    const bottom = gameState.remaining.pop();
    gameState.activePlanes.push(bottom);
    updateGameView();
    showToastFn?.(`${bottom.displayName} added simultaneously.`);
    if (!gameMenuSearchSection?.classList.contains("hidden")) renderGameLibraryView();
  });

  gameToolsReturnTop?.addEventListener("click", () => {
    if (!gameState || gameState.activePlanes.length === 0) {
      showToastFn?.("No active planes to return.");
      return;
    }
    const returned = [...gameState.activePlanes];
    gameState.remaining.unshift(...returned);
    gameState.activePlanes = [];
    gameState.focusedIndex = 0;
    updateGameView();
    if (!gameMenuSearchSection?.classList.contains("hidden")) renderGameLibraryView();
    showToastFn?.(`Returned ${returned.length} plane${returned.length > 1 ? "s" : ""} to top.`);
  });

  gameToolsReturnBottom?.addEventListener("click", () => {
    if (!gameState || gameState.activePlanes.length === 0) {
      showToastFn?.("No active planes to return.");
      return;
    }
    const returned = [...gameState.activePlanes];
    gameState.remaining.push(...returned);
    gameState.activePlanes = [];
    gameState.focusedIndex = 0;
    updateGameView();
    if (!gameMenuSearchSection?.classList.contains("hidden")) renderGameLibraryView();
    showToastFn?.(`Returned ${returned.length} plane${returned.length > 1 ? "s" : ""} to bottom.`);
  });

  gameEasyPlaneswalkToggle?.addEventListener("change", () => {
    easyPlaneswalk = gameEasyPlaneswalkToggle.checked;
  });

  gameLibraryToggle?.addEventListener("click", () => {
    const isHidden = gameMenuSearchSection?.classList.contains("hidden");
    if (isHidden) {
      gameMenuSearchSection?.classList.remove("hidden");
      if (gameToolsSearchInput) gameToolsSearchInput.value = "";
      if (gameToolsSearchResults) gameToolsSearchResults.innerHTML = "";
      renderGameLibraryView();
      if (gameLibraryToggle) gameLibraryToggle.textContent = "Hide Library";
    } else {
      gameMenuSearchSection?.classList.add("hidden");
      if (gameLibraryToggle) gameLibraryToggle.textContent = "Search & View Library";
    }
  });

  gameToolsSearchInput?.addEventListener("input", () => {
    updateGameSearchResults();
    renderGameLibraryView();
  });

  gameToolsRevealToggle?.addEventListener("click", () => {
    const isHidden = gameRevealInputRow?.classList.contains("hidden");
    if (isHidden) {
      gameRevealInputRow?.classList.remove("hidden");
      gameRevealCountInput?.focus();
    } else {
      gameRevealInputRow?.classList.add("hidden");
    }
  });

  gameRevealGoBtn?.addEventListener("click", openRevealCards);

  gameRevealCountInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") openRevealCards();
  });

  gameRevealClose?.addEventListener("click", closeRevealOverlay);
  gameRevealBackdrop?.addEventListener("click", closeRevealOverlay);

  gameRevealShuffleIn?.addEventListener("click", () => handleRevealBulkAction("shuffle"));
  gameRevealTopAll?.addEventListener("click", () => handleRevealBulkAction("top"));
  gameRevealBottomAll?.addEventListener("click", () => handleRevealBulkAction("bottom"));
  gameRevealExileAll?.addEventListener("click", () => handleRevealBulkAction("exile"));

  gameRevealListBtn?.addEventListener("click", () => setRevealViewMode("list"));
  gameRevealGalleryBtn?.addEventListener("click", () => setRevealViewMode("gallery"));

  gameOptExit?.addEventListener("click", exitGame);
  gameOptReset?.addEventListener("click", resetGame);
  gameOptDeckBuilder?.addEventListener("click", () => {
    exitGame();
    openDeckPanel();
  });

  gameOptSaveState?.addEventListener("click", saveGameStateSeed);
  gameOptLoadState?.addEventListener("click", loadGameStatePrompt);
  gameOptStateLink?.addEventListener("click", shareGameStateLink);

  gameCostReset?.addEventListener("click", () => {
    if (gameState) {
      gameState.chaosCost = 0;
      updateCostDisplay();
    }
  });

  gameCardImageBtn?.addEventListener("click", (event) => {
    if (!gameState || gameState.activePlanes.length === 0) {
      gamePlaneswalk();
      return;
    }
    if (easyPlaneswalk) {
      if (isTouchDevice() || event.shiftKey) {
        gamePlaneswalk();
        return;
      }
    }
    const focused = gameState.activePlanes[gameState.focusedIndex] ?? gameState.activePlanes[0];
    if (focused) openGameReaderView(focused, buildMainCardActions(gameState.focusedIndex));
  });

  gameReaderImageWrap?.addEventListener("click", zoomReaderImage);
  gameReaderImageWrap?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      zoomReaderImage();
    }
  });

  gameReaderZoomOverlay?.addEventListener("click", closeReaderZoom);
  gameReaderZoomOverlay?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
      event.preventDefault();
      closeReaderZoom();
    }
  });

  gameReaderClose?.addEventListener("click", closeGameReaderView);
  gameReaderBackdrop?.addEventListener("click", closeGameReaderView);

  gameView?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const inTools = gameToolsMenu?.contains(target) || gameBtnBr?.contains(target);
    const inOptions = gameOptionsMenu?.contains(target) || gameBtnBl?.contains(target);
    if (!inTools) gameToolsMenu?.classList.add("hidden");
    if (!inOptions) gameOptionsMenu?.classList.add("hidden");
  });

  gameModeClassicBtn?.addEventListener("click", () => {
    hideGameModeDialog();
    maybeShowTutorial("classic", startClassicGame);
  });

  gameModeBemBtn?.addEventListener("click", () => {
    hideGameModeDialog();
    maybeShowTutorial("bem", startBemGame);
  });

  gameModeDialogCancel?.addEventListener("click", hideGameModeDialog);
  gameModeDialogBackdrop?.addEventListener("click", hideGameModeDialog);

  gameTutorialClose?.addEventListener("click", () => {
    hideTutorial();
    if (pendingGameMode === "classic") startClassicGame();
    else if (pendingGameMode === "bem") startBemGame();
    pendingGameMode = null;
  });

  bemMapEl?.addEventListener("click", handleBemCellClick);
  bemViewCardBtn?.addEventListener("click", () => {
    if (!gameState?.bemGrid || !gameState?.bemPos) return;
    const cell = gameState.bemGrid.get(bemKey(gameState.bemPos.x, gameState.bemPos.y));
    if (cell?.card) openGameReaderView(cell.card, buildBemCardActions());
  });

  classicViewCardBtn?.addEventListener("click", () => {
    if (!gameState || gameState.mode === "bem") return;
    const focused = gameState.activePlanes[gameState.focusedIndex] ?? gameState.activePlanes[0];
    if (focused) openGameReaderView(focused, buildMainCardActions(gameState.focusedIndex));
  });

  // BEM drag navigation
  bemMapArea?.addEventListener("pointerdown", handleBemPointerDown);
  bemMapArea?.addEventListener("pointermove", handleBemPointerMove);
  bemMapArea?.addEventListener("pointerup", handleBemPointerUp);
  bemMapArea?.addEventListener("pointercancel", handleBemPointerUp);
}

// ── Deck panel ────────────────────────────────────────────────────────────────

function toggleDeckPanel() {
  if (deckPanelOpen || deckPanelShelved) closeDeckPanel();
  else openDeckPanel();
}

function openDeckPanel() {
  deckPanelOpen = true;
  deckPanelShelved = false;
  deckPanel?.classList.remove("hidden", "shelved");
  deckButton?.classList.add("deck-panel-open");
  // Show badge while panel is open
  const total = getDeckTotal();
  if (deckButtonBadge) {
    deckButtonBadge.textContent = total > 0 ? String(total) : "";
    deckButtonBadge.classList.toggle("hidden", total === 0);
  }
  renderDeckList();
  onDeckChangeFn?.();
  // Defer adding .open so the CSS transition plays after display:none → flex
  requestAnimationFrame(() => {
    deckPanel?.classList.add("open");
  });
}
export function closeDeckPanel() {
  deckPanelOpen = false;
  deckPanelShelved = false;
  deckPanel?.classList.remove("open", "shelved");
  deckButton?.classList.remove("deck-panel-open");
  deckAutoimportMenu?.classList.add("hidden");
  // Hide badge when panel is closed
  deckButtonBadge?.classList.add("hidden");
  onDeckChangeFn?.();
  // Re-hide after transition so it's out of tab order
  const panel = deckPanel;
  if (panel) {
    const onEnd = () => {
      if (!panel.classList.contains("open") && !panel.classList.contains("shelved")) {
        panel.classList.add("hidden");
      }
      panel.removeEventListener("transitionend", onEnd);
    };
    panel.addEventListener("transitionend", onEnd);
  }
}

function shelvePanel() {
  if (!deckPanelOpen) return;
  deckPanelOpen = false;
  deckPanelShelved = true;
  deckPanel?.classList.remove("open");
  deckPanel?.classList.add("shelved");
  onDeckChangeFn?.();
}

function unshelvePanel() {
  if (!deckPanelShelved) return;
  deckPanelShelved = false;
  deckPanelOpen = true;
  deckPanel?.classList.remove("shelved");
  renderDeckList();
  requestAnimationFrame(() => {
    deckPanel?.classList.add("open");
  });
  onDeckChangeFn?.();
}

export function isDeckPanelOpen() {
  return deckPanelOpen || deckPanelShelved;
}

function renderDeckList() {
  if (!deckCardList) return;
  deckCardList.innerHTML = "";

  const deck = deckCards();
  if (deck.size === 0) {
    deckCardList.innerHTML = `<p class="deck-empty-state">No cards yet. Browse the gallery and use the <strong>+</strong> buttons to add cards.</p>`;
    return;
  }

  const sortedEntries = [...deck.entries()]
    .map(([key, count]) => ({ key, count, card: allCards.find((c) => c.key === key) }))
    .filter((e) => e.card)
    .sort((a, b) => a.card.displayName.localeCompare(b.card.displayName, undefined, { sensitivity: "base" }));

  for (const { key, count, card } of sortedEntries) {
    const item = document.createElement("div");
    item.className = "deck-card-item";
    item.dataset.cardKey = key;

    item.innerHTML = `
      <img class="deck-card-thumb" src="${card.thumbPath}" alt="${escapeHtml(card.displayName)}" loading="lazy" />
      <div class="deck-card-info">
        <span class="deck-card-name">${escapeHtml(card.displayName)}</span>
        <span class="deck-card-type">${escapeHtml(card.type)}</span>
      </div>
      <div class="deck-card-controls">
        <button class="deck-count-btn" data-key="${escapeHtml(key)}" data-action="dec" aria-label="Remove one copy" type="button"${count <= 0 ? " disabled" : ""}>−</button>
        <span class="deck-card-count">${count}</span>
        <button class="deck-count-btn" data-key="${escapeHtml(key)}" data-action="inc" aria-label="Add one copy" type="button"${count >= MAX_CARD_COUNT ? " disabled" : ""}>+</button>
      </div>
    `;

    for (const btn of item.querySelectorAll(".deck-count-btn")) {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "inc") addCardToDeck(key);
        else if (action === "dec") removeCardFromDeck(key);
      });
    }

    deckCardList.appendChild(item);
  }
}

// ── Deck management ───────────────────────────────────────────────────────────

export function getCardDeckCount(cardKey) {
  return deckCards().get(cardKey) || 0;
}

export function getAllDecksForProfile() {
  return {
    slot: currentSlot,
    decks: allDecks.map((d) => [...d.entries()]),
    names: [...deckNames]
  };
}

export function importProfileDecks(data) {
  if (!data) return;
  if (typeof data.slot === "number" && data.slot >= 0 && data.slot < NUM_DECK_SLOTS) {
    currentSlot = data.slot;
  }
  if (Array.isArray(data.decks)) {
    allDecks = data.decks.slice(0, NUM_DECK_SLOTS).map((d) => {
      if (!Array.isArray(d)) return new Map();
      return new Map(d.filter(([k, v]) => typeof k === "string" && typeof v === "number" && v > 0 && v <= MAX_CARD_COUNT));
    });
    while (allDecks.length < NUM_DECK_SLOTS) allDecks.push(new Map());
  }
  if (Array.isArray(data.names)) {
    deckNames = data.names.slice(0, NUM_DECK_SLOTS).map((n, i) =>
      typeof n === "string" && n.trim() ? n.trim() : (i === 0 ? "Default Official Deck" : `Deck ${i + 1}`)
    );
    while (deckNames.length < NUM_DECK_SLOTS) deckNames.push(`Deck ${deckNames.length + 1}`);
  }
  saveDecksToStorage();
  saveDeckNamesToStorage();
  updateDeckButton();
  renderDeckSlotDropdown();
  renderDeckList();
  updateAllCardOverlays();
}

export function clearAllDecks() {
  for (let i = 0; i < NUM_DECK_SLOTS; i++) {
    allDecks[i] = new Map();
  }
  deckNames = Array.from({ length: NUM_DECK_SLOTS }, (_, i) =>
    i === 0 ? "Default Official Deck" : `Deck ${i + 1}`
  );
  localStorage.removeItem(DECK_STORAGE_KEY);
  localStorage.removeItem(DECK_NAMES_KEY);
  localStorage.removeItem(DECK_INIT_FLAG_KEY);
  updateDeckButton();
  renderDeckList();
  updateAllCardOverlays();
  renderDeckSlotDropdown();
}

export function encodeProfileData(prefsObj) {
  const deckData = getAllDecksForProfile();
  const obj = { v: 1, p: prefsObj, d: deckData };
  try {
    return "pr1:" + toBase64Url(JSON.stringify(obj));
  } catch {
    return "";
  }
}

export function decodeProfileData(seed) {
  if (!seed?.startsWith("pr1:")) return null;
  try {
    return JSON.parse(fromBase64Url(seed.slice(4)));
  } catch {
    return null;
  }
}

export function getDeckTotal() {
  return [...deckCards().values()].reduce((a, b) => a + b, 0);
}

export function addCardToDeck(cardKey) {
  const deck = deckCards();
  const current = deck.get(cardKey) || 0;
  if (current >= MAX_CARD_COUNT) {
    showToastFn?.(`Maximum ${MAX_CARD_COUNT} copies per card.`);
    return;
  }
  deck.set(cardKey, current + 1);
  saveDecksToStorage();
  updateDeckButton();
  refreshDeckCardItem(cardKey);
  updateCardOverlays(cardKey);
  updateModalDeckButton(cardKey);
  renderDeckSlotDropdown();
}

export function removeCardFromDeck(cardKey) {
  const deck = deckCards();
  const current = deck.get(cardKey) || 0;
  if (current <= 1) {
    deck.delete(cardKey);
  } else {
    deck.set(cardKey, current - 1);
  }
  saveDecksToStorage();
  updateDeckButton();
  refreshDeckCardItem(cardKey);
  updateCardOverlays(cardKey);
  updateModalDeckButton(cardKey);
  renderDeckSlotDropdown();
}

export function toggleCardInDeck(cardKey) {
  const count = deckCards().get(cardKey) || 0;
  if (count > 0) {
    removeCardFromDeck(cardKey);
  } else {
    addCardToDeck(cardKey);
  }
}

function clearDeck() {
  if (getDeckTotal() === 0) return;
  deckCards().clear();
  saveDecksToStorage();
  updateDeckButton();
  renderDeckList();
  updateAllCardOverlays();
  renderDeckSlotDropdown();
  showToastFn?.("Deck cleared.");
}

function updateDeckButton() {
  const total = getDeckTotal();
  // Badge is only shown when panel is open (managed by openDeckPanel/closeDeckPanel)
  if (deckButtonBadge) {
    deckButtonBadge.textContent = total > 0 ? String(total) : "";
    if (deckPanelOpen || deckPanelShelved) {
      deckButtonBadge.classList.toggle("hidden", total === 0);
    }
  }
  if (deckButton) {
    deckButton.setAttribute("aria-label", total > 0 ? `Deck builder (${total} cards)` : "Deck builder");
  }
  if (deckTotalEl) {
    deckTotalEl.textContent = `${total} ${total === 1 ? "card" : "cards"}`;
  }
}

function refreshDeckCardItem(cardKey) {
  if (!deckCardList || !deckPanelOpen) return;
  const deck = deckCards();
  const count = deck.get(cardKey) || 0;
  const existing = deckCardList.querySelector(`[data-card-key="${CSS.escape(cardKey)}"]`);

  if (count === 0 && existing) {
    existing.remove();
    if (deck.size === 0) {
      deckCardList.innerHTML = `<p class="deck-empty-state">No cards yet. Browse the gallery and use the <strong>+</strong> buttons to add cards.</p>`;
    }
    return;
  }

  if (!existing) {
    renderDeckList();
    return;
  }

  const countEl = existing.querySelector(".deck-card-count");
  if (countEl) countEl.textContent = count;
  const decBtn = existing.querySelector("[data-action='dec']");
  if (decBtn) decBtn.disabled = count <= 0;
  const incBtn = existing.querySelector("[data-action='inc']");
  if (incBtn) incBtn.disabled = count >= MAX_CARD_COUNT;
}

function applyOverlayCount(overlay, count) {
  const countEl = overlay.querySelector(".deck-overlay-count");
  if (countEl) countEl.textContent = count > 0 ? count : "";
  overlay.classList.toggle("deck-has-count", count > 0);
  const decBtn = overlay.querySelector(".deck-overlay-dec");
  if (decBtn) decBtn.disabled = count === 0;
}

function applyListRowCount(row, count) {
  const countEl = row.querySelector(".list-deck-count");
  const decBtn = row.querySelector("[data-action='dec']");
  if (countEl) countEl.textContent = count > 0 ? String(count) : "·";
  if (decBtn) decBtn.disabled = count === 0;
}

function updateCardOverlays(cardKey) {
  const count = deckCards().get(cardKey) || 0;
  for (const overlay of document.querySelectorAll(`.deck-card-overlay[data-card-key="${CSS.escape(cardKey)}"]`)) {
    applyOverlayCount(overlay, count);
  }
  for (const row of document.querySelectorAll(`.list-card-row[data-card-key="${CSS.escape(cardKey)}"]`)) {
    applyListRowCount(row, count);
  }
}

function updateAllCardOverlays() {
  const allKeys = new Set();
  for (const overlay of document.querySelectorAll(".deck-card-overlay")) {
    const key = overlay.dataset.cardKey;
    if (!key) continue;
    const count = deckCards().get(key) || 0;
    applyOverlayCount(overlay, count);
    allKeys.add(key);
  }
  for (const row of document.querySelectorAll(".list-card-row[data-card-key]")) {
    const key = row.dataset.cardKey;
    if (!key) continue;
    const count = deckCards().get(key) || 0;
    applyListRowCount(row, count);
  }
}

export function updateModalDeckButton(cardKey) {
  if (!modalAddToDeckBtn || modalAddToDeckBtn.dataset.cardKey !== cardKey) return;
  const count = deckCards().get(cardKey) || 0;
  modalAddToDeckBtn.textContent = count > 0 ? "In Deck" : "+ Deck";
  modalAddToDeckBtn.classList.toggle("deck-in-deck", count > 0);
  if (modalDeckQty) {
    modalDeckQty.classList.toggle("hidden", count === 0);
    if (modalDeckCount) modalDeckCount.textContent = count;
    if (modalDeckDec) modalDeckDec.disabled = count <= 0;
    if (modalDeckInc) modalDeckInc.disabled = count >= MAX_CARD_COUNT;
  }
}

export function setModalCardKey(cardKey) {
  if (!modalAddToDeckBtn) return;
  modalAddToDeckBtn.dataset.cardKey = cardKey;
  updateModalDeckButton(cardKey);
}

// ── Seed encoding ─────────────────────────────────────────────────────────────

function compressKey(key) {
  if (key.startsWith("Plane_")) return "p" + key.slice(6);
  if (key.startsWith("Phenomenon_")) return "n" + key.slice(11);
  return "u" + key;
}

function decompressKey(compressed) {
  if (!compressed || compressed.length < 2) return null;
  const pre = compressed[0];
  const rest = compressed.slice(1);
  if (pre === "p") return "Plane_" + rest;
  if (pre === "n") return "Phenomenon_" + rest;
  if (pre === "u") return rest;
  return null;
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(b64) {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeDeck(map) {
  const entries = [...map.entries()]
    .filter(([, c]) => c > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return "";

  const raw = entries.map(([k, c]) => {
    const ck = compressKey(k);
    return c === 1 ? ck : `${ck}*${c}`;
  }).join(",");

  try {
    return "d1:" + toBase64Url(raw);
  } catch {
    return "";
  }
}

function decodeDeck(seed) {
  if (!seed?.startsWith("d1:")) return new Map();
  try {
    const raw = fromBase64Url(seed.slice(3));
    const map = new Map();
    for (const part of raw.split(",")) {
      if (!part) continue;
      const starIdx = part.lastIndexOf("*");
      let ck, count;
      if (starIdx >= 1 && /^\d+$/.test(part.slice(starIdx + 1))) {
        ck = part.slice(0, starIdx);
        count = Math.max(1, Math.min(MAX_CARD_COUNT, parseInt(part.slice(starIdx + 1), 10)));
      } else {
        ck = part;
        count = 1;
      }
      const key = decompressKey(ck);
      if (key) map.set(key, count);
    }
    return map;
  } catch {
    return new Map();
  }
}

function filterValidDeck(map) {
  const valid = new Map();
  for (const [key, count] of map) {
    if (allCards.some((c) => c.key === key)) valid.set(key, count);
  }
  return valid;
}

// ── Import / Export ───────────────────────────────────────────────────────────

function exportDeckSeed() {
  const seed = encodeDeck(deckCards());
  if (!seed) { showToastFn?.("Deck is empty."); return; }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(seed).then(() => showToastFn?.("Deck seed copied!")).catch(() => prompt("Copy this deck seed:", seed));
  } else {
    prompt("Copy this deck seed:", seed);
  }
}

function importDeckPrompt() {
  const seed = prompt("Paste a deck seed to import:");
  if (!seed?.trim()) return;
  const decoded = decodeDeck(seed.trim());
  if (decoded.size === 0) { showToastFn?.("Invalid deck seed."); return; }
  const valid = filterValidDeck(decoded);
  const skipped = decoded.size - valid.size;
  allDecks[currentSlot] = valid;
  saveDecksToStorage();
  updateDeckButton();
  renderDeckList();
  updateAllCardOverlays();
  renderDeckSlotDropdown();
  const total = getDeckTotal();
  if (skipped > 0) {
    showToastFn?.(`Imported ${total} cards (${skipped} unknown card${skipped > 1 ? "s" : ""} skipped).`);
  } else {
    showToastFn?.(`Imported deck: ${total} card${total !== 1 ? "s" : ""}.`);
  }
}

function shareDeckLink() {
  const seed = encodeDeck(deckCards());
  if (!seed) { showToastFn?.("Deck is empty."); return; }
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.set("deck", seed);
  const urlStr = url.toString();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(urlStr).then(() => showToastFn?.("Deck link copied!")).catch(() => prompt("Copy this deck link:", urlStr));
  } else {
    prompt("Copy this deck link:", urlStr);
  }
}

// ── Game state encoding ───────────────────────────────────────────────────────

function encodeGameState() {
  if (!gameState) return "";
  if (gameState.mode === "bem") {
    const grid = [];
    for (const [key, cell] of gameState.bemGrid.entries()) {
      const [x, y] = key.split(",").map(Number);
      const entry = [x, y, compressKey(cell.card.key), cell.faceUp ? 1 : 0];
      if (cell.queuedCard) entry.push(compressKey(cell.queuedCard.key));
      grid.push(entry);
    }
    const obj = {
      m: "bem",
      r: gameState.remaining.map((c) => compressKey(c.key)),
      e: gameState.exiled.map((c) => compressKey(c.key)),
      c: gameState.chaosCost,
      g: grid,
      px: gameState.bemPos.x,
      py: gameState.bemPos.y
    };
    try {
      return "g1:" + toBase64Url(JSON.stringify(obj));
    } catch {
      return "";
    }
  }
  const obj = {
    r: gameState.remaining.map((c) => compressKey(c.key)),
    a: gameState.activePlanes.map((c) => compressKey(c.key)),
    f: gameState.focusedIndex,
    c: gameState.chaosCost,
    e: gameState.exiled.map((c) => compressKey(c.key))
  };
  if (revealedCards.length > 0) {
    obj.rv = revealedCards.map((c) => compressKey(c.key));
  }
  try {
    return "g1:" + toBase64Url(JSON.stringify(obj));
  } catch {
    return "";
  }
}

function decodeGameState(seed) {
  if (!seed?.startsWith("g1:")) return null;
  try {
    const raw = fromBase64Url(seed.slice(3));
    const obj = JSON.parse(raw);
    const lookupCard = (ck) => {
      const key = decompressKey(ck);
      return key ? allCards.find((c) => c.key === key) : null;
    };
    if (obj.m === "bem") {
      const remaining = (obj.r || []).map(lookupCard).filter(Boolean);
      const exiled = (obj.e || []).map(lookupCard).filter(Boolean);
      const chaosCost = typeof obj.c === "number" ? Math.max(0, obj.c) : 0;
      const bemGrid = new Map();
      for (const [x, y, ck, fu, qck] of (obj.g || [])) {
        const card = lookupCard(ck);
        if (card) {
          const cellObj = { card, faceUp: fu === 1 };
          if (qck) {
            const queuedCard = lookupCard(qck);
            if (queuedCard) cellObj.queuedCard = queuedCard;
          }
          bemGrid.set(bemKey(x, y), cellObj);
        }
      }
      const bemPos = {
        x: typeof obj.px === "number" ? obj.px : 0,
        y: typeof obj.py === "number" ? obj.py : 0
      };
      return { mode: "bem", remaining, exiled, chaosCost, bemGrid, bemPos };
    }
    const remaining = (obj.r || []).map(lookupCard).filter(Boolean);
    const activePlanes = (obj.a || []).map(lookupCard).filter(Boolean);
    const exiled = (obj.e || []).map(lookupCard).filter(Boolean);
    const revealed = (obj.rv || []).map(lookupCard).filter(Boolean);
    const focusedIndex = Math.max(0, Math.min(
      typeof obj.f === "number" ? obj.f : 0,
      Math.max(0, activePlanes.length - 1)
    ));
    const chaosCost = typeof obj.c === "number" ? Math.max(0, obj.c) : 0;
    return { mode: "classic", remaining, activePlanes, focusedIndex, chaosCost, exiled, revealed };
  } catch {
    return null;
  }
}

function saveGameStateSeed() {
  if (!gameState) { showToastFn?.("No active game to save."); return; }
  const seed = encodeGameState();
  if (!seed) { showToastFn?.("Failed to encode game state."); return; }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(seed).then(() => showToastFn?.("Game state seed copied!")).catch(() => prompt("Copy this game seed:", seed));
  } else {
    prompt("Copy this game seed:", seed);
  }
  closeAllGameMenus();
}

function loadGameStatePrompt() {
  const seed = prompt("Paste a game state seed to restore:");
  if (!seed?.trim()) return;
  const decoded = decodeGameState(seed.trim());
  if (!decoded) { showToastFn?.("Invalid game state seed."); return; }
  closeGameReaderView();
  closeAllGameMenus();
  startGameFromState(decoded);
  showToastFn?.("Game state restored.");
}

function shareGameStateLink() {
  if (!gameState) { showToastFn?.("No active game to share."); return; }
  const seed = encodeGameState();
  if (!seed) { showToastFn?.("Failed to encode game state."); return; }
  const url = new URL(window.location.href);
  url.hash = "#play";
  url.searchParams.set("game", seed);
  const urlStr = url.toString();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(urlStr).then(() => showToastFn?.("Game link copied!")).catch(() => prompt("Copy this game link:", urlStr));
  } else {
    prompt("Copy this game link:", urlStr);
  }
  closeAllGameMenus();
}

// ── Storage ───────────────────────────────────────────────────────────────────

function loadDecksFromStorage() {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    const defaultDecks = Array.from({ length: NUM_DECK_SLOTS }, () => new Map());
    const defaultNames = Array.from({ length: NUM_DECK_SLOTS }, (_, i) =>
      i === 0 ? "Default Official Deck" : `Deck ${i + 1}`
    );
    if (!raw) return { slot: 0, decks: defaultDecks, names: loadDeckNamesFromStorage() };
    const parsed = JSON.parse(raw);
    const slot = typeof parsed.slot === "number" && parsed.slot >= 0 && parsed.slot < NUM_DECK_SLOTS ? parsed.slot : 0;
    const decks = Array.isArray(parsed.decks)
      ? parsed.decks.slice(0, NUM_DECK_SLOTS).map((d) => {
          if (!Array.isArray(d)) return new Map();
          return new Map(d.filter(([k, v]) => typeof k === "string" && typeof v === "number" && v > 0 && v <= MAX_CARD_COUNT));
        })
      : [];
    while (decks.length < NUM_DECK_SLOTS) decks.push(new Map());
    return { slot, decks, names: loadDeckNamesFromStorage() };
  } catch {
    return {
      slot: 0,
      decks: Array.from({ length: NUM_DECK_SLOTS }, () => new Map()),
      names: Array.from({ length: NUM_DECK_SLOTS }, (_, i) => i === 0 ? "Default Official Deck" : `Deck ${i + 1}`)
    };
  }
}

function loadDeckNamesFromStorage() {
  const defaultNames = Array.from({ length: NUM_DECK_SLOTS }, (_, i) =>
    i === 0 ? "Default Official Deck" : `Deck ${i + 1}`
  );
  try {
    const raw = localStorage.getItem(DECK_NAMES_KEY);
    if (!raw) return defaultNames;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultNames;
    const names = parsed.slice(0, NUM_DECK_SLOTS).map((n, i) =>
      typeof n === "string" && n.trim() ? n.trim() : defaultNames[i]
    );
    while (names.length < NUM_DECK_SLOTS) names.push(defaultNames[names.length]);
    return names;
  } catch {
    return defaultNames;
  }
}

function saveDeckNamesToStorage() {
  try {
    localStorage.setItem(DECK_NAMES_KEY, JSON.stringify(deckNames));
  } catch {
    // ignore
  }
}

function saveDecksToStorage() {
  try {
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify({
      slot: currentSlot,
      decks: allDecks.map((d) => [...d.entries()])
    }));
  } catch {
    // ignore
  }
}

// ── Game mode ─────────────────────────────────────────────────────────────────

function buildDeckArray() {
  const result = [];
  for (const [key, count] of deckCards()) {
    const card = allCards.find((c) => c.key === key);
    if (card) for (let i = 0; i < count; i++) result.push(card);
  }
  return result;
}

export function showGameModeDialog() {
  const total = getDeckTotal();
  if (total === 0) { showToastFn?.("Add cards to your deck first."); return; }
  gameModeDialog?.classList.remove("hidden");
}

function hideGameModeDialog() {
  gameModeDialog?.classList.add("hidden");
}

function startGame() {
  showGameModeDialog();
}

function startClassicGame() {
  const total = getDeckTotal();
  if (total === 0) { showToastFn?.("Add cards to your deck first."); return; }

  const shuffled = shuffleArray(buildDeckArray());
  gameState = {
    mode: "classic",
    remaining: shuffled,
    activePlanes: [],
    focusedIndex: 0,
    dieRolling: false,
    chaosCost: 0,
    exiled: [],
    _dieResetTimer: null
  };

  gameActive = true;
  closeDeckPanel();
  document.body.classList.add("game-open");
  gameView?.classList.remove("hidden");
  gameView?.classList.remove("bem-active");
  bemMapArea?.classList.add("hidden");
  showGamePlaceholder();
  resetDieIcon();
  updateCostDisplay();
  syncBemTrButton();

  if (window.location.hash !== "#play") {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}#play`);
  }
}

function startGameFromState(decoded) {
  clearTimeout(gameState?._dieResetTimer);
  if (decoded.mode === "bem") {
    gameState = {
      mode: "bem",
      remaining: decoded.remaining,
      exiled: decoded.exiled,
      chaosCost: decoded.chaosCost,
      dieRolling: false,
      _dieResetTimer: null,
      activePlanes: [],
      focusedIndex: 0,
      bemGrid: decoded.bemGrid,
      bemPos: decoded.bemPos
    };
    revealedCards = [];

    gameActive = true;
    closeDeckPanel();
    document.body.classList.add("game-open");
    gameView?.classList.remove("hidden");
    gameView?.classList.add("bem-active");
    bemMapArea?.classList.remove("hidden");
    resetDieIcon();
    updateCostDisplay();
    renderBemMap();
    updateBemInfoBar();
    syncBemTrButton();
  } else {
    gameState = {
      mode: "classic",
      remaining: decoded.remaining,
      activePlanes: decoded.activePlanes,
      focusedIndex: decoded.focusedIndex,
      dieRolling: false,
      chaosCost: decoded.chaosCost,
      exiled: decoded.exiled,
      _dieResetTimer: null
    };
    revealedCards = decoded.revealed;

    gameActive = true;
    closeDeckPanel();
    document.body.classList.add("game-open");
    gameView?.classList.remove("hidden");
    gameView?.classList.remove("bem-active");
    bemMapArea?.classList.add("hidden");
    resetDieIcon();
    updateCostDisplay();
    syncBemTrButton();

    if (gameState.activePlanes.length > 0) {
      updateGameView();
    } else {
      showGamePlaceholder();
    }

    if (revealedCards.length > 0) {
      renderRevealCards();
      updateRevealFooter();
      gameRevealOverlay?.classList.remove("hidden");
    }
  }

  if (window.location.hash !== "#play") {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}#play`);
  }
}

function exitGame({ updateHash = true } = {}) {
  clearTimeout(gameState?._dieResetTimer);
  gameActive = false;
  gameState = null;
  revealedCards = [];
  bemPlaneswalkPending = false;
  document.body.classList.remove("game-open");
  gameView?.classList.add("hidden");
  gameView?.classList.remove("bem-active");
  bemMapArea?.classList.add("hidden");
  gameRevealOverlay?.classList.add("hidden");
  closeGameReaderView();
  closeAllGameMenus();
  syncBemTrButton();
  if (classicViewCardBtn) classicViewCardBtn.classList.add("hidden");

  if (updateHash && window.location.hash === "#play") {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
  }
}

function resetGame() {
  if (!gameState) return;
  clearTimeout(gameState._dieResetTimer);
  closeAllGameMenus();
  resetDieIcon();
  if (gameState.mode === "bem") {
    startBemGame();
  } else {
    const shuffled = shuffleArray(buildDeckArray());
    gameState = {
      mode: "classic",
      remaining: shuffled,
      activePlanes: [],
      focusedIndex: 0,
      dieRolling: false,
      chaosCost: 0,
      exiled: [],
      _dieResetTimer: null
    };
    showGamePlaceholder();
    updateCostDisplay();
    showToastFn?.("Deck reshuffled and reset.");
  }
}

function gamePlaneswalk() {
  if (!gameState) return;
  if (gameState.mode === "bem") return;

  const { activePlanes, remaining } = gameState;

  for (const card of activePlanes) remaining.push(card);

  if (remaining.length === 0) {
    gameState.activePlanes = [];
    gameState.focusedIndex = 0;
    updateGameView();
    showToastFn?.("No more planes in the library.");
    return;
  }

  const nextCard = remaining.shift();
  gameState.activePlanes = [nextCard];
  gameState.focusedIndex = 0;
  updateGameView();
}

function gameRollDie() {
  if (!gameState || gameState.dieRolling) return;

  gameState.dieRolling = true;
  gameBtnTl?.classList.add("game-die-rolling");

  setTimeout(() => {
    if (!gameState) return;
    const roll = Math.floor(Math.random() * 6) + 1;
    gameState.dieRolling = false;
    gameBtnTl?.classList.remove("game-die-rolling");
    gameState.chaosCost++;
    updateCostDisplay();
    applyDieResult(roll);
  }, 500);
}

function applyDieResult(roll) {
  if (!gameDieIcon) return;
  gameBtnTl?.classList.remove("game-die-chaos", "game-die-walk", "game-die-blank");
  gameDieIcon.className = "";
  gameDieIcon.textContent = "";

  if (roll === 1) {
    gameDieIcon.className = "ms ms-chaos";
    gameDieIcon.setAttribute("aria-label", "Chaos!");
    gameBtnTl?.classList.add("game-die-chaos");
  } else if (roll === 6) {
    gameDieIcon.className = "ms ms-planeswalker";
    gameDieIcon.setAttribute("aria-label", "Planeswalk!");
    gameBtnTl?.classList.add("game-die-walk");
  } else {
    gameDieIcon.className = "game-die-blank-text";
    gameDieIcon.textContent = "BLANK";
    gameDieIcon.setAttribute("aria-label", "No effect");
    gameBtnTl?.classList.add("game-die-blank");
  }

  gameDieIcon.classList.remove("game-die-flash");
  void gameDieIcon.offsetWidth;
  gameDieIcon.classList.add("game-die-flash");
}

function resetDieIcon() {
  if (!gameDieIcon) return;
  gameDieIcon.className = "ms ms-chaos";
  gameDieIcon.textContent = "";
  gameDieIcon.removeAttribute("aria-label");
  gameBtnTl?.classList.remove("game-die-chaos", "game-die-walk", "game-die-blank");
}

function updateCostDisplay() {
  if (!gameState) return;
  const cost = gameState.chaosCost;
  if (gameCostValue) gameCostValue.textContent = cost;
  if (gameCostDisplay) gameCostDisplay.classList.toggle("game-cost-visible", cost > 0);
}

function showGamePlaceholder() {
  if (gameCardImage) {
    gameCardImage.src = "images/assets/card-preview.jpg";
    gameCardImage.alt = "Click to planeswalk";
  }
  if (gameSidePanel) gameSidePanel.innerHTML = "";
  if (gameCardImageBtn) {
    gameCardImageBtn.setAttribute("aria-label", "Planeswalk");
    gameCardImageBtn.classList.add("game-card-image-btn-placeholder");
    gameCardImageBtn.classList.remove("active-plane", "active-phenomenon");
  }
  if (classicViewCardBtn) classicViewCardBtn.classList.add("hidden");
  syncGameToolsState(gameState?.remaining.length ?? 0);
}

function updateGameView() {
  if (!gameState) return;

  const { activePlanes, focusedIndex, remaining } = gameState;
  const focused = activePlanes[focusedIndex] ?? activePlanes[0];

  if (!focused) {
    showGamePlaceholder();
    return;
  }

  if (gameCardImage) {
    gameCardImage.src = focused.imagePath;
    gameCardImage.alt = focused.displayName;
  }
  if (gameCardImageBtn) {
    gameCardImageBtn.setAttribute("aria-label", easyPlaneswalk ? "Planeswalk (or Shift+click to view)" : "View card close-up");
    gameCardImageBtn.classList.remove("game-card-image-btn-placeholder");
    gameCardImageBtn.classList.toggle("active-plane", focused.type !== "Phenomenon");
    gameCardImageBtn.classList.toggle("active-phenomenon", focused.type === "Phenomenon");
  }

  // Update classic view card button
  if (classicViewCardBtn) {
    classicViewCardBtn.classList.remove("hidden");
    if (classicCardNameLabel) classicCardNameLabel.textContent = focused.displayName;
    if (classicLibraryLabel) classicLibraryLabel.textContent = `${remaining.length} left`;
  }

  renderGameSidePanel(activePlanes, focusedIndex);
  syncGameToolsState(remaining.length);
}

function renderGameSidePanel(activePlanes, focusedIndex) {
  if (!gameSidePanel) return;
  gameSidePanel.innerHTML = "";

  if (activePlanes.length <= 1) return;

  const cycleBtn = document.createElement("button");
  cycleBtn.type = "button";
  cycleBtn.className = "game-cycle-btn";
  cycleBtn.setAttribute("aria-label", "Cycle active planes");
  cycleBtn.innerHTML = `<span class="game-cycle-icon" aria-hidden="true">↻</span>`;
  cycleBtn.addEventListener("click", () => {
    if (!gameState) return;
    gameState.focusedIndex = (focusedIndex + 1) % activePlanes.length;
    updateGameView();
  });
  gameSidePanel.appendChild(cycleBtn);

  for (let i = 0; i < activePlanes.length; i++) {
    if (i === focusedIndex) continue;
    const card = activePlanes[i];
    const idx = i;

    const sideCard = document.createElement("button");
    sideCard.type = "button";
    sideCard.className = "game-side-card";
    sideCard.setAttribute("aria-label", `View ${card.displayName} (opens card reader)`);
    sideCard.innerHTML = `
      <img class="game-side-card-img" src="${card.thumbPath}" alt="${escapeHtml(card.displayName)}" />
      <div class="game-side-card-label">${escapeHtml(card.displayName)}</div>
    `;
    sideCard.addEventListener("click", () => {
      if (!gameState) return;
      openGameReaderView(card, buildSideCardActions(idx));
    });
    gameSidePanel.appendChild(sideCard);
  }
}

function syncGameToolsState(remainingCount) {
  const isBem = gameState?.mode === "bem";
  if (gameToolsAddTop) {
    gameToolsAddTop.disabled = remainingCount === 0;
    const span = gameToolsAddTop.querySelector("span");
    if (span) span.textContent = `Add Top of Library (${remainingCount} left)`;
  }
  if (gameToolsAddBottom) {
    gameToolsAddBottom.disabled = remainingCount === 0;
    const span = gameToolsAddBottom.querySelector("span");
    if (span) span.textContent = `Add Bottom of Library (${remainingCount} left)`;
  }
  if (gameToolsReturnTop) {
    gameToolsReturnTop.disabled = !gameState || (!isBem && gameState.activePlanes.length === 0);
  }
  if (gameToolsReturnBottom) {
    gameToolsReturnBottom.disabled = !gameState || (!isBem && gameState.activePlanes.length === 0);
  }
  // Shuffle, search/library, reveal — always enabled when game is active
  if (gameToolsShuffle) gameToolsShuffle.disabled = !gameState;
  if (gameLibraryToggle) gameLibraryToggle.disabled = !gameState;
  if (gameToolsRevealToggle) gameToolsRevealToggle.disabled = !gameState;
}

function buildMainCardActions(focusedIdx) {
  return [
    {
      label: "Planeswalk Away",
      action: () => { closeGameReaderView(); gamePlaneswalk(); }
    },
    {
      label: "Return to Top",
      action: () => {
        if (!gameState) return;
        const card = gameState.activePlanes.splice(focusedIdx, 1)[0];
        if (!card) return;
        gameState.remaining.unshift(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        closeGameReaderView();
        updateGameView();
        showToastFn?.(`${card.displayName} returned to top.`);
      }
    },
    {
      label: "Return to Bottom",
      action: () => {
        if (!gameState) return;
        const card = gameState.activePlanes.splice(focusedIdx, 1)[0];
        if (!card) return;
        gameState.remaining.push(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        closeGameReaderView();
        updateGameView();
        showToastFn?.(`${card.displayName} returned to bottom.`);
      }
    },
    {
      label: "Shuffle Into Library",
      action: () => {
        if (!gameState) return;
        const card = gameState.activePlanes.splice(focusedIdx, 1)[0];
        if (!card) return;
        gameState.remaining.push(card);
        gameState.remaining = shuffleArray(gameState.remaining);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        closeGameReaderView();
        updateGameView();
        showToastFn?.(`${card.displayName} shuffled into library.`);
      }
    },
    {
      label: "Exile",
      danger: true,
      action: () => {
        if (!gameState) return;
        const card = gameState.activePlanes.splice(focusedIdx, 1)[0];
        if (!card) return;
        gameState.exiled.push(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        closeGameReaderView();
        updateGameView();
        showToastFn?.(`${card.displayName} exiled.`);
      }
    }
  ];
}

function buildSideCardActions(sideIdx) {
  return [
    {
      label: "Make Main",
      action: () => {
        if (!gameState) return;
        gameState.focusedIndex = sideIdx;
        closeGameReaderView();
        updateGameView();
      }
    },
    {
      label: "Planeswalk Here",
      action: () => {
        if (!gameState) return;
        const card = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!card) return;
        gameState.remaining.push(...gameState.activePlanes);
        gameState.activePlanes = [card];
        gameState.focusedIndex = 0;
        closeGameReaderView();
        updateGameView();
        showToastFn?.(`Planeswalked to ${card.displayName}.`);
      }
    },
    {
      label: "Return to Top",
      action: () => {
        if (!gameState) return;
        const card = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!card) return;
        gameState.remaining.unshift(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        closeGameReaderView();
        updateGameView();
        showToastFn?.(`${card.displayName} returned to top.`);
      }
    },
    {
      label: "Return to Bottom",
      action: () => {
        if (!gameState) return;
        const card = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!card) return;
        gameState.remaining.push(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        closeGameReaderView();
        updateGameView();
        showToastFn?.(`${card.displayName} returned to bottom.`);
      }
    },
    {
      label: "Shuffle Into Library",
      action: () => {
        if (!gameState) return;
        const card = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!card) return;
        gameState.remaining.push(card);
        gameState.remaining = shuffleArray(gameState.remaining);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        closeGameReaderView();
        updateGameView();
        showToastFn?.(`${card.displayName} shuffled into library.`);
      }
    },
    {
      label: "Exile",
      danger: true,
      action: () => {
        if (!gameState) return;
        const card = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!card) return;
        gameState.exiled.push(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        closeGameReaderView();
        updateGameView();
        showToastFn?.(`${card.displayName} exiled.`);
      }
    }
  ];
}

function openGameReaderView(card, actions = []) {
  if (!gameReaderView || !card) return;

  readerCardPath = card.imagePath;

  if (gameReaderImage) {
    gameReaderImage.src = card.imagePath;
    gameReaderImage.alt = card.displayName;
  }
  closeReaderZoom();
  if (gameReaderCardName) gameReaderCardName.textContent = card.displayName;
  if (gameReaderCardType) gameReaderCardType.textContent = card.type || "";

  if (gameReaderTranscript) {
    gameReaderTranscript.textContent = "Loading…";
    loadReaderTranscript(card);
  }

  if (gameReaderActions) {
    gameReaderActions.innerHTML = "";
    for (const { label, action, danger } of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "game-reader-action-btn" + (danger ? " game-reader-action-danger" : "");
      btn.textContent = label;
      btn.addEventListener("click", action);
      gameReaderActions.appendChild(btn);
    }
  }

  gameReaderView.classList.remove("hidden");
  document.body.classList.add("game-reader-open");
}

async function loadReaderTranscript(card) {
  if (!gameReaderTranscript) return;
  const cached = readerTranscriptCache.get(card.key);
  if (typeof cached === "string") {
    renderReaderTranscriptMarkdown(cached || "No transcript available.");
    return;
  }
  try {
    const response = await fetch(card.transcriptPath);
    if (!response.ok) throw new Error("Not found");
    const text = await response.text();
    const trimmed = text.trim();
    readerTranscriptCache.set(card.key, trimmed);
    if (gameReaderTranscript) renderReaderTranscriptMarkdown(trimmed || "No transcript available.");
  } catch {
    readerTranscriptCache.set(card.key, "");
    if (gameReaderTranscript) renderReaderTranscriptMarkdown("No transcript available.");
  }
}

function renderReaderTranscriptMarkdown(text) {
  if (!gameReaderTranscript) return;
  try {
    const html = window.marked
      ? window.marked.parse(text, { breaks: true })
      : text.replace(/\n/g, "<br>");
    const safe = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
    gameReaderTranscript.innerHTML = safe;
  } catch {
    gameReaderTranscript.textContent = text;
  }
}

function zoomReaderImage() {
  if (!gameReaderZoomOverlay || !gameReaderZoomImg) return;
  gameReaderZoomImg.src = readerCardPath;
  gameReaderZoomImg.alt = gameReaderImage?.alt || "";
  gameReaderZoomOverlay.classList.remove("hidden");
  if (gameReaderImageWrap) {
    gameReaderImageWrap.setAttribute("aria-pressed", "true");
    gameReaderImageWrap.setAttribute("aria-label", "Close zoomed image");
  }
}

function closeReaderZoom() {
  gameReaderZoomOverlay?.classList.add("hidden");
  if (gameReaderImageWrap) {
    gameReaderImageWrap.setAttribute("aria-label", "Zoom card image");
    gameReaderImageWrap.setAttribute("aria-pressed", "false");
  }
}

function closeGameReaderView() {
  gameReaderView?.classList.add("hidden");
  document.body.classList.remove("game-reader-open");
  closeReaderZoom();
  if (gameReaderImageWrap) {
    gameReaderImageWrap.setAttribute("aria-label", "Zoom card image");
    gameReaderImageWrap.setAttribute("aria-pressed", "false");
  }
}

function renderGameLibraryView() {
  if (!gameLibraryViewList || !gameState) return;
  const query = gameToolsSearchInput?.value.trim().toLowerCase() || "";
  if (query) {
    gameLibraryViewList.innerHTML = "";
    return;
  }
  gameLibraryViewList.innerHTML = "";
  if (gameState.remaining.length === 0) {
    gameLibraryViewList.innerHTML = `<p class="game-search-empty">Library is empty.</p>`;
    return;
  }
  const ol = document.createElement("ol");
  ol.className = "game-deck-view-ol";
  ol.addEventListener("click", handleLibraryItemAction);
  for (let i = 0; i < gameState.remaining.length; i++) {
    const card = gameState.remaining[i];
    const li = document.createElement("li");
    li.className = "game-deck-view-item";
    li.innerHTML = `
      <div class="game-deck-item-row">
        <span class="game-deck-view-name">${escapeHtml(card.displayName)}</span>
        <span class="game-deck-view-type">${escapeHtml(card.type)}</span>
      </div>
      <div class="game-deck-item-actions">
        <button class="game-deck-action-btn" data-action="planeswalk" data-idx="${i}" title="Planeswalk to this card" type="button">▶</button>
        <button class="game-deck-action-btn" data-action="active" data-idx="${i}" title="Add to active cards" type="button">+</button>
        <button class="game-deck-action-btn" data-action="top" data-idx="${i}" title="Put on top of library" type="button">↑</button>
        <button class="game-deck-action-btn" data-action="bottom" data-idx="${i}" title="Put on bottom of library" type="button">↓</button>
        <button class="game-deck-action-btn game-deck-action-exile" data-action="exile" data-idx="${i}" title="Exile (remove temporarily)" type="button">✕</button>
      </div>
    `;
    ol.appendChild(li);
  }
  gameLibraryViewList.appendChild(ol);
}

function updateGameSearchResults() {
  if (!gameToolsSearchInput || !gameToolsSearchResults || !gameState) return;

  const query = gameToolsSearchInput.value.trim().toLowerCase();
  gameToolsSearchResults.innerHTML = "";

  if (!query) {
    renderGameLibraryView();
    return;
  }

  if (gameLibraryViewList) gameLibraryViewList.innerHTML = "";

  const seen = new Set();
  const matches = [];
  for (let i = 0; i < gameState.remaining.length; i++) {
    const card = gameState.remaining[i];
    if (!seen.has(card.key) && card.displayName.toLowerCase().includes(query)) {
      seen.add(card.key);
      matches.push({ card, key: card.key });
    }
    if (matches.length >= 8) break;
  }

  if (matches.length === 0) {
    gameToolsSearchResults.innerHTML = `<p class="game-search-empty">No matches in remaining library.</p>`;
    return;
  }

  const list = document.createElement("div");
  list.addEventListener("click", handleSearchResultItemAction);
  for (const { card } of matches) {
    const item = document.createElement("div");
    item.className = "game-search-result-item";
    item.innerHTML = `
      <div class="game-deck-item-row">
        <span class="game-search-result-name">${escapeHtml(card.displayName)}</span>
        <span class="game-deck-view-type">${escapeHtml(card.type)}</span>
      </div>
      <div class="game-deck-item-actions">
        <button class="game-deck-action-btn" data-action="planeswalk" data-key="${escapeHtml(card.key)}" title="Planeswalk to this card" type="button">▶</button>
        <button class="game-deck-action-btn" data-action="active" data-key="${escapeHtml(card.key)}" title="Add to active cards" type="button">+</button>
        <button class="game-deck-action-btn" data-action="top" data-key="${escapeHtml(card.key)}" title="Put on top of library" type="button">↑</button>
        <button class="game-deck-action-btn" data-action="bottom" data-key="${escapeHtml(card.key)}" title="Put on bottom of library" type="button">↓</button>
        <button class="game-deck-action-btn game-deck-action-exile" data-action="exile" data-key="${escapeHtml(card.key)}" title="Exile (remove temporarily)" type="button">✕</button>
      </div>
    `;
    list.appendChild(item);
  }
  gameToolsSearchResults.appendChild(list);
}

function handleLibraryItemAction(event) {
  if (!gameState) return;
  const btn = event.target.closest("[data-action][data-idx]");
  if (!btn) return;
  event.stopPropagation();
  const action = btn.dataset.action;
  const idx = parseInt(btn.dataset.idx, 10);
  if (isNaN(idx) || idx < 0 || idx >= gameState.remaining.length) return;

  const card = gameState.remaining.splice(idx, 1)[0];

  switch (action) {
    case "planeswalk":
      gameState.remaining.push(...gameState.activePlanes);
      gameState.activePlanes = [card];
      gameState.focusedIndex = 0;
      showToastFn?.(`Planeswalked to ${card.displayName}.`);
      break;
    case "active":
      gameState.activePlanes.push(card);
      showToastFn?.(`${card.displayName} added simultaneously.`);
      break;
    case "top":
      gameState.remaining.unshift(card);
      showToastFn?.(`${card.displayName} put on top.`);
      break;
    case "bottom":
      gameState.remaining.push(card);
      showToastFn?.(`${card.displayName} put on bottom.`);
      break;
    case "exile":
      gameState.exiled.push(card);
      showToastFn?.(`${card.displayName} exiled.`);
      break;
  }

  updateGameView();
  renderGameLibraryView();
  syncGameToolsState(gameState.remaining.length);
}

function handleSearchResultItemAction(event) {
  if (!gameState) return;
  const btn = event.target.closest("[data-action][data-key]");
  if (!btn) return;
  event.stopPropagation();
  const action = btn.dataset.action;
  const key = btn.dataset.key;
  const idx = gameState.remaining.findIndex((c) => c.key === key);
  if (idx === -1) return;

  const card = gameState.remaining.splice(idx, 1)[0];

  switch (action) {
    case "planeswalk":
      gameState.remaining.push(...gameState.activePlanes);
      gameState.activePlanes = [card];
      gameState.focusedIndex = 0;
      showToastFn?.(`Planeswalked to ${card.displayName}.`);
      break;
    case "active":
      gameState.activePlanes.push(card);
      showToastFn?.(`${card.displayName} added simultaneously.`);
      break;
    case "top":
      gameState.remaining.unshift(card);
      showToastFn?.(`${card.displayName} put on top.`);
      break;
    case "bottom":
      gameState.remaining.push(card);
      showToastFn?.(`${card.displayName} put on bottom.`);
      break;
    case "exile":
      gameState.exiled.push(card);
      showToastFn?.(`${card.displayName} exiled.`);
      break;
  }

  updateGameView();
  updateGameSearchResults();
  syncGameToolsState(gameState.remaining.length);
}

function openRevealCards() {
  if (!gameState) return;
  if (revealedCards.length > 0) {
    showToastFn?.("Resolve the current reveal before revealing more cards.");
    gameRevealOverlay?.classList.remove("hidden");
    closeAllGameMenus();
    return;
  }
  const countStr = gameRevealCountInput?.value.trim();
  const count = parseInt(countStr, 10);
  if (!count || count < 1) {
    showToastFn?.("Enter a number of cards to reveal.");
    return;
  }
  if (gameState.remaining.length === 0) {
    showToastFn?.("No cards remaining in library.");
    return;
  }
  const actualCount = Math.min(count, gameState.remaining.length);
  revealedCards = gameState.remaining.splice(0, actualCount);
  if (gameRevealCountInput) gameRevealCountInput.value = "";
  if (gameRevealInputRow) gameRevealInputRow.classList.add("hidden");
  closeAllGameMenus();
  renderRevealCards();
  updateRevealFooter();
  gameRevealOverlay?.classList.remove("hidden");
}

function closeRevealOverlay() {
  if (revealedCards.length > 0 && gameState) {
    gameState.remaining.push(...revealedCards);
    gameState.remaining = shuffleArray(gameState.remaining);
    revealedCards = [];
    showToastFn?.("Remaining revealed cards shuffled back into library.");
    updateGameView();
  }
  gameRevealOverlay?.classList.add("hidden");
}

function renderRevealCards() {
  if (!gameRevealCardsContainer) return;
  gameRevealCardsContainer.innerHTML = "";
  if (gameRevealTitleCount) gameRevealTitleCount.textContent = revealedCards.length;

  if (revealedCards.length === 0) {
    gameRevealCardsContainer.innerHTML = `<p class="game-reveal-empty">All cards have been resolved.</p>`;
    updateRevealFooter();
    return;
  }

  const isGallery = revealViewMode === "gallery";

  for (let i = 0; i < revealedCards.length; i++) {
    const card = revealedCards[i];
    const item = document.createElement("div");

    if (isGallery) {
      item.className = "game-reveal-gallery-item";
      item.innerHTML = `
        <img class="game-reveal-thumb" src="${card.thumbPath}" alt="${escapeHtml(card.displayName)}" />
        <div class="game-reveal-card-name">${escapeHtml(card.displayName)}</div>
        <div class="game-reveal-card-type">${escapeHtml(card.type)}</div>
        <div class="game-reveal-card-actions">
          <button class="game-reveal-action-btn" data-action="planeswalk" data-reveal-idx="${i}" title="Planeswalk to this card" type="button">▶ Planeswalk</button>
          <button class="game-reveal-action-btn" data-action="active" data-reveal-idx="${i}" title="Add to active cards" type="button">+ Active</button>
          <button class="game-reveal-action-btn" data-action="top" data-reveal-idx="${i}" title="Put on top of library" type="button">↑ Top</button>
          <button class="game-reveal-action-btn" data-action="bottom" data-reveal-idx="${i}" title="Put on bottom of library" type="button">↓ Bottom</button>
          <button class="game-reveal-action-btn game-reveal-action-exile" data-action="exile" data-reveal-idx="${i}" title="Exile (remove temporarily)" type="button">✕ Exile</button>
        </div>
      `;
    } else {
      item.className = "game-reveal-list-item";
      item.innerHTML = `
        <div class="game-reveal-list-info">
          <span class="game-reveal-list-name">${escapeHtml(card.displayName)}</span>
          <span class="game-reveal-list-type">${escapeHtml(card.type)}</span>
        </div>
        <div class="game-reveal-card-actions game-reveal-list-actions">
          <button class="game-reveal-action-btn" data-action="planeswalk" data-reveal-idx="${i}" title="Planeswalk to this card" type="button">▶</button>
          <button class="game-reveal-action-btn" data-action="active" data-reveal-idx="${i}" title="Add to active cards" type="button">+</button>
          <button class="game-reveal-action-btn" data-action="top" data-reveal-idx="${i}" title="Put on top of library" type="button">↑</button>
          <button class="game-reveal-action-btn" data-action="bottom" data-reveal-idx="${i}" title="Put on bottom of library" type="button">↓</button>
          <button class="game-reveal-action-btn game-reveal-action-exile" data-action="exile" data-reveal-idx="${i}" title="Exile (remove temporarily)" type="button">✕</button>
        </div>
      `;
    }

    item.addEventListener("click", handleRevealCardAction);
    gameRevealCardsContainer.appendChild(item);
  }
}

function handleRevealCardAction(event) {
  if (!gameState) return;
  const btn = event.target.closest("[data-action][data-reveal-idx]");
  if (!btn) return;
  const action = btn.dataset.action;
  const revealIdx = parseInt(btn.dataset.revealIdx, 10);
  if (isNaN(revealIdx) || revealIdx < 0 || revealIdx >= revealedCards.length) return;

  const card = revealedCards.splice(revealIdx, 1)[0];

  switch (action) {
    case "planeswalk":
      gameState.remaining.push(...gameState.activePlanes);
      gameState.activePlanes = [card];
      gameState.focusedIndex = 0;
      showToastFn?.(`Planeswalked to ${card.displayName}.`);
      break;
    case "active":
      gameState.activePlanes.push(card);
      showToastFn?.(`${card.displayName} added simultaneously.`);
      break;
    case "top":
      gameState.remaining.unshift(card);
      showToastFn?.(`${card.displayName} put on top.`);
      break;
    case "bottom":
      gameState.remaining.push(card);
      showToastFn?.(`${card.displayName} put on bottom.`);
      break;
    case "exile":
      gameState.exiled.push(card);
      showToastFn?.(`${card.displayName} exiled.`);
      break;
  }

  updateGameView();
  renderRevealCards();
  updateRevealFooter();
}

function handleRevealBulkAction(action) {
  if (!gameState) return;
  if (revealedCards.length === 0) {
    gameRevealOverlay?.classList.add("hidden");
    return;
  }
  const count = revealedCards.length;
  switch (action) {
    case "shuffle":
      gameState.remaining.push(...revealedCards);
      gameState.remaining = shuffleArray(gameState.remaining);
      showToastFn?.(`${count} card(s) shuffled back into library.`);
      break;
    case "top":
      gameState.remaining.unshift(...revealedCards);
      showToastFn?.(`${count} card(s) put on top of library.`);
      break;
    case "bottom":
      gameState.remaining.push(...revealedCards);
      showToastFn?.(`${count} card(s) put on bottom of library.`);
      break;
    case "exile":
      gameState.exiled.push(...revealedCards);
      showToastFn?.(`${count} card(s) exiled.`);
      break;
  }
  revealedCards = [];
  gameRevealOverlay?.classList.add("hidden");
  updateGameView();
}

function updateRevealFooter() {
  const hasCards = revealedCards.length > 0;
  if (gameRevealShuffleIn) gameRevealShuffleIn.disabled = !hasCards;
  if (gameRevealTopAll) gameRevealTopAll.disabled = !hasCards;
  if (gameRevealBottomAll) gameRevealBottomAll.disabled = !hasCards;
  if (gameRevealExileAll) gameRevealExileAll.disabled = !hasCards;
}

function setRevealViewMode(mode) {
  revealViewMode = mode;
  gameRevealCardsContainer?.classList.toggle("game-reveal-mode-gallery", mode === "gallery");
  gameRevealCardsContainer?.classList.toggle("game-reveal-mode-list", mode === "list");
  if (gameRevealListBtn) gameRevealListBtn.classList.toggle("active", mode === "list");
  if (gameRevealGalleryBtn) gameRevealGalleryBtn.classList.toggle("active", mode === "gallery");
  renderRevealCards();
}

function toggleGameToolsMenu() {
  const isHidden = gameToolsMenu?.classList.contains("hidden");
  closeAllGameMenus();
  if (isHidden) {
    gameToolsMenu?.classList.remove("hidden");
    gameMenuSearchSection?.classList.add("hidden");
    gameRevealInputRow?.classList.add("hidden");
    if (gameLibraryToggle) gameLibraryToggle.textContent = "Search & View Library";
    if (gameToolsSearchInput) gameToolsSearchInput.value = "";
    if (gameToolsSearchResults) gameToolsSearchResults.innerHTML = "";
    syncGameToolsState(gameState?.remaining.length ?? 0);
  }
}

function toggleGameOptionsMenu() {
  const isHidden = gameOptionsMenu?.classList.contains("hidden");
  closeAllGameMenus();
  if (isHidden) gameOptionsMenu?.classList.remove("hidden");
}

function closeAllGameMenus() {
  gameToolsMenu?.classList.add("hidden");
  gameOptionsMenu?.classList.add("hidden");
}

// ── Tutorial overlay ──────────────────────────────────────────────────────────

const TUTORIAL_CONTENT = {
  classic: {
    title: "⚔ Classic Planechase",
    body: `
<h3>Welcome to Planechase!</h3>
<p>In Planechase, players journey across the planes of the Multiverse using a shared deck of <strong>Plane</strong> and <strong>Phenomenon</strong> cards.</p>

<h3>Starting the Game</h3>
<p>Reveal cards from the top of your planar deck until a Plane is revealed. That Plane becomes active. The rest are placed on the bottom in any order.</p>

<h3>Rolling the Planar Die</h3>
<p>On your turn, you may roll the planar die at any time. Each additional roll on the same turn costs {1} more than the last (first roll is free, second costs {1}, third costs {2}, etc.).</p>
<ul>
  <li><strong>BLANK</strong> — Nothing happens.</li>
  <li><strong>CHAOS</strong> — The chaos ability of each face-up Plane triggers.</li>
  <li><strong>PLANESWALKER</strong> — Planeswalk! The active Plane goes to the bottom of the deck. Reveal cards until a Plane is revealed — that Plane becomes active.</li>
</ul>

<h3>Phenomena</h3>
<p>When you would planeswalk to a Phenomenon, its triggered ability triggers immediately. Then planeswalk again until you reveal a Plane. Phenomena never stay active — they always lead to another Plane.</p>

<h3>Controls</h3>
<ul>
  <li>Tap the <strong>card image</strong> to view it up close.</li>
  <li>Use the <strong>Planeswalk button</strong> (PLANESWALKER icon) to planeswalk.</li>
  <li>Use the <strong>Planar Die button</strong> (CHAOS icon) to roll.</li>
  <li>The <strong>Tools</strong> menu lets you manage the library and reveal cards.</li>
  <li>The <strong>Options</strong> menu lets you exit, reset, or save the game state.</li>
</ul>
`
  },
  bem: {
    title: "✦ Blind Eternities Map",
    body: `
<h3>Welcome to the Blind Eternities Map!</h3>
<p>The Blind Eternities Map is a spatial Planechase variant. Planes are arranged in a living grid — navigate it like an explorer charting unknown territory.</p>

<h3>The Grid</h3>
<p>You start at the center of a 3×3 grid of planes. As you move, the map expands and distant planes cycle back into the deck.</p>
<ul>
  <li><strong>Face-up cards</strong> (N/S/E/W neighbors) are visible planes you can move to.</li>
  <li><strong>Face-down cards</strong> (diagonal corners) are unknown — reachable only by Hellriding.</li>
</ul>

<h3>Moving</h3>
<p>Press the <strong>Planeswalk button</strong> to enter movement mode, then click/tap a highlighted neighbor to move there. Orthogonal moves reveal the card as you arrive. In <em>Easy Planeswalking</em> mode, just tap a neighbor to move instantly.</p>

<h3>Hellriding</h3>
<p>To Hellride, enter movement mode and click/tap a face-down diagonal card. You venture into the unknown! There is a chance you'll encounter a <strong>Phenomenon</strong> before arriving at your destination, adding to the mystery.</p>

<h3>Phenomena</h3>
<p>When you land on a Phenomenon, the <strong>Planeswalk button</strong> changes — press it to resolve the Phenomenon and reveal the next plane beneath.</p>

<h3>The Planar Die</h3>
<p>Roll the die on your turn (first roll is free, each additional roll costs {1} more). The same Chaos and Planeswalk rules apply as in Classic mode.</p>

<h3>Controls</h3>
<ul>
  <li>Tap the <strong>Planeswalk button</strong> to enter/cancel movement mode.</li>
  <li>Tap any face-up card to view its details.</li>
  <li>The <strong>Tools</strong> and <strong>Options</strong> menus work the same as in Classic mode.</li>
</ul>
`
  }
};

function maybeShowTutorial(mode, callback) {
  const key = mode === "bem" ? TUTORIAL_BEM_KEY : TUTORIAL_CLASSIC_KEY;
  let seen = false;
  try { seen = !!localStorage.getItem(key); } catch { /* ignore */ }

  if (seen) {
    callback();
    return;
  }

  pendingGameMode = mode;
  showTutorial(mode);
}

function showTutorial(mode) {
  const content = TUTORIAL_CONTENT[mode];
  if (!content || !gameTutorialOverlay) return;

  if (gameTutorialTitle) gameTutorialTitle.textContent = content.title;
  if (gameTutorialBody) gameTutorialBody.innerHTML = content.body;

  gameTutorialOverlay.classList.remove("hidden");
  document.body.classList.add("tutorial-open");
}

function hideTutorial() {
  gameTutorialOverlay?.classList.add("hidden");
  document.body.classList.remove("tutorial-open");

  const key = pendingGameMode === "bem" ? TUTORIAL_BEM_KEY : TUTORIAL_CLASSIC_KEY;
  try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
}

export function clearTutorialFlags() {
  try {
    localStorage.removeItem(TUTORIAL_CLASSIC_KEY);
    localStorage.removeItem(TUTORIAL_BEM_KEY);
  } catch { /* ignore */ }
}

export function isGameActive() {
  return gameActive;
}

export function syncGameHash() {
  if (window.location.hash === "#play") {
    if (!gameActive && getDeckTotal() > 0) startGame();
  } else {
    if (gameActive) exitGame({ updateHash: false });
  }
}

// ── Blind Eternities Map (BEM) ────────────────────────────────────────────────

function bemKey(x, y) {
  return `${x},${y}`;
}

function bemDrawNonPhenomenon(remaining) {
  let attempts = 0;
  while (remaining.length > 0 && attempts < remaining.length) {
    const card = remaining.shift();
    if (card.type !== "Phenomenon") return card;
    remaining.push(card);
    attempts++;
  }
  if (remaining.length > 0) return remaining.shift();
  return null;
}

function startBemGame() {
  const total = getDeckTotal();
  if (total === 0) { showToastFn?.("Add cards to your deck first."); return; }

  const shuffled = shuffleArray(buildDeckArray());

  const bemGrid = new Map();
  const positions = [
    { dx: 0, dy: 0, faceUp: true },
    { dx: 1, dy: 0, faceUp: true },
    { dx: -1, dy: 0, faceUp: true },
    { dx: 0, dy: 1, faceUp: true },
    { dx: 0, dy: -1, faceUp: true },
    { dx: 1, dy: 1, faceUp: false },
    { dx: -1, dy: 1, faceUp: false },
    { dx: 1, dy: -1, faceUp: false },
    { dx: -1, dy: -1, faceUp: false }
  ];

  for (const { dx, dy, faceUp } of positions) {
    if (shuffled.length === 0) break;
    let card;
    if (faceUp) {
      card = bemDrawNonPhenomenon(shuffled);
    } else {
      card = shuffled.shift();
    }
    if (card) bemGrid.set(bemKey(dx, dy), { card, faceUp });
  }

  gameState = {
    mode: "bem",
    remaining: shuffled,
    exiled: [],
    chaosCost: 0,
    dieRolling: false,
    _dieResetTimer: null,
    activePlanes: [],
    focusedIndex: 0,
    bemGrid,
    bemPos: { x: 0, y: 0 }
  };

  gameActive = true;
  closeDeckPanel();
  document.body.classList.add("game-open");
  gameView?.classList.remove("hidden");
  gameView?.classList.add("bem-active");
  bemMapArea?.classList.remove("hidden");
  resetDieIcon();
  updateCostDisplay();
  renderBemMap();
  updateBemInfoBar();
  syncBemTrButton();

  if (window.location.hash !== "#play") {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}#play`);
  }

  showToastFn?.("Blind Eternities Map started. Click adjacent cards to move.");
}

function bemDiscoverAdjacent() {
  const { bemGrid, bemPos, remaining } = gameState;
  const { x: px, y: py } = bemPos;

  const dirs = [
    { dx: 0, dy: -1, faceUp: true },
    { dx: 0, dy: 1, faceUp: true },
    { dx: -1, dy: 0, faceUp: true },
    { dx: 1, dy: 0, faceUp: true },
    { dx: -1, dy: -1, faceUp: false },
    { dx: 1, dy: -1, faceUp: false },
    { dx: -1, dy: 1, faceUp: false },
    { dx: 1, dy: 1, faceUp: false }
  ];

  for (const { dx, dy, faceUp } of dirs) {
    const nx = px + dx;
    const ny = py + dy;
    const key = bemKey(nx, ny);
    if (!bemGrid.has(key) && remaining.length > 0) {
      let card;
      if (faceUp) {
        card = bemDrawNonPhenomenon(remaining);
      } else {
        card = remaining.shift();
      }
      if (card) bemGrid.set(key, { card, faceUp });
    }
  }
}

function bemRemoveFalloff() {
  const { bemGrid, bemPos, remaining } = gameState;
  const { x: px, y: py } = bemPos;

  for (const [key, cell] of [...bemGrid.entries()]) {
    const [cx, cy] = key.split(",").map(Number);
    const dist = Math.max(Math.abs(cx - px), Math.abs(cy - py));
    if (dist > BEM_FALLOFF_DIST) {
      bemGrid.delete(key);
      remaining.push(cell.card);
    }
  }
}

function bemMovePlayer(nx, ny) {
  if (!gameState?.bemGrid || !gameState?.bemPos) return;

  const { bemGrid, bemPos } = gameState;
  const { x: px, y: py } = bemPos;
  const dx = nx - px;
  const dy = ny - py;

  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return;
  if (dx === 0 && dy === 0) return;

  const isDiag = Math.abs(dx) === 1 && Math.abs(dy) === 1;
  const key = bemKey(nx, ny);
  const cell = bemGrid.get(key);

  if (!cell) return;

  if (isDiag) {
    if (cell.faceUp) {
      showToastFn?.("Can only Hellride to a face-down diagonal card.");
      return;
    }

    // 66.6% chance to encounter a phenomenon before the destination card
    // (only if the destination card is not already a phenomenon)
    const originalCard = cell.card;
    if (originalCard.type !== "Phenomenon") {
      const phenIdx = gameState.remaining.findIndex(c => c.type === "Phenomenon");
      if (phenIdx !== -1 && Math.random() < 2 / 3) {
        const [phenomenon] = gameState.remaining.splice(phenIdx, 1);
        cell.card = phenomenon;
        cell.queuedCard = originalCard;
      }
    }

    cell.faceUp = true;
    showToastFn?.(`Hellriding!`);
  } else {
    // Orthogonal: auto-flip face-down cards
    if (!cell.faceUp) cell.faceUp = true;
    showToastFn?.(`Moving to ${cell.card.displayName}.`);
  }

  gameState.bemPos = { x: nx, y: ny };

  // Auto-flip any orthogonal adjacent face-down cards at new position
  const orthDirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  for (const { dx: odx, dy: ody } of orthDirs) {
    const adjCell = bemGrid.get(bemKey(nx + odx, ny + ody));
    if (adjCell && !adjCell.faceUp) adjCell.faceUp = true;
  }

  bemPlaneswalkPending = false;
  bemRemoveFalloff();
  bemDiscoverAdjacent();

  renderBemMap();
  updateBemInfoBar();
  syncBemTrButton();
  closeAllGameMenus();
}

function bemResolvePhenomenon() {
  if (!gameState?.bemGrid || !gameState?.bemPos) return;

  const { bemGrid, bemPos, remaining } = gameState;
  const key = bemKey(bemPos.x, bemPos.y);
  const cell = bemGrid.get(key);

  if (!cell || cell.card.type !== "Phenomenon") {
    showToastFn?.("No phenomenon to resolve here.");
    return;
  }

  const phenomenon = cell.card;

  // If this phenomenon was encountered via hellride, the original card is queued
  const nextCard = cell.queuedCard ?? bemDrawNonPhenomenon(remaining);
  delete cell.queuedCard;

  remaining.push(phenomenon);

  if (nextCard) {
    bemGrid.set(key, { card: nextCard, faceUp: true });
    showToastFn?.(`${phenomenon.displayName} resolved. ${nextCard.displayName} appears.`);
  } else {
    bemGrid.delete(key);
    showToastFn?.(`${phenomenon.displayName} resolved. Library is empty.`);
  }

  renderBemMap();
  updateBemInfoBar();
  syncBemTrButton();
}

function syncBemTrButton() {
  if (!gameBtnTr) return;
  const isBem = gameState?.mode === "bem";
  const isPhenomenon = isBem && gameState.bemGrid?.get(bemKey(gameState.bemPos.x, gameState.bemPos.y))?.card?.type === "Phenomenon";

  gameBtnTr.classList.toggle("bem-phenomenon-active", !!isPhenomenon);
  gameBtnTr.classList.toggle("bem-planeswalk-pending", !!(isBem && bemPlaneswalkPending));
  gameBtnTr.setAttribute("aria-label", isBem
    ? (isPhenomenon ? "Resolve Phenomenon" : bemPlaneswalkPending ? "Cancel Planeswalk" : "Planeswalk")
    : "Planeswalk");
}

function getBemDirLabel(dx, dy) {
  if (dx === 0 && dy === -1) return "N";
  if (dx === 0 && dy === 1) return "S";
  if (dx === -1 && dy === 0) return "W";
  if (dx === 1 && dy === 0) return "E";
  if (dx === -1 && dy === -1) return "NW";
  if (dx === 1 && dy === -1) return "NE";
  if (dx === -1 && dy === 1) return "SW";
  if (dx === 1 && dy === 1) return "SE";
  return "";
}

function renderBemMap() {
  if (!bemMapEl || !gameState?.bemGrid || !gameState?.bemPos) return;

  const { bemGrid, bemPos } = gameState;
  const { x: px, y: py } = bemPos;

  bemMapEl.innerHTML = "";

  const R = BEM_VIEW_RADIUS;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const cx = px + dx;
      const cy = py + dy;
      const key = bemKey(cx, cy);
      const cell = bemGrid.get(key);

      const div = document.createElement("div");
      div.style.gridColumn = (dx + R + 1).toString();
      div.style.gridRow = (dy + R + 1).toString();
      div.className = "bem-cell";
      div.dataset.x = cx;
      div.dataset.y = cy;

      const isPlayer = dx === 0 && dy === 0;
      const isDiag = Math.abs(dx) === 1 && Math.abs(dy) === 1;
      const isOrthog = (Math.abs(dx) + Math.abs(dy)) === 1;

      // Planeswalk pending glow
      if (bemPlaneswalkPending && !isPlayer) {
        if (isOrthog && cell?.faceUp) div.classList.add("bem-cell-planeswalk-glow");
        else if (isDiag && cell && !cell.faceUp) div.classList.add("bem-cell-hellride-glow");
      }

      if (!cell) {
        div.classList.add(isPlayer ? "bem-cell-faceup" : "bem-cell-void");
        if (isPlayer) div.classList.add("bem-cell-player");
      } else if (cell.faceUp) {
        div.classList.add("bem-cell-faceup");

        const img = document.createElement("img");
        img.className = "bem-cell-img";
        img.src = cell.card.thumbPath;
        img.alt = cell.card.displayName;
        div.appendChild(img);

        const lbl = document.createElement("div");
        lbl.className = "bem-cell-label";
        lbl.textContent = cell.card.displayName;
        div.appendChild(lbl);

        if (isPlayer) {
          div.classList.add("bem-cell-player");
          if (cell.card.type === "Phenomenon") {
            div.classList.add("bem-cell-phenomenon");
          } else {
            div.classList.add("bem-cell-active-plane");
          }
        } else if (isOrthog) {
          if (!bemPlaneswalkPending) div.classList.add("bem-cell-moveable");
          const hint = document.createElement("span");
          hint.className = "bem-cell-dir-hint";
          hint.textContent = getBemDirLabel(dx, dy);
          div.appendChild(hint);
        }
      } else {
        div.classList.add("bem-cell-facedown");

        const img = document.createElement("img");
        img.className = "bem-cell-img";
        img.src = BEM_FACEDOWN_IMG;
        img.alt = "Face-down card";
        div.appendChild(img);

        if (isDiag) {
          if (!bemPlaneswalkPending) div.classList.add("bem-cell-hellride");
          const hint = document.createElement("span");
          hint.className = "bem-cell-hellride-hint";
          hint.textContent = "⚡";
          div.appendChild(hint);
        }
      }

      bemMapEl.appendChild(div);
    }
  }
}

function updateBemInfoBar() {
  if (!gameState?.bemGrid || !gameState?.bemPos) return;

  const cell = gameState.bemGrid.get(bemKey(gameState.bemPos.x, gameState.bemPos.y));
  const card = cell?.card;

  if (bemCardNameLabel) {
    bemCardNameLabel.textContent = card ? card.displayName : "";
  }

  if (bemStatusLabel) {
    if (card?.type === "Phenomenon") {
      bemStatusLabel.textContent = "⚡ Phenomenon — press Planeswalk to resolve";
    } else {
      const remaining = gameState.remaining.length;
      bemStatusLabel.textContent = `${remaining} card${remaining !== 1 ? "s" : ""} left`;
    }
  }

  syncGameToolsState(gameState.remaining.length);
}

function handleBemCellClick(event) {
  if (!gameState || gameState.mode !== "bem") return;
  if (bemDragHandled) {
    bemDragHandled = false;
    return;
  }
  const cell = event.target.closest(".bem-cell");
  if (!cell) return;

  const nx = parseInt(cell.dataset.x, 10);
  const ny = parseInt(cell.dataset.y, 10);
  if (isNaN(nx) || isNaN(ny)) return;

  const { x: px, y: py } = gameState.bemPos;
  const dx = nx - px;
  const dy = ny - py;

  if (dx === 0 && dy === 0) {
    // Current player cell → view card detail
    const gridCell = gameState.bemGrid.get(bemKey(nx, ny));
    if (gridCell?.card) openGameReaderView(gridCell.card, buildBemCardActions());
    return;
  }

  if (bemPlaneswalkPending) {
    // In planeswalk mode: click a glowing cell to move there
    const isOrthog = (Math.abs(dx) + Math.abs(dy)) === 1;
    const isDiag = Math.abs(dx) === 1 && Math.abs(dy) === 1;
    const gridCell = gameState.bemGrid.get(bemKey(nx, ny));
    if ((isOrthog && gridCell?.faceUp) || (isDiag && gridCell && !gridCell.faceUp)) {
      bemMovePlayer(nx, ny);
    } else {
      // Cancel planeswalk mode on clicking non-valid cell
      bemPlaneswalkPending = false;
      renderBemMap();
    }
    return;
  }

  if (easyPlaneswalk) {
    // Easy mode: shift/alt-click for detail view; tap/click to planeswalk (if valid move)
    if (event.shiftKey || event.altKey) {
      const gridCell = gameState.bemGrid.get(bemKey(nx, ny));
      if (gridCell?.card && gridCell.faceUp) openGameReaderView(gridCell.card, buildBemAdjacentCardActions(nx, ny));
      return;
    }
    // Only planeswalk if it's a valid move (adjacent cell)
    const isValidMove = (Math.abs(dx) + Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 1);
    if (isValidMove) {
      bemMovePlayer(nx, ny);
    }
    return;
  }

  // Normal mode: click any face-up card to view details
  const gridCell = gameState.bemGrid.get(bemKey(nx, ny));
  if (gridCell?.card && gridCell.faceUp) {
    openGameReaderView(gridCell.card, buildBemAdjacentCardActions(nx, ny));
  }
}

function toggleBemPlaneswalkMode() {
  if (!gameState?.bemGrid) return;
  bemPlaneswalkPending = !bemPlaneswalkPending;
  renderBemMap();
  syncBemTrButton();
  if (bemPlaneswalkPending) {
    showToastFn?.("Choose an adjacent card to planeswalk to.");
  }
}

// ── BEM drag navigation ───────────────────────────────────────────────────────

function handleBemPointerDown(event) {
  if (!gameState?.bemGrid) return;
  if (bemDragPointerId !== null) return;
  bemDragPointerId = event.pointerId;
  bemDragStart = { x: event.clientX, y: event.clientY };
  bemDragHandled = false;
  try { bemMapArea?.setPointerCapture(event.pointerId); } catch { /* ignore */ }
}

function handleBemPointerMove(event) {
  if (event.pointerId !== bemDragPointerId || !bemDragStart || !gameState?.bemGrid) return;
  const dx = event.clientX - bemDragStart.x;
  const dy = event.clientY - bemDragStart.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < BEM_DRAG_THRESHOLD && ady < BEM_DRAG_THRESHOLD) return;

  bemDragHandled = true;
  bemDragPointerId = null;
  bemDragStart = null;

  let moveDx = 0;
  let moveDy = 0;
  if (adx >= ady) {
    moveDx = dx > 0 ? 1 : -1;
  } else {
    moveDy = dy > 0 ? 1 : -1;
  }
  const { x: px, y: py } = gameState.bemPos;
  bemMovePlayer(px + moveDx, py + moveDy);
}

function handleBemPointerUp(event) {
  if (event.pointerId === bemDragPointerId) {
    bemDragPointerId = null;
    bemDragStart = null;
  }
}

function buildBemCardActions() {
  return [
    {
      label: "Return to Library",
      action: () => {
        if (!gameState?.bemGrid || !gameState?.bemPos) return;
        const key = bemKey(gameState.bemPos.x, gameState.bemPos.y);
        const cell = gameState.bemGrid.get(key);
        if (!cell) return;
        gameState.remaining.push(cell.card);
        gameState.bemGrid.delete(key);
        closeGameReaderView();
        renderBemMap();
        updateBemInfoBar();
        syncBemTrButton();
        showToastFn?.(`${cell.card.displayName} returned to library.`);
      }
    },
    {
      label: "Return to Top",
      action: () => {
        if (!gameState?.bemGrid || !gameState?.bemPos) return;
        const key = bemKey(gameState.bemPos.x, gameState.bemPos.y);
        const cell = gameState.bemGrid.get(key);
        if (!cell) return;
        gameState.remaining.unshift(cell.card);
        gameState.bemGrid.delete(key);
        closeGameReaderView();
        renderBemMap();
        updateBemInfoBar();
        syncBemTrButton();
        showToastFn?.(`${cell.card.displayName} returned to top.`);
      }
    },
    {
      label: "Return to Bottom",
      action: () => {
        if (!gameState?.bemGrid || !gameState?.bemPos) return;
        const key = bemKey(gameState.bemPos.x, gameState.bemPos.y);
        const cell = gameState.bemGrid.get(key);
        if (!cell) return;
        gameState.remaining.push(cell.card);
        gameState.bemGrid.delete(key);
        closeGameReaderView();
        renderBemMap();
        updateBemInfoBar();
        syncBemTrButton();
        showToastFn?.(`${cell.card.displayName} returned to bottom.`);
      }
    },
    {
      label: "Shuffle Into Library",
      action: () => {
        if (!gameState?.bemGrid || !gameState?.bemPos) return;
        const key = bemKey(gameState.bemPos.x, gameState.bemPos.y);
        const cell = gameState.bemGrid.get(key);
        if (!cell) return;
        gameState.remaining.push(cell.card);
        gameState.remaining = shuffleArray(gameState.remaining);
        gameState.bemGrid.delete(key);
        closeGameReaderView();
        renderBemMap();
        updateBemInfoBar();
        syncBemTrButton();
        showToastFn?.(`${cell.card.displayName} shuffled into library.`);
      }
    },
    {
      label: "Exile",
      danger: true,
      action: () => {
        if (!gameState?.bemGrid || !gameState?.bemPos) return;
        const key = bemKey(gameState.bemPos.x, gameState.bemPos.y);
        const cell = gameState.bemGrid.get(key);
        if (!cell) return;
        gameState.exiled.push(cell.card);
        gameState.bemGrid.delete(key);
        closeGameReaderView();
        renderBemMap();
        updateBemInfoBar();
        syncBemTrButton();
        showToastFn?.(`${cell.card.displayName} exiled.`);
      }
    }
  ];
}

function buildBemAdjacentCardActions(nx, ny) {
  return [
    {
      label: "Planeswalk Here",
      action: () => {
        closeGameReaderView();
        bemMovePlayer(nx, ny);
      }
    }
  ];
}
