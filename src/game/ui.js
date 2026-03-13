// ── game-ui.js ────────────────────────────────────────────────────────────────
// Shared game UI rendering: card reader view, reveal overlay, library view,
// game menus, die rolling, cost display, BEM zoom, and tutorial overlay.

import { escapeHtml, shuffleArray, enhanceManaSymbols, syncPlanechaseImageOrientation } from "../gallery/utils.js";
import { updateClassicGameView, renderClassicSidePanel, buildMainCardActions } from "./classic.js";
import {
  syncBemTrButton,
  renderBemMap,
  updateBemInfoBar,
  bemFillPlaceholder,
  bemResolvePhenomenon,
  toggleBemPlaneswalkMode,
  bemKey,
  buildBemCardActions,
  buildBemSideCardActions,
} from "./bem.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const BEM_ZOOM_KEY = "planar-atlas-bem-zoom-v1";
const TUTORIAL_CLASSIC_KEY = "planar-atlas-tutorial-classic-v1";
const TUTORIAL_BEM_KEY = "planar-atlas-tutorial-bem-v1";

// ── Module state ──────────────────────────────────────────────────────────────

let revealedCards = [];
let revealViewMode = "list";
let readerOpenedFromReveal = false;
let readerOpenedFromLibrary = false;
let readerOpenedFromExile = false;

syncPlanechaseImageOrientation(gameCardImage);
syncPlanechaseImageOrientation(gameReaderImage);
syncPlanechaseImageOrientation(gameReaderZoomImg);
let exileViewMode = "list";
let libraryViewMode = "list";
let readerCardPath = "";
let bemZoomLevel = "default";
let pendingGameMode = null;
const readerTranscriptCache = new Map();

// ── Context (set by initGameUI) ───────────────────────────────────────────────

let ctx = null;

// ── DOM references ────────────────────────────────────────────────────────────

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
const gameToolsUndo = document.getElementById("game-tools-undo");
const gameToolsRedo = document.getElementById("game-tools-redo");
const gameToolsShuffle = document.getElementById("game-tools-shuffle");
const gameToolsAddTop = document.getElementById("game-tools-add-top");
const gameToolsAddBottom = document.getElementById("game-tools-add-bottom");
const gameLibraryToggle = document.getElementById("game-tools-library-toggle");
const gameLibraryOverlay = document.getElementById("game-library-overlay");
const gameLibraryBackdrop = document.getElementById("game-library-backdrop");
const gameLibraryCardsContainer = document.getElementById("game-library-cards-container");
const gameLibraryClose = document.getElementById("game-library-close");
const gameLibraryTitleCount = document.getElementById("game-library-title-count");
const gameLibraryListBtn = document.getElementById("game-library-list-btn");
const gameLibraryGalleryBtn = document.getElementById("game-library-gallery-btn");
const gameLibrarySearchInput = document.getElementById("game-library-search-input");
const gameCostValue = document.getElementById("game-cost-value");
const gameCostDisplay = document.getElementById("game-cost-display");
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
const gameToolsRevealToggle = document.getElementById("game-tools-reveal-toggle");
const gameTutorialOverlay = document.getElementById("game-tutorial-overlay");
const gameTutorialTitle = document.getElementById("game-tutorial-title");
const gameTutorialBody = document.getElementById("game-tutorial-body");
const gameTutorialClose = document.getElementById("game-tutorial-close");
const bemZoomSelect = document.getElementById("bem-zoom-select");
const diePlaneswalkerPopup = document.getElementById("die-planeswalk-popup");
const diePlaneswalkerBackdrop = document.getElementById("die-planeswalk-backdrop");
const diePlaneswalkerBtn = document.getElementById("die-planeswalk-btn");
const dieRemainBtn = document.getElementById("die-remain-btn");
const dieChaosPopup = document.getElementById("die-chaos-popup");
const dieChaosBackdrop = document.getElementById("die-chaos-backdrop");
const dieChaosCloseBtn = document.getElementById("die-chaos-close-btn");
const classicViewCardBtn = document.getElementById("classic-view-card-btn");
const gameExileOverlay = document.getElementById("game-exile-overlay");
const gameExileBackdrop = document.getElementById("game-exile-backdrop");
const gameExileCardsContainer = document.getElementById("game-exile-cards-container");
const gameExileClose = document.getElementById("game-exile-close");
const gameExileTitleCount = document.getElementById("game-exile-title-count");
const gameExileShuffleIn = document.getElementById("game-exile-shuffle-in");
const gameExileTopAll = document.getElementById("game-exile-top-all");
const gameExileBottomAll = document.getElementById("game-exile-bottom-all");
const gameExileListBtn = document.getElementById("game-exile-list-btn");
const gameExileGalleryBtn = document.getElementById("game-exile-gallery-btn");
const gameToolsExileToggle = document.getElementById("game-tools-exile-toggle");
const phenomenonBanner = document.getElementById("phenomenon-banner");

// ── State accessors (needed by game-state.js via context) ─────────────────────

/** @returns {object[]} The current revealed cards array. */
export function getRevealedCards() { return revealedCards; }

/** @param {object[]} cards - The new revealed cards array. */
export function setRevealedCards(cards) { revealedCards = cards; }

/** @param {boolean} value */
export function setReaderOpenedFromReveal(value) { readerOpenedFromReveal = value; }

// ── Initialization ────────────────────────────────────────────────────────────

/**
 * Initialises the game UI module with shared state and callbacks.
 * Binds all game-related DOM events.
 * @param {object} context - Shared context from deck.js.
 */
export function initGameUI(context) {
  ctx = context;
  bindGameUIEvents();
  loadBemZoom();
}

// ── Cost display ──────────────────────────────────────────────────────────────

/** Updates the chaos cost counter display. */
export function updateCostDisplay() {
  const gameState = ctx.getGameState();
  if (!gameState) return;
  const cost = gameState.chaosCost;
  if (gameCostValue) gameCostValue.textContent = cost;
  if (gameCostDisplay) gameCostDisplay.classList.toggle("game-cost-visible", cost > 0);
}

// ── Game view rendering ───────────────────────────────────────────────────────

/** Shows the placeholder card image when no active plane is present. */
export function showGamePlaceholder() {
  if (gameCardImage) {
    gameCardImage.src = "assets/card-preview.jpg";
    gameCardImage.alt = "Click to planeswalk";
  }
  if (gameSidePanel) gameSidePanel.innerHTML = "";
  if (gameCardImageBtn) {
    gameCardImageBtn.setAttribute("aria-label", "Planeswalk");
    gameCardImageBtn.classList.add("game-card-image-btn-placeholder");
    gameCardImageBtn.classList.remove("active-plane", "active-phenomenon");
  }
  if (classicViewCardBtn) classicViewCardBtn.classList.add("hidden");
  syncGameToolsState(ctx.getGameState()?.remaining.length ?? 0);
}

/** Updates the main game view based on the current game state. */
export function updateGameView() {
  const gameState = ctx.getGameState();
  if (!gameState) return;

  const { activePlanes, focusedIndex, remaining } = gameState;

  if (gameState.mode === "bem") {
    renderGameSidePanel(activePlanes, focusedIndex);
    syncGameToolsState(remaining.length);
    return;
  }

  const focused = activePlanes[focusedIndex] ?? activePlanes[0];

  if (!focused) {
    showGamePlaceholder();
    return;
  }

  updateClassicGameView(gameState);
}

/** Renders the game side panel (BEM simultaneous planes or Classic side panel). */
export function renderGameSidePanel(activePlanes, focusedIndex) {
  if (!gameSidePanel) return;
  gameSidePanel.innerHTML = "";

  const gameState = ctx.getGameState();
  const isBem = gameState?.mode === "bem";

  if (isBem) {
    if (activePlanes.length === 0) return;

    const cycleBtn = document.createElement("button");
    cycleBtn.type = "button";
    cycleBtn.className = "game-cycle-btn";
    cycleBtn.setAttribute("aria-label", "Cycle active planes");
    cycleBtn.innerHTML = `<span class="game-cycle-icon" aria-hidden="true">↻</span>`;
    cycleBtn.addEventListener("click", () => {
      const gs = ctx.getGameState();
      if (!gs?.bemGrid || !gs?.bemPos || !gs.activePlanes.length) return;
      ctx.pushGameHistory();
      const nextIdx = Math.max(0, gs.focusedIndex) % gs.activePlanes.length;
      const sideCard = gs.activePlanes[nextIdx];
      const key = bemKey(gs.bemPos.x, gs.bemPos.y);
      const cell = gs.bemGrid.get(key);
      if (cell?.card) {
        gs.activePlanes[nextIdx] = cell.card;
        cell.card = sideCard;
      } else if (cell) {
        gs.activePlanes.splice(nextIdx, 1);
        cell.card = sideCard;
        cell.placeholder = false;
      } else {
        gs.bemGrid.set(key, { card: sideCard, faceUp: true });
        gs.activePlanes.splice(nextIdx, 1);
      }
      gs.focusedIndex = gs.activePlanes.length > 0 ? (nextIdx + 1) % gs.activePlanes.length : 0;
      renderBemMap();
      updateBemInfoBar();
      syncBemTrButton();
      ctx.showToast(`${sideCard.displayName} is now the active plane.`);
    });
    gameSidePanel.appendChild(cycleBtn);

    for (let i = 0; i < activePlanes.length; i++) {
      const card = activePlanes[i];
      const idx = i;
      const sideCard = document.createElement("button");
      sideCard.type = "button";
      sideCard.className = "game-side-card" + (card.type === "Phenomenon" ? " game-side-card-phenomenon" : " game-side-card-plane");
      sideCard.setAttribute("aria-label", `View ${card.displayName} (opens card reader)`);
      sideCard.innerHTML = `
        <img class="game-side-card-img" src="${card.thumbPath}" alt="${escapeHtml(card.displayName)}" />
        <div class="game-side-card-label">${escapeHtml(card.displayName)}</div>
      `;
      sideCard.addEventListener("click", () => {
        if (!ctx.getGameState()) return;
        openGameReaderView(card, buildBemSideCardActions(idx));
      });
      gameSidePanel.appendChild(sideCard);
    }
    return;
  }

  renderClassicSidePanel(activePlanes, focusedIndex);
}

// ── Game tools state sync ─────────────────────────────────────────────────────

/**
 * Syncs the game tools menu button states and triggers an autosave.
 * @param {number} remainingCount - Number of cards left in the library.
 */
export function syncGameToolsState(remainingCount) {
  const gameState = ctx.getGameState();
  const isBem = gameState?.mode === "bem";
  if (gameToolsUndo) gameToolsUndo.disabled = ctx.getGameHistory().length === 0;
  if (gameToolsRedo) gameToolsRedo.disabled = ctx.getGameRedoStack().length === 0;
  if (gameToolsAddTop) {
    gameToolsAddTop.disabled = remainingCount === 0;
  }
  if (gameToolsAddBottom) {
    gameToolsAddBottom.disabled = remainingCount === 0;
  }
  if (gameToolsShuffle) gameToolsShuffle.disabled = !gameState;
  if (gameLibraryToggle) gameLibraryToggle.disabled = !gameState;
  if (gameToolsRevealToggle) gameToolsRevealToggle.disabled = !gameState;
  if (gameToolsExileToggle) {
    gameToolsExileToggle.disabled = !gameState;
    const exileCount = gameState?.exiled?.length ?? 0;
    gameToolsExileToggle.textContent = `View Exile (${exileCount})`;
  }
  ctx.autoSaveGameState();
}

// ── Die rolling ───────────────────────────────────────────────────────────────

/** Initiates a planar die roll with a brief animation delay. */
export function gameRollDie() {
  const gameState = ctx.getGameState();
  if (!gameState || gameState.dieRolling) return;

  gameState.dieRolling = true;
  gameBtnTl?.classList.add("game-die-rolling");

  setTimeout(() => {
    const gs = ctx.getGameState();
    if (!gs) return;
    const roll = Math.floor(Math.random() * 6) + 1;
    gs.dieRolling = false;
    gameBtnTl?.classList.remove("game-die-rolling");
    ctx.pushGameHistory();
    gs.chaosCost++;
    updateCostDisplay();
    applyDieResult(roll);
  }, 500);
}

/**
 * Applies the visual result of a die roll and triggers the appropriate popup.
 * @param {number} roll - The die roll result (1–6).
 */
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

  if (roll === 1) showChaosPopup();
  else if (roll === 6) showPlaneswalkerPopup();
}

function showPlaneswalkerPopup() {
  diePlaneswalkerPopup?.classList.remove("hidden");
}

/** Closes the planeswalk die result popup. */
export function closePlaneswalkerPopup() {
  diePlaneswalkerPopup?.classList.add("hidden");
}

/** Executes the planeswalk action triggered by a die roll popup confirmation. */
export function executePlaneswalkerAction() {
  closePlaneswalkerPopup();
  const gameState = ctx.getGameState();
  if (!gameState) return;
  if (gameState.mode === "bem") {
    const cell = gameState.bemGrid?.get(bemKey(gameState.bemPos.x, gameState.bemPos.y));
    if (cell?.placeholder && !cell?.card) {
      bemFillPlaceholder();
    } else if (cell?.card?.type === "Phenomenon") {
      bemResolvePhenomenon();
    } else {
      toggleBemPlaneswalkMode();
    }
  } else {
    ctx.gamePlaneswalk();
  }
}

function showChaosPopup() {
  dieChaosPopup?.classList.remove("hidden");
}

/** Closes the chaos die result popup. */
export function closeChaosPopup() {
  dieChaosPopup?.classList.add("hidden");
}

/** Resets the die icon to its initial (pre-roll) state. */
export function resetDieIcon() {
  if (!gameDieIcon) return;
  gameDieIcon.className = "ms ms-chaos";
  gameDieIcon.textContent = "";
  gameDieIcon.removeAttribute("aria-label");
  gameBtnTl?.classList.remove("game-die-chaos", "game-die-walk", "game-die-blank");
}

// ── Game menus ────────────────────────────────────────────────────────────────

/** Toggles the game tools menu open/closed. */
export function toggleGameToolsMenu() {
  const isHidden = gameToolsMenu?.classList.contains("hidden");
  closeAllGameMenus();
  if (isHidden) {
    gameToolsMenu?.classList.remove("hidden");
    gameBtnBr?.setAttribute("aria-expanded", "true");
    gameRevealInputRow?.classList.add("hidden");
    syncGameToolsState(ctx.getGameState()?.remaining.length ?? 0);
  }
}

/** Toggles the game options menu open/closed. */
export function toggleGameOptionsMenu() {
  const isHidden = gameOptionsMenu?.classList.contains("hidden");
  closeAllGameMenus();
  if (isHidden) {
    gameOptionsMenu?.classList.remove("hidden");
    gameBtnBl?.setAttribute("aria-expanded", "true");
  }
}

/** Closes all game menus (tools and options). */
export function closeAllGameMenus() {
  gameToolsMenu?.classList.add("hidden");
  gameOptionsMenu?.classList.add("hidden");
  gameBtnBr?.setAttribute("aria-expanded", "false");
  gameBtnBl?.setAttribute("aria-expanded", "false");
}

// ── Close top overlay ─────────────────────────────────────────────────────────

/**
 * Closes the topmost open game overlay (reader, die popup, reveal, menus).
 * @returns {boolean} True if an overlay was closed.
 */
export function closeTopGameOverlay() {
  if (!gameReaderView?.classList.contains("hidden")) {
    closeGameReaderView();
    return true;
  }
  if (!diePlaneswalkerPopup?.classList.contains("hidden")) {
    closePlaneswalkerPopup();
    return true;
  }
  if (!dieChaosPopup?.classList.contains("hidden")) {
    closeChaosPopup();
    return true;
  }
  if (!gameRevealOverlay?.classList.contains("hidden")) {
    closeRevealOverlay();
    return true;
  }
  if (!gameLibraryOverlay?.classList.contains("hidden")) {
    closeLibraryOverlay();
    return true;
  }
  if (!gameExileOverlay?.classList.contains("hidden")) {
    closeExileOverlay();
    return true;
  }
  if (!gameToolsMenu?.classList.contains("hidden") || !gameOptionsMenu?.classList.contains("hidden")) {
    closeAllGameMenus();
    return true;
  }
  return false;
}

// ── Game reader view ──────────────────────────────────────────────────────────

/**
 * Opens the game card reader overlay for a specific card.
 * @param {object} card - The enriched card object to display.
 * @param {{ label: string, action: Function, danger?: boolean }[]} [actions] - Action buttons.
 */
export function openGameReaderView(card, actions = []) {
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

/** Closes the game card reader overlay. */
export function closeGameReaderView() {
  gameReaderView?.classList.add("hidden");
  document.body.classList.remove("game-reader-open");
  closeReaderZoom();
  if (gameReaderImageWrap) {
    gameReaderImageWrap.setAttribute("aria-label", "Zoom card image");
    gameReaderImageWrap.setAttribute("aria-pressed", "false");
  }
  if (readerOpenedFromReveal) {
    gameRevealOverlay?.classList.remove("hidden");
    readerOpenedFromReveal = false;
  }
  if (readerOpenedFromLibrary) {
    gameLibraryOverlay?.classList.remove("hidden");
    readerOpenedFromLibrary = false;
  }
  if (readerOpenedFromExile) {
    gameExileOverlay?.classList.remove("hidden");
    readerOpenedFromExile = false;
  }
}

/**
 * Renders the phenomenon reminder banner based on the current game state's
 * recentPhenomena list. Call this after any action that changes recentPhenomena.
 */
export function updatePhenomenonBanner() {
  if (!phenomenonBanner) return;
  const gameState = ctx?.getGameState();
  const phenomena = gameState?.recentPhenomena ?? [];

  if (phenomena.length === 0) {
    phenomenonBanner.classList.add("hidden");
    phenomenonBanner.innerHTML = "";
    return;
  }

  phenomenonBanner.classList.remove("hidden");
  phenomenonBanner.innerHTML = "";

  for (const card of phenomena) {
    const row = document.createElement("div");
    row.className = "phenomenon-banner-row";

    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "phenomenon-banner-btn phenomenon-banner-info-btn";
    infoBtn.setAttribute("aria-label", `View ${card.displayName} details`);
    infoBtn.textContent = "ℹ";
    infoBtn.addEventListener("click", () => {
      openGameReaderView(card, []);
    });

    const nameEl = document.createElement("span");
    nameEl.className = "phenomenon-banner-name";
    nameEl.textContent = card.displayName;
    nameEl.title = card.displayName;

    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "phenomenon-banner-btn phenomenon-banner-dismiss-btn";
    dismissBtn.setAttribute("aria-label", `Dismiss ${card.displayName} reminder`);
    dismissBtn.textContent = "✕";
    dismissBtn.addEventListener("click", () => {
      const gs = ctx.getGameState();
      if (!gs) return;
      gs.recentPhenomena = (gs.recentPhenomena ?? []).filter(c => c !== card);
      updatePhenomenonBanner();
    });

    row.appendChild(infoBtn);
    row.appendChild(nameEl);
    row.appendChild(dismissBtn);
    phenomenonBanner.appendChild(row);
  }
}

async function loadReaderTranscript(card) {
  if (!gameReaderTranscript) return;
  const cached = readerTranscriptCache.get(card.id);
  if (typeof cached === "string") {
    renderReaderTranscriptMarkdown(cached || "No transcript available.");
    return;
  }
  try {
    const response = await fetch(card.transcriptPath);
    if (!response.ok) throw new Error("Not found");
    const text = await response.text();
    const trimmed = text.trim();
    readerTranscriptCache.set(card.id, trimmed);
    if (gameReaderTranscript) renderReaderTranscriptMarkdown(trimmed || "No transcript available.");
  } catch {
    readerTranscriptCache.set(card.id, "");
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
    gameReaderTranscript.innerHTML = enhanceManaSymbols(safe);
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

function openRevealCardInfo(card) {
  gameRevealOverlay?.classList.add("hidden");
  readerOpenedFromReveal = true;
  openGameReaderView(card, []);
}

function openLibraryCardInfo(card) {
  gameLibraryOverlay?.classList.add("hidden");
  readerOpenedFromLibrary = true;
  openGameReaderView(card, []);
}

// ── Reveal overlay ────────────────────────────────────────────────────────────

/** Opens the reveal overlay, drawing cards from the top of the library. */
export function openRevealCards() {
  const gameState = ctx.getGameState();
  if (!gameState) return;
  if (revealedCards.length > 0) {
    ctx.showToast("Resolve the current reveal before revealing more cards.");
    gameRevealOverlay?.classList.remove("hidden");
    closeAllGameMenus();
    return;
  }
  const countStr = gameRevealCountInput?.value.trim();
  const count = parseInt(countStr, 10);
  if (!count || count < 1) {
    ctx.showToast("Enter a number of cards to reveal.");
    return;
  }
  if (gameState.remaining.length === 0) {
    ctx.showToast("No cards remaining in library.");
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

/** Closes the reveal overlay, shuffling any unresolved cards back into the library. */
export function closeRevealOverlay() {
  const gameState = ctx.getGameState();
  if (revealedCards.length > 0 && gameState) {
    gameState.remaining.push(...revealedCards);
    gameState.remaining = shuffleArray(gameState.remaining);
    revealedCards = [];
    ctx.showToast("Remaining revealed cards shuffled back into library.");
    updateGameView();
  }
  gameRevealOverlay?.classList.add("hidden");
}

/** Re-renders the revealed cards in the current view mode (list or gallery). */
export function renderRevealCards() {
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
        <button class="game-reveal-thumb-btn" data-action="info" data-reveal-idx="${i}" type="button" aria-label="View ${escapeHtml(card.displayName)} details">
          <img class="game-reveal-thumb" src="${card.thumbPath}" alt="${escapeHtml(card.displayName)}" />
        </button>
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
          <button class="game-reveal-action-btn" data-action="info" data-reveal-idx="${i}" title="View card details" type="button">ℹ</button>
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
  const gameState = ctx.getGameState();
  if (!gameState) return;
  const btn = event.target.closest("[data-action][data-reveal-idx]");
  if (!btn) return;
  const action = btn.dataset.action;
  const revealIdx = parseInt(btn.dataset.revealIdx, 10);
  if (isNaN(revealIdx) || revealIdx < 0 || revealIdx >= revealedCards.length) return;

  if (action === "info") {
    openRevealCardInfo(revealedCards[revealIdx]);
    return;
  }

  ctx.pushGameHistory();
  const card = revealedCards.splice(revealIdx, 1)[0];

  switch (action) {
    case "planeswalk":
      if (gameState.mode === "bem") {
        const key = bemKey(gameState.bemPos.x, gameState.bemPos.y);
        const cell = gameState.bemGrid.get(key);
        if (cell?.card) gameState.remaining.push(cell.card);
        gameState.bemGrid.set(key, { card, faceUp: true });
        ctx.showToast(`Planeswalked to ${card.displayName}.`);
      } else {
        gameState.remaining.push(...gameState.activePlanes);
        gameState.activePlanes = [card];
        gameState.focusedIndex = 0;
        ctx.showToast(`Planeswalked to ${card.displayName}.`);
      }
      break;
    case "active":
      gameState.activePlanes.push(card);
      ctx.showToast(`${card.displayName} added simultaneously.`);
      break;
    case "top":
      gameState.remaining.unshift(card);
      ctx.showToast(`${card.displayName} put on top.`);
      break;
    case "bottom":
      gameState.remaining.push(card);
      ctx.showToast(`${card.displayName} put on bottom.`);
      break;
    case "exile":
      gameState.exiled.push(card);
      ctx.showToast(`${card.displayName} exiled.`);
      break;
  }

  if (gameState.mode === "bem") {
    renderBemMap();
    updateBemInfoBar();
    syncBemTrButton();
  } else {
    updateGameView();
  }
  renderRevealCards();
  updateRevealFooter();
}

/**
 * Handles bulk actions on all currently revealed cards.
 * @param {"shuffle" | "top" | "bottom" | "exile"} action
 */
export function handleRevealBulkAction(action) {
  const gameState = ctx.getGameState();
  if (!gameState) return;
  if (revealedCards.length === 0) {
    gameRevealOverlay?.classList.add("hidden");
    return;
  }
  ctx.pushGameHistory();
  const count = revealedCards.length;
  switch (action) {
    case "shuffle":
      gameState.remaining.push(...revealedCards);
      gameState.remaining = shuffleArray(gameState.remaining);
      ctx.showToast(`${count} card(s) shuffled back into library.`);
      break;
    case "top":
      gameState.remaining.unshift(...revealedCards);
      ctx.showToast(`${count} card(s) put on top of library.`);
      break;
    case "bottom":
      gameState.remaining.push(...revealedCards);
      ctx.showToast(`${count} card(s) put on bottom of library.`);
      break;
    case "exile":
      gameState.exiled.push(...revealedCards);
      ctx.showToast(`${count} card(s) exiled.`);
      break;
  }
  revealedCards = [];
  gameRevealOverlay?.classList.add("hidden");
  updateGameView();
}

/** Updates the enabled/disabled state of reveal footer bulk-action buttons. */
export function updateRevealFooter() {
  const hasCards = revealedCards.length > 0;
  if (gameRevealShuffleIn) gameRevealShuffleIn.disabled = !hasCards;
  if (gameRevealTopAll) gameRevealTopAll.disabled = !hasCards;
  if (gameRevealBottomAll) gameRevealBottomAll.disabled = !hasCards;
  if (gameRevealExileAll) gameRevealExileAll.disabled = !hasCards;
}

/**
 * Switches the reveal overlay between list and gallery display modes.
 * @param {"list" | "gallery"} mode
 */
function setRevealViewMode(mode) {
  revealViewMode = mode;
  gameRevealCardsContainer?.classList.toggle("game-reveal-mode-gallery", mode === "gallery");
  gameRevealCardsContainer?.classList.toggle("game-reveal-mode-list", mode === "list");
  if (gameRevealListBtn) gameRevealListBtn.classList.toggle("active", mode === "list");
  if (gameRevealGalleryBtn) gameRevealGalleryBtn.classList.toggle("active", mode === "gallery");
  renderRevealCards();
}

// ── Library / search view ─────────────────────────────────────────────────────

/** Opens the library overlay to browse library cards. */
export function openLibraryOverlay() {
  const gameState = ctx.getGameState();
  if (!gameState) return;
  closeAllGameMenus();
  if (gameLibrarySearchInput) gameLibrarySearchInput.value = "";
  renderLibraryCards();
  gameLibraryOverlay?.classList.remove("hidden");
}

/** Closes the library overlay. */
export function closeLibraryOverlay() {
  gameLibraryOverlay?.classList.add("hidden");
}

/** Re-renders the library cards in the current view mode (list or gallery). */
export function renderLibraryCards() {
  const gameState = ctx.getGameState();
  if (!gameLibraryCardsContainer) return;
  gameLibraryCardsContainer.innerHTML = "";
  const allCards = gameState?.remaining ?? [];
  const query = gameLibrarySearchInput?.value.trim().toLowerCase() || "";
  const cards = query ? allCards.filter((c) => c.displayName.toLowerCase().includes(query)) : allCards;

  if (gameLibraryTitleCount) gameLibraryTitleCount.textContent = allCards.length;

  if (cards.length === 0) {
    gameLibraryCardsContainer.innerHTML = query
      ? `<p class="game-reveal-empty">No matches in library.</p>`
      : `<p class="game-reveal-empty">Library is empty.</p>`;
    return;
  }

  const isGallery = libraryViewMode === "gallery";

  if (isGallery) {
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const item = document.createElement("div");
      item.className = "game-reveal-gallery-item";
      item.innerHTML = `
        <button class="game-reveal-thumb-btn" data-action="info" data-lib-key="${escapeHtml(card.id)}" type="button" aria-label="View ${escapeHtml(card.displayName)} details">
          <img class="game-reveal-thumb" src="${card.thumbPath}" alt="${escapeHtml(card.displayName)}" />
        </button>
        <div class="game-reveal-card-name">${escapeHtml(card.displayName)}</div>
        <div class="game-reveal-card-type">${escapeHtml(card.type)}</div>
        <div class="game-reveal-card-actions">
          <button class="game-reveal-action-btn" data-action="planeswalk" data-lib-key="${escapeHtml(card.id)}" title="Planeswalk to this card" type="button">▶ Planeswalk</button>
          <button class="game-reveal-action-btn" data-action="active" data-lib-key="${escapeHtml(card.id)}" title="Add to active cards" type="button">+ Active</button>
          <button class="game-reveal-action-btn" data-action="top" data-lib-key="${escapeHtml(card.id)}" title="Put on top of library" type="button">↑ Top</button>
          <button class="game-reveal-action-btn" data-action="bottom" data-lib-key="${escapeHtml(card.id)}" title="Put on bottom of library" type="button">↓ Bottom</button>
          <button class="game-reveal-action-btn game-reveal-action-exile" data-action="exile" data-lib-key="${escapeHtml(card.id)}" title="Exile (remove temporarily)" type="button">✕ Exile</button>
        </div>
      `;
      item.addEventListener("click", handleLibraryCardAction);
      gameLibraryCardsContainer.appendChild(item);
    }
  } else {
    const ol = document.createElement("ol");
    ol.className = "game-deck-view-ol";
    ol.addEventListener("click", handleLibraryCardAction);
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const li = document.createElement("li");
      li.className = "game-deck-view-item";
      li.innerHTML = `
        <div class="game-deck-item-row">
          <span class="game-deck-view-name">${escapeHtml(card.displayName)}</span>
          <span class="game-deck-view-type">${escapeHtml(card.type)}</span>
        </div>
        <div class="game-deck-item-actions">
          <button class="game-deck-action-btn" data-action="info" data-lib-key="${escapeHtml(card.id)}" title="View card details" type="button">ℹ</button>
          <button class="game-deck-action-btn" data-action="planeswalk" data-lib-key="${escapeHtml(card.id)}" title="Planeswalk to this card" type="button">▶</button>
          <button class="game-deck-action-btn" data-action="active" data-lib-key="${escapeHtml(card.id)}" title="Add to active cards" type="button">+</button>
          <button class="game-deck-action-btn" data-action="top" data-lib-key="${escapeHtml(card.id)}" title="Put on top of library" type="button">↑</button>
          <button class="game-deck-action-btn" data-action="bottom" data-lib-key="${escapeHtml(card.id)}" title="Put on bottom of library" type="button">↓</button>
          <button class="game-deck-action-btn game-deck-action-exile" data-action="exile" data-lib-key="${escapeHtml(card.id)}" title="Exile (remove temporarily)" type="button">✕</button>
        </div>
      `;
      ol.appendChild(li);
    }
    gameLibraryCardsContainer.appendChild(ol);
  }
}

/**
 * Switches the library overlay between list and gallery display modes.
 * @param {"list" | "gallery"} mode
 */
function setLibraryViewMode(mode) {
  libraryViewMode = mode;
  gameLibraryCardsContainer?.classList.toggle("game-reveal-mode-gallery", mode === "gallery");
  gameLibraryCardsContainer?.classList.toggle("game-reveal-mode-list", mode === "list");
  if (gameLibraryListBtn) gameLibraryListBtn.classList.toggle("active", mode === "list");
  if (gameLibraryGalleryBtn) gameLibraryGalleryBtn.classList.toggle("active", mode === "gallery");
  renderLibraryCards();
}

// ── Exile zone overlay ────────────────────────────────────────────────────────

/** Opens the exile zone overlay to browse exiled cards. */
export function openExileOverlay() {
  const gameState = ctx.getGameState();
  if (!gameState) return;
  closeAllGameMenus();
  renderExileCards();
  updateExileFooter();
  gameExileOverlay?.classList.remove("hidden");
}

/** Closes the exile zone overlay without changing any state. */
export function closeExileOverlay() {
  gameExileOverlay?.classList.add("hidden");
}

/** Re-renders the exiled cards in the current view mode (list or gallery). */
export function renderExileCards() {
  const gameState = ctx.getGameState();
  if (!gameExileCardsContainer) return;
  gameExileCardsContainer.innerHTML = "";
  const exiled = gameState?.exiled ?? [];
  if (gameExileTitleCount) gameExileTitleCount.textContent = exiled.length;

  if (exiled.length === 0) {
    gameExileCardsContainer.innerHTML = `<p class="game-reveal-empty">No cards in the exile zone.</p>`;
    updateExileFooter();
    return;
  }

  const isGallery = exileViewMode === "gallery";

  for (let i = 0; i < exiled.length; i++) {
    const card = exiled[i];
    const item = document.createElement("div");

    if (isGallery) {
      item.className = "game-reveal-gallery-item";
      item.innerHTML = `
        <button class="game-reveal-thumb-btn" data-action="info" data-exile-idx="${i}" type="button" aria-label="View ${escapeHtml(card.displayName)} details">
          <img class="game-reveal-thumb" src="${card.thumbPath}" alt="${escapeHtml(card.displayName)}" />
        </button>
        <div class="game-reveal-card-name">${escapeHtml(card.displayName)}</div>
        <div class="game-reveal-card-type">${escapeHtml(card.type)}</div>
        <div class="game-reveal-card-actions">
          <button class="game-reveal-action-btn" data-action="planeswalk" data-exile-idx="${i}" title="Planeswalk to this card" type="button">▶ Planeswalk</button>
          <button class="game-reveal-action-btn" data-action="active" data-exile-idx="${i}" title="Add to active cards" type="button">+ Active</button>
          <button class="game-reveal-action-btn" data-action="top" data-exile-idx="${i}" title="Put on top of library" type="button">↑ Top</button>
          <button class="game-reveal-action-btn" data-action="bottom" data-exile-idx="${i}" title="Put on bottom of library" type="button">↓ Bottom</button>
          <button class="game-reveal-action-btn game-reveal-action-shuffle" data-action="shuffle" data-exile-idx="${i}" title="Shuffle into library" type="button">↺ Shuffle</button>
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
          <button class="game-reveal-action-btn" data-action="info" data-exile-idx="${i}" title="View card details" type="button">ℹ</button>
          <button class="game-reveal-action-btn" data-action="planeswalk" data-exile-idx="${i}" title="Planeswalk to this card" type="button">▶</button>
          <button class="game-reveal-action-btn" data-action="active" data-exile-idx="${i}" title="Add to active cards" type="button">+</button>
          <button class="game-reveal-action-btn" data-action="top" data-exile-idx="${i}" title="Put on top of library" type="button">↑</button>
          <button class="game-reveal-action-btn" data-action="bottom" data-exile-idx="${i}" title="Put on bottom of library" type="button">↓</button>
          <button class="game-reveal-action-btn game-reveal-action-shuffle" data-action="shuffle" data-exile-idx="${i}" title="Shuffle into library" type="button">↺</button>
        </div>
      `;
    }

    item.addEventListener("click", handleExileCardAction);
    gameExileCardsContainer.appendChild(item);
  }
}

function handleExileCardAction(event) {
  const gameState = ctx.getGameState();
  if (!gameState) return;
  const btn = event.target.closest("[data-action][data-exile-idx]");
  if (!btn) return;
  const action = btn.dataset.action;
  const exileIdx = parseInt(btn.dataset.exileIdx, 10);
  if (isNaN(exileIdx) || exileIdx < 0 || exileIdx >= gameState.exiled.length) return;

  if (action === "info") {
    gameExileOverlay?.classList.add("hidden");
    readerOpenedFromExile = true;
    openGameReaderView(gameState.exiled[exileIdx], []);
    return;
  }

  ctx.pushGameHistory();
  const card = gameState.exiled.splice(exileIdx, 1)[0];

  switch (action) {
    case "planeswalk":
      if (gameState.mode === "bem") {
        const key = bemKey(gameState.bemPos.x, gameState.bemPos.y);
        const cell = gameState.bemGrid.get(key);
        if (cell?.card) gameState.remaining.push(cell.card);
        gameState.bemGrid.set(key, { card, faceUp: true });
        ctx.showToast(`Planeswalked to ${card.displayName}.`);
      } else {
        gameState.remaining.push(...gameState.activePlanes);
        gameState.activePlanes = [card];
        gameState.focusedIndex = 0;
        ctx.showToast(`Planeswalked to ${card.displayName}.`);
      }
      break;
    case "active":
      gameState.activePlanes.push(card);
      ctx.showToast(`${card.displayName} added simultaneously.`);
      break;
    case "top":
      gameState.remaining.unshift(card);
      ctx.showToast(`${card.displayName} put on top.`);
      break;
    case "bottom":
      gameState.remaining.push(card);
      ctx.showToast(`${card.displayName} put on bottom.`);
      break;
    case "shuffle":
      gameState.remaining.push(card);
      gameState.remaining = shuffleArray(gameState.remaining);
      ctx.showToast(`${card.displayName} shuffled into library.`);
      break;
  }

  if (gameState.mode === "bem") {
    renderBemMap();
    updateBemInfoBar();
    syncBemTrButton();
  } else {
    updateGameView();
  }
  renderExileCards();
  updateExileFooter();
  syncGameToolsState(gameState.remaining.length);
}

/**
 * Handles bulk actions on all currently exiled cards.
 * @param {"shuffle" | "top" | "bottom"} action
 */
export function handleExileBulkAction(action) {
  const gameState = ctx.getGameState();
  if (!gameState) return;
  if (gameState.exiled.length === 0) {
    closeExileOverlay();
    return;
  }
  ctx.pushGameHistory();
  const count = gameState.exiled.length;
  const cards = gameState.exiled.splice(0, count);
  switch (action) {
    case "shuffle":
      gameState.remaining.push(...cards);
      gameState.remaining = shuffleArray(gameState.remaining);
      ctx.showToast(`${count} card(s) shuffled back into library.`);
      break;
    case "top":
      gameState.remaining.unshift(...cards);
      ctx.showToast(`${count} card(s) put on top of library.`);
      break;
    case "bottom":
      gameState.remaining.push(...cards);
      ctx.showToast(`${count} card(s) put on bottom of library.`);
      break;
  }
  closeExileOverlay();
  updateGameView();
  syncGameToolsState(gameState.remaining.length);
}

/** Updates the enabled/disabled state of exile footer bulk-action buttons. */
export function updateExileFooter() {
  const gameState = ctx.getGameState();
  const hasCards = (gameState?.exiled?.length ?? 0) > 0;
  if (gameExileShuffleIn) gameExileShuffleIn.disabled = !hasCards;
  if (gameExileTopAll) gameExileTopAll.disabled = !hasCards;
  if (gameExileBottomAll) gameExileBottomAll.disabled = !hasCards;
}

/**
 * Switches the exile overlay between list and gallery display modes.
 * @param {"list" | "gallery"} mode
 */
function setExileViewMode(mode) {
  exileViewMode = mode;
  gameExileCardsContainer?.classList.toggle("game-reveal-mode-gallery", mode === "gallery");
  gameExileCardsContainer?.classList.toggle("game-reveal-mode-list", mode === "list");
  if (gameExileListBtn) gameExileListBtn.classList.toggle("active", mode === "list");
  if (gameExileGalleryBtn) gameExileGalleryBtn.classList.toggle("active", mode === "gallery");
  renderExileCards();
}

function handleLibraryCardAction(event) {
  const gameState = ctx.getGameState();
  if (!gameState) return;
  const btn = event.target.closest("[data-action][data-lib-key]");
  if (!btn) return;
  event.stopPropagation();
  const action = btn.dataset.action;
  const key = btn.dataset.libKey;
  const idx = gameState.remaining.findIndex((c) => c.id === key);
  if (idx === -1) return;

  if (action === "info") {
    openLibraryCardInfo(gameState.remaining[idx]);
    return;
  }

  ctx.pushGameHistory();
  const card = gameState.remaining.splice(idx, 1)[0];

  switch (action) {
    case "planeswalk":
      if (gameState.mode === "bem") {
        const bemCellKey = bemKey(gameState.bemPos.x, gameState.bemPos.y);
        const cell = gameState.bemGrid.get(bemCellKey);
        if (cell?.card) gameState.remaining.push(cell.card);
        gameState.bemGrid.set(bemCellKey, { card, faceUp: true });
        ctx.showToast(`Planeswalked to ${card.displayName}.`);
      } else {
        gameState.remaining.push(...gameState.activePlanes);
        gameState.activePlanes = [card];
        gameState.focusedIndex = 0;
        ctx.showToast(`Planeswalked to ${card.displayName}.`);
      }
      break;
    case "active":
      gameState.activePlanes.push(card);
      ctx.showToast(`${card.displayName} added simultaneously.`);
      break;
    case "top":
      gameState.remaining.unshift(card);
      ctx.showToast(`${card.displayName} put on top.`);
      break;
    case "bottom":
      gameState.remaining.push(card);
      ctx.showToast(`${card.displayName} put on bottom.`);
      break;
    case "exile":
      gameState.exiled.push(card);
      ctx.showToast(`${card.displayName} exiled.`);
      break;
  }

  if (gameState.mode === "bem") {
    renderBemMap();
    updateBemInfoBar();
    syncBemTrButton();
  } else {
    updateGameView();
  }
  renderLibraryCards();
  syncGameToolsState(gameState.remaining.length);
}

// ── BEM zoom ──────────────────────────────────────────────────────────────────

/** Loads the saved BEM zoom level from localStorage and applies it. */
export function loadBemZoom() {
  try {
    const stored = localStorage.getItem(BEM_ZOOM_KEY);
    if (stored === "close" || stored === "default" || stored === "far") {
      bemZoomLevel = stored;
    }
  } catch {
    // ignore
  }
  if (bemZoomSelect) bemZoomSelect.value = bemZoomLevel;
  applyBemZoom();
}

/** Applies the current BEM zoom level CSS class to the game view. */
export function applyBemZoom() {
  if (!gameView) return;
  gameView.classList.remove("bem-zoom-close", "bem-zoom-far");
  if (bemZoomLevel === "close") gameView.classList.add("bem-zoom-close");
  else if (bemZoomLevel === "far") gameView.classList.add("bem-zoom-far");
}

// ── Tutorial overlay ──────────────────────────────────────────────────────────

const TUTORIAL_CONTENT = {
  classic: {
    title: "⚔ Classic Planechase",
    body: `
<h3>Welcome to Planechase!</h3>
<p>In Planechase, players journey across the planes of the Multiverse using a shared deck of <strong>Plane</strong> and <strong>Phenomenon</strong> cards.</p>

<h3>Starting the Game</h3>
<p>Cards are revealed from the top of the deck until a <strong>Plane</strong> is revealed. That Plane becomes active. The rest are placed on the bottom of the deck in a random order.</p>

<h3>Rolling the Planar Die</h3>
<p>On your turn, you may roll the planar die as a sorcery. Each additional roll on the same turn costs {1} more than the last (first roll is free, second costs {1}, third costs {2}, etc.).</p>
<ul>
  <li><strong>BLANK</strong> — Nothing happens.</li>
  <li>{CHAOS} — The chaos ability of each face-up Plane triggers.</li>
  <li>{PLANESWALKER} — Planeswalk! The active Plane goes to the bottom of the deck. Reveal the top card of the planar deck, and it becomes active.</li>
</ul>

<h3>Phenomena</h3>
<p>When you planeswalk to (encounter) a Phenomenon, follow the instructions on the card. (Then planeswalk away from the phenomenon.) Phenomena almost never stay active, they always lead to another card.</p>

<h3>Controls</h3>
<ul>
  <li>Tap the <strong>card image</strong> to view it up close.</li>
  <li>Use the <strong>Planeswalk button</strong> ({PLANESWALKER}) to planeswalk.</li>
  <li>Use the <strong>Planar Die button</strong> ({CHAOS}) to roll.</li>
  <li>The <strong>Tools</strong> menu lets you manage the library, reveal cards, and use other tools for resolving effects.</li>
  <li>The <strong>Options</strong> menu lets you exit, reset, or save the game state.</li>
</ul>

<h3>Keybinds</h3>
<ul>
  <li><strong>Space</strong> — Roll the planar die.</li>
  <li><strong>Enter</strong> — Planeswalk.</li>
  <li><strong>I</strong> — View current card details.</li>
  <li><strong>T</strong> — Toggle the Tools menu.</li>
  <li><strong>Z</strong> — Undo last action.</li>
  <li><strong>R</strong> — Redo next action.</li>
</ul>
`
  },
  bem: {
    title: "Blind Eternities Map",
    body: `
<h3>Welcome to the Blind Eternities Map!</h3>
<p>The Blind Eternities Map is a spatial Planechase variant originally conceived by Gavin Duggan [Wizards of The Coast]. Planes are arranged in a multiversal grid. Navigate across the Blind Eternities, like a true Planeswalker.</p>

<h3>The Grid</h3>
<p>You start at the center of a 3×3 grid of planes. As you move, the map expands and distant planes cycle back into the deck.</p>
<ul>
  <li><strong>Face-up cards</strong> (directly adjacent neighbors) are visible planes you can move to.</li>
  <li><strong>Face-down cards</strong> (diagonal corners) are unknown, reachable only by "Hellriding", travelling directly across the Aether!</li>
</ul>

<h3>Moving</h3>
<p>Press the <strong>Planeswalk button</strong> to enter Planeswalking mode, then click/tap a highlighted neighbor to move there. Orthogonal moves reveal the card as you arrive. In <em>Easy Planeswalking</em> mode, just tap a neighbor to move instantly.</p>

<h3>Hellriding</h3>
<p>To Hellride, enter movement mode and click/tap a face-down diagonal card. You venture into the unknown! There is a chance you'll encounter a <strong>Phenomenon</strong> before arriving at your destination, so take caution.</p>

<h3>Phenomena</h3>
<p>When you land on a Phenomenon, press the <strong>Planeswalk button</strong> to resolve the Phenomenon and reveal the next card of the planar deck.</p>

<h3>The Planar Die</h3>
<p>Roll the die on your turn, only at sorcery speed (first roll is free, each additional roll costs {1} more). The same Chaos and Planeswalk rules apply as in Classic mode.</p>

<h3>Controls</h3>
<ul>
  <li>Tap/click the <strong>Planeswalk button</strong> to enter/cancel Planeswalking mode.</li>
  <li>Tap/click any face-up card to view its details.</li>
  <li>On desktop: use <strong>arrow keys</strong> or <strong>middle mouse drag</strong> to pan the view. On mobile: press and drag to pan.</li>
  <li>The <strong>Tools</strong> and <strong>Options</strong> menus work the same as in Classic mode.</li>
</ul>

<h3>Keybinds</h3>
<ul>
  <li><strong>Space</strong> — Roll the planar die.</li>
  <li><strong>Enter</strong> — Enter Planeswalking mode or confirm movement.</li>
  <li><strong>↑ ↓ ← →</strong> — Pan the map view.</li>
  <li><strong>I</strong> — View current card details.</li>
  <li><strong>T</strong> — Toggle the Tools menu.</li>
  <li><strong>Z</strong> — Undo last action.</li>
  <li><strong>R</strong> — Redo next action.</li>
</ul>
`
  }
};

/**
 * Shows the tutorial overlay if the user hasn't seen it yet; otherwise calls callback directly.
 * @param {"classic" | "bem"} mode
 * @param {Function} callback - Called after the tutorial is dismissed (or immediately if already seen).
 */
export function maybeShowTutorial(mode, callback) {
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
  if (gameTutorialBody) gameTutorialBody.innerHTML = enhanceManaSymbols(content.body);

  gameTutorialOverlay.classList.remove("hidden");
  document.body.classList.add("tutorial-open");
}

function hideTutorial() {
  gameTutorialOverlay?.classList.add("hidden");
  document.body.classList.remove("tutorial-open");

  const key = pendingGameMode === "bem" ? TUTORIAL_BEM_KEY : TUTORIAL_CLASSIC_KEY;
  try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
}

/** Clears the "tutorial seen" flags so tutorials will show again. */
export function clearTutorialFlags() {
  try {
    localStorage.removeItem(TUTORIAL_CLASSIC_KEY);
    localStorage.removeItem(TUTORIAL_BEM_KEY);
  } catch { /* ignore */ }
}

// ── Event binding ─────────────────────────────────────────────────────────────

function bindGameUIEvents() {
  gameBtnTr?.addEventListener("click", () => {
    const gameState = ctx.getGameState();
    if (gameState?.mode === "bem") {
      const cell = gameState.bemGrid?.get(bemKey(gameState.bemPos.x, gameState.bemPos.y));
      if (cell?.placeholder && !cell?.card) {
        bemFillPlaceholder();
      } else if (cell?.card?.type === "Phenomenon") {
        bemResolvePhenomenon();
      } else {
        toggleBemPlaneswalkMode();
      }
    } else {
      ctx.gamePlaneswalk();
    }
  });
  gameBtnTl?.addEventListener("click", gameRollDie);
  gameBtnBr?.addEventListener("click", toggleGameToolsMenu);
  gameBtnBl?.addEventListener("click", toggleGameOptionsMenu);

  gameToolsUndo?.addEventListener("click", () => ctx.undoLastAction());
  gameToolsRedo?.addEventListener("click", () => ctx.redoNextAction());

  gameToolsShuffle?.addEventListener("click", () => {
    const gameState = ctx.getGameState();
    if (!gameState) return;
    ctx.pushGameHistory();
    gameState.remaining = shuffleArray(gameState.remaining);
    ctx.showToast("Remaining library shuffled.");
    if (!gameLibraryOverlay?.classList.contains("hidden")) renderLibraryCards();
  });

  gameToolsAddTop?.addEventListener("click", () => {
    const gameState = ctx.getGameState();
    if (!gameState || gameState.remaining.length === 0) {
      ctx.showToast("No cards remaining in the library.");
      return;
    }
    ctx.pushGameHistory();
    const top = gameState.remaining.shift();
    gameState.activePlanes.push(top);
    if (gameState.mode === "bem") {
      updateBemInfoBar();
    } else {
      updateGameView();
    }
    ctx.showToast(`${top.displayName} added simultaneously.`);
    if (!gameLibraryOverlay?.classList.contains("hidden")) renderLibraryCards();
  });

  gameToolsAddBottom?.addEventListener("click", () => {
    const gameState = ctx.getGameState();
    if (!gameState || gameState.remaining.length === 0) {
      ctx.showToast("No cards remaining in the library.");
      return;
    }
    ctx.pushGameHistory();
    const bottom = gameState.remaining.pop();
    gameState.activePlanes.push(bottom);
    if (gameState.mode === "bem") {
      updateBemInfoBar();
    } else {
      updateGameView();
    }
    ctx.showToast(`${bottom.displayName} added simultaneously.`);
    if (!gameLibraryOverlay?.classList.contains("hidden")) renderLibraryCards();
  });

  gameLibraryToggle?.addEventListener("click", () => openLibraryOverlay());

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

  gameToolsExileToggle?.addEventListener("click", () => openExileOverlay());
  gameExileClose?.addEventListener("click", closeExileOverlay);
  gameExileBackdrop?.addEventListener("click", closeExileOverlay);
  gameExileShuffleIn?.addEventListener("click", () => handleExileBulkAction("shuffle"));
  gameExileTopAll?.addEventListener("click", () => handleExileBulkAction("top"));
  gameExileBottomAll?.addEventListener("click", () => handleExileBulkAction("bottom"));
  gameExileListBtn?.addEventListener("click", () => setExileViewMode("list"));
  gameExileGalleryBtn?.addEventListener("click", () => setExileViewMode("gallery"));

  gameLibraryClose?.addEventListener("click", closeLibraryOverlay);
  gameLibraryBackdrop?.addEventListener("click", closeLibraryOverlay);
  gameLibraryListBtn?.addEventListener("click", () => setLibraryViewMode("list"));
  gameLibraryGalleryBtn?.addEventListener("click", () => setLibraryViewMode("gallery"));
  gameLibrarySearchInput?.addEventListener("input", renderLibraryCards);

  gameCardImageBtn?.addEventListener("click", () => {
    const gameState = ctx.getGameState();
    if (!gameState || gameState.activePlanes.length === 0) {
      ctx.gamePlaneswalk();
      return;
    }
    if (ctx.getEasyPlaneswalk()) {
      ctx.gamePlaneswalk();
      return;
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

  diePlaneswalkerBtn?.addEventListener("click", executePlaneswalkerAction);
  dieRemainBtn?.addEventListener("click", closePlaneswalkerPopup);
  diePlaneswalkerBackdrop?.addEventListener("click", closePlaneswalkerPopup);
  dieChaosCloseBtn?.addEventListener("click", closeChaosPopup);
  dieChaosBackdrop?.addEventListener("click", closeChaosPopup);

  bemZoomSelect?.addEventListener("change", () => {
    const val = bemZoomSelect.value;
    if (val === "close" || val === "default" || val === "far") {
      bemZoomLevel = val;
      applyBemZoom();
      try { localStorage.setItem(BEM_ZOOM_KEY, bemZoomLevel); } catch { /* ignore */ }
    }
  });

  const bemMapEl = document.getElementById("bem-map");
  const bemMapArea = document.getElementById("bem-map-area");
  const bemViewCardBtn = document.getElementById("bem-view-card-btn");

  bemMapEl?.addEventListener("click", (event) => ctx.handleBemCellClick(event));
  bemViewCardBtn?.addEventListener("click", () => {
    const gameState = ctx.getGameState();
    if (!gameState?.bemGrid || !gameState?.bemPos) return;
    const cell = gameState.bemGrid.get(bemKey(gameState.bemPos.x, gameState.bemPos.y));
    if (cell?.card) openGameReaderView(cell.card, buildBemCardActions());
  });

  classicViewCardBtn?.addEventListener("click", () => {
    const gameState = ctx.getGameState();
    if (!gameState || gameState.mode === "bem") return;
    const focused = gameState.activePlanes[gameState.focusedIndex] ?? gameState.activePlanes[0];
    if (focused) openGameReaderView(focused, buildMainCardActions(gameState.focusedIndex));
  });

  bemMapArea?.addEventListener("pointerdown", (e) => ctx.handleBemPointerDown(e));
  bemMapArea?.addEventListener("pointermove", (e) => ctx.handleBemPointerMove(e));
  bemMapArea?.addEventListener("pointerup", (e) => ctx.handleBemPointerUp(e));
  bemMapArea?.addEventListener("pointercancel", (e) => ctx.handleBemPointerUp(e));
  document.addEventListener("keydown", (e) => ctx.handleBemArrowKey(e));

  gameTutorialClose?.addEventListener("click", () => {
    hideTutorial();
    if (pendingGameMode === "classic") ctx.startClassicGame();
    else if (pendingGameMode === "bem") ctx.startBemGame();
    pendingGameMode = null;
  });
}
