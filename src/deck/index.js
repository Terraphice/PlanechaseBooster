import { isHiddenCard } from "../gallery/utils.js";
import { toBase64Url, fromBase64Url, decodeDeck, remapLegacyKey } from "./codec.js";

import { initClassicGame, startClassicGame, gamePlaneswalk, buildMainCardActions } from "../game/classic.js";

import {
  initBemGame, startBemGame, bemKey, bemMovePlayer, bemResolvePhenomenon, bemFillPlaceholder,
  syncBemTrButton, handleBemCellClick, toggleBemPlaneswalkMode, handleBemArrowKey,
  handleBemPointerDown, handleBemPointerMove, handleBemPointerUp,
  buildBemCardActions, getBemPlaneswalkPending, getBemViewOffset
} from "../game/bem.js";

import {
  initGameStateManager, pushGameHistory, undoLastAction, redoNextAction,
  startGameFromState, exitGame, resetGame, encodeGameState, decodeGameState,
  autoSaveGameState, getGameHistory, getGameRedoStack
} from "../game/state.js";

import {
  initGameUI, updateGameView, showGamePlaceholder, updateCostDisplay, syncGameToolsState,
  closeAllGameMenus, closePlaneswalkerPopup, closeChaosPopup, executePlaneswalkerAction,
  resetDieIcon, openGameReaderView, closeGameReaderView,
  renderGameSidePanel, renderRevealCards, updateRevealFooter, gameRollDie,
  toggleGameToolsMenu, maybeShowTutorial, loadBemZoom,
  getRevealedCards, setRevealedCards, setReaderOpenedFromReveal, updatePhenomenonBanner
} from "../game/ui.js";

import {
  initDeckPanel, openDeckPanel, closeDeckPanel,
  updateDeckButton, renderDeckList, renderDeckSlotDropdown, updateCardOverlays,
  updateAllCardOverlays, refreshDeckCardItem, updateModalDeckButton
} from "./panel.js";


// ── Constants ─────────────────────────────────────────────────────────────────

const DECK_STORAGE_KEY = "planar-atlas-decks-v2";
const DECK_NAMES_KEY = "planar-atlas-deck-names-v1";
const BEM_ZOOM_KEY = "planar-atlas-bem-zoom-v1";
const GAME_STATE_AUTOSAVE_KEY = "planar-atlas-game-state-autosave-v2";
const NUM_DECK_SLOTS = 10;
const MAX_CARD_COUNT = 9;

// ── Module state ──────────────────────────────────────────────────────────────

let allCards = [];
let allDecks = Array.from({ length: NUM_DECK_SLOTS }, () => new Map());
let deckNames = Array.from({ length: NUM_DECK_SLOTS }, (_, i) => i === 0 ? "Default Official Deck" : `Deck ${i + 1}`);
let currentSlot = 0;
let gameActive = false;
let gameState = null;
let showToastFn = null;
let onDeckChangeFn = null;
let easyPlaneswalk = false;
let phenomenonAnimationEnabled = true;
let hellridingMode = "risky";
let smoothTravelEnabled = false;
let bemEdgePlaceholdersEnabled = false;
let counterBehavior = "permanent";

// ── DOM references (only what deck.js needs directly) ────────────────────────

const gameModeDialog = document.getElementById("game-mode-dialog");
const gameModeDialogBackdrop = document.getElementById("game-mode-dialog-backdrop");
const gameModeClassicBtn = document.getElementById("game-mode-classic-btn");
const gameModeBemBtn = document.getElementById("game-mode-bem-btn");
const gameModeDialogCancel = document.getElementById("game-mode-dialog-cancel");
const gameOptExit = document.getElementById("game-opt-exit");
const gameOptReset = document.getElementById("game-opt-reset");
const gameOptDeckBuilder = document.getElementById("game-opt-deck-builder");
const gameOptSaveState = document.getElementById("game-opt-save-state");
const gameOptLoadState = document.getElementById("game-opt-load-state");
const gameOptStateLink = document.getElementById("game-opt-state-link");
const gameCostReset = document.getElementById("game-cost-reset");
const gameEasyPlaneswalkToggle = document.getElementById("game-easy-planeswalk-toggle");
const gameReaderView = document.getElementById("game-reader-view");
const diePlaneswalkerPopup = document.getElementById("die-planeswalk-popup");
const dieChaosPopup = document.getElementById("die-chaos-popup");
const gameRevealOverlay = document.getElementById("game-reveal-overlay");

const gameView = document.getElementById("game-view");
const bemMapArea = document.getElementById("bem-map-area");
const bemMapEl = document.getElementById("bem-map");
const gameBtnTr = document.getElementById("game-btn-tr");
const gameCardImage = document.getElementById("game-card-image");
const gameCardImageBtn = document.getElementById("game-card-image-btn");
const gameSidePanel = document.getElementById("game-side-panel");
const classicViewCardBtn = document.getElementById("classic-view-card-btn");
const classicCardNameLabel = document.getElementById("classic-card-name-label");
const bemCardNameLabel = document.getElementById("bem-card-name");

// ── Helpers ───────────────────────────────────────────────────────────────────

function deckCards() {
  return allDecks[currentSlot];
}

function filterValidDeck(map) {
  const valid = new Map();
  for (const [key, count] of map) {
    if (allCards.some((c) => c.id === key)) valid.set(key, count);
  }
  return valid;
}

function buildDeckArray() {
  const result = [];
  for (const [key, count] of deckCards()) {
    const card = allCards.find((c) => c.id === key);
    if (card) for (let i = 0; i < count; i++) result.push(card);
  }
  return result;
}

function populateDefaultSlot() {
  allDecks[0] = new Map();
  for (const card of allCards) {
    if (!isHiddenCard(card.normalizedTags) && card.normalizedTags.some((t) => t.includes("official"))) {
      allDecks[0].set(card.id, 1);
    }
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────

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

function loadDecksFromStorage() {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    const defaultDecks = Array.from({ length: NUM_DECK_SLOTS }, () => new Map());
    if (!raw) return { slot: 0, decks: defaultDecks, names: loadDeckNamesFromStorage() };
    const parsed = JSON.parse(raw);
    const slot = typeof parsed.slot === "number" && parsed.slot >= 0 && parsed.slot < NUM_DECK_SLOTS ? parsed.slot : 0;
    const decks = Array.isArray(parsed.decks)
      ? parsed.decks.slice(0, NUM_DECK_SLOTS).map((d) => {
          if (!Array.isArray(d)) return new Map();
          return new Map(d
            .filter(([k, v]) => typeof k === "string" && typeof v === "number" && v > 0 && v <= MAX_CARD_COUNT)
            .map(([k, v]) => {
              const remapped = remapLegacyKey(k);
              return [remapped, v];
            })
          );
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

// ── Deck CRUD ─────────────────────────────────────────────────────────────────

export function getDeckTotal() {
  return [...deckCards().values()].reduce((a, b) => a + b, 0);
}

export function getCardDeckCount(cardKey) {
  return deckCards().get(cardKey) || 0;
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
  if (count > 0) removeCardFromDeck(cardKey);
  else addCardToDeck(cardKey);
}

export function setCardDeckCount(cardKey, count) {
  const deck = deckCards();
  const clamped = Math.max(0, Math.min(MAX_CARD_COUNT, count));
  if (clamped === 0) {
    deck.delete(cardKey);
  } else {
    deck.set(cardKey, clamped);
  }
  saveDecksToStorage();
  updateDeckButton();
  refreshDeckCardItem(cardKey);
  updateCardOverlays(cardKey);
  updateModalDeckButton(cardKey);
  renderDeckSlotDropdown();
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

export function clearAllDecks() {
  for (let i = 0; i < NUM_DECK_SLOTS; i++) {
    allDecks[i] = new Map();
  }
  deckNames = Array.from({ length: NUM_DECK_SLOTS }, (_, i) =>
    i === 0 ? "Default Official Deck" : `Deck ${i + 1}`
  );
  localStorage.removeItem(DECK_STORAGE_KEY);
  localStorage.removeItem(DECK_NAMES_KEY);
  localStorage.removeItem(BEM_ZOOM_KEY);
  populateDefaultSlot();
  loadBemZoom();
  updateDeckButton();
  renderDeckList();
  updateAllCardOverlays();
  renderDeckSlotDropdown();
}

// ── Profile seeds ─────────────────────────────────────────────────────────────

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
  populateDefaultSlot();
  saveDecksToStorage();
  saveDeckNamesToStorage();
  updateDeckButton();
  renderDeckSlotDropdown();
  renderDeckList();
  updateAllCardOverlays();
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

// ── Game mode dialog ──────────────────────────────────────────────────────────

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

// ── Save / load / share game state ────────────────────────────────────────────

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

// ── Game state accessors ──────────────────────────────────────────────────────

export function isGameActive() {
  return gameActive;
}

export function setPhenomenonAnimation(enabled) {
  phenomenonAnimationEnabled = Boolean(enabled);
}

export function setHellridingMode(mode) {
  hellridingMode = ["safe", "normal", "risky", "extreme"].includes(mode) ? mode : "risky";
}

export function setSmoothTravel(enabled) {
  smoothTravelEnabled = Boolean(enabled);
}

export function setBemEdgePlaceholders(enabled) {
  bemEdgePlaceholdersEnabled = Boolean(enabled);
}

export function setCounterBehavior(mode) {
  counterBehavior = ["temporary", "permanent"].includes(mode) ? mode : "permanent";
}

export function syncGameHash() {
  if (window.location.hash === "#play") {
    if (!gameActive && getDeckTotal() > 0) startGame();
  } else {
    if (gameActive) exitGame({ updateHash: false });
  }
}

// ── Re-exports from sub-modules ───────────────────────────────────────────────

export { isDeckPanelOpen, closeDeckPanel, setModalCardKey } from "./panel.js";
export { clearTutorialFlags, closeGameReaderView, closeTopGameOverlay } from "../game/ui.js";

// ── Events ────────────────────────────────────────────────────────────────────

function bindDeckEvents() {
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

  gameEasyPlaneswalkToggle?.addEventListener("change", () => {
    easyPlaneswalk = gameEasyPlaneswalkToggle.checked;
  });

  document.addEventListener("keydown", (event) => {
    if (!gameActive) return;
    if (document.body.classList.contains("tutorial-open")) return;

    const active = document.activeElement;
    const typing = active && (
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable
    );
    if (typing) return;

    const readerOpen = !gameReaderView?.classList.contains("hidden");
    const diePopupOpen = !diePlaneswalkerPopup?.classList.contains("hidden");
    const anyBlockingOverlay = readerOpen ||
      diePopupOpen ||
      !dieChaosPopup?.classList.contains("hidden") ||
      !gameRevealOverlay?.classList.contains("hidden");

    if (event.key === " ") {
      event.preventDefault();
      if (!anyBlockingOverlay) gameRollDie();
      return;
    }

    if (event.key === "Enter") {
      if (diePopupOpen) {
        event.preventDefault();
        executePlaneswalkerAction();
        return;
      }
      if (!anyBlockingOverlay) {
        event.preventDefault();
        if (gameState?.mode === "bem") {
          const viewOffset = getBemViewOffset();
          const isPanning = viewOffset.dx !== 0 || viewOffset.dy !== 0;
          if (getBemPlaneswalkPending() && isPanning) {
            const nx = gameState.bemPos.x + viewOffset.dx;
            const ny = gameState.bemPos.y + viewOffset.dy;
            const dx = viewOffset.dx, dy = viewOffset.dy;
            const isOrthog = (Math.abs(dx) + Math.abs(dy)) === 1;
            const isDiag = Math.abs(dx) === 1 && Math.abs(dy) === 1;
            const cell = gameState.bemGrid.get(bemKey(nx, ny));
            if ((isOrthog && cell?.faceUp) || (isDiag && cell && !cell.faceUp)) {
              bemMovePlayer(nx, ny);
              return;
            }
          }
          const cell = gameState.bemGrid?.get(bemKey(gameState.bemPos.x, gameState.bemPos.y));
          if (cell?.placeholder && !cell?.card) {
            bemFillPlaceholder();
          } else if (cell?.card?.type === "Phenomenon") {
            bemResolvePhenomenon();
          } else {
            toggleBemPlaneswalkMode();
          }
        } else {
          gamePlaneswalk();
        }
      }
      return;
    }

    if (event.key.toLowerCase() === "i" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (anyBlockingOverlay) return;
      if (gameState?.mode === "bem") {
        const cell = gameState.bemGrid?.get(bemKey(gameState.bemPos.x, gameState.bemPos.y));
        if (cell?.card) openGameReaderView(cell.card, buildBemCardActions(), { faceDown: !cell.faceUp });
      } else if (gameState) {
        const focused = gameState.activePlanes[gameState.focusedIndex] ?? gameState.activePlanes[0];
        if (focused) openGameReaderView(focused, buildMainCardActions(gameState.focusedIndex));
      }
      return;
    }

    if (event.key.toLowerCase() === "t" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      toggleGameToolsMenu();
      return;
    }

    if (event.key.toLowerCase() === "z" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (anyBlockingOverlay) return;
      undoLastAction();
      return;
    }

    if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (anyBlockingOverlay) return;
      redoNextAction();
      return;
    }
  });
}

// ── Initialization ────────────────────────────────────────────────────────────

export function initDeck({ cards, showToast, onDeckChange }) {
  allCards = cards;
  showToastFn = showToast;
  onDeckChangeFn = onDeckChange;

  const stored = loadDecksFromStorage();
  allDecks = stored.decks;
  currentSlot = stored.slot;
  deckNames = stored.names;

  populateDefaultSlot();

  initDeckPanel({
    getAllCards: () => allCards,
    deckCards: () => deckCards(),
    getAllDecks: () => allDecks,
    setAllDecks: (d) => { allDecks = d; },
    setCurrentDeckMap: (map) => { allDecks[currentSlot] = map; },
    getCurrentSlot: () => currentSlot,
    setCurrentSlot: (s) => { currentSlot = s; },
    getDeckNames: () => deckNames,
    setDeckNames: (n) => { deckNames = n; },
    MAX_CARD_COUNT,
    NUM_DECK_SLOTS,
    saveDecksToStorage,
    saveDeckNamesToStorage,
    showToast: (msg) => showToastFn?.(msg),
    onDeckChange: () => onDeckChangeFn?.(),
    addCardToDeck,
    removeCardFromDeck,
    setCardDeckCount,
    clearDeck,
    showGameModeDialog,
    filterValidDeck,
    getDeckTotal,
  });

  initGameUI({
    getGameState: () => gameState,
    getGameHistory,
    getGameRedoStack,
    pushGameHistory,
    undoLastAction,
    redoNextAction,
    autoSaveGameState,
    gamePlaneswalk,
    startClassicGame,
    startBemGame,
    handleBemCellClick,
    handleBemPointerDown,
    handleBemPointerMove,
    handleBemPointerUp,
    handleBemArrowKey,
    showToast: (msg) => showToastFn?.(msg),
    getEasyPlaneswalk: () => easyPlaneswalk,
    getCounterBehavior: () => counterBehavior,
  });

  initGameStateManager({
    getGameState: () => gameState,
    setGameState: (s) => { gameState = s; },
    getGameActive: () => gameActive,
    setGameActive: (v) => { gameActive = v; },
    getRevealedCards,
    setRevealedCards,
    setReaderOpenedFromReveal,
    getAllCards: () => allCards,
    closeDeckPanel,
    buildDeckArray,
    showToast: (msg) => showToastFn?.(msg),
    updateGameView,
    showGamePlaceholder,
    updateCostDisplay,
    syncGameToolsState,
    closeAllGameMenus,
    closePlaneswalkerPopup,
    closeChaosPopup,
    resetDieIcon,
    renderRevealCards,
    updateRevealFooter,
    closeGameReaderView,
    updatePhenomenonBanner,
  });

  initClassicGame({
    getGameState: () => gameState,
    setGameState: (s) => { gameState = s; },
    setGameActive: (v) => { gameActive = v; },
    buildDeckArray,
    getDeckTotal,
    closeDeckPanel,
    showGamePlaceholder,
    resetDieIcon,
    updateCostDisplay,
    syncBemTrButton,
    showToast: (msg) => showToastFn?.(msg),
    getEasyPlaneswalk: () => easyPlaneswalk,
    getCounterBehavior: () => counterBehavior,
    updateGameView,
    openGameReaderView,
    closeGameReaderView,
    closeAllGameMenus,
    syncGameToolsState,
    pushHistory: pushGameHistory,
    updatePhenomenonBanner,
    gameView,
    bemMapArea,
    gameCardImage,
    gameCardImageBtn,
    gameSidePanel,
    classicViewCardBtn,
    classicCardNameLabel,
  });

  initBemGame({
    getGameState: () => gameState,
    setGameState: (s) => { gameState = s; },
    setGameActive: (v) => { gameActive = v; },
    getGameActive: () => gameActive,
    buildDeckArray,
    getDeckTotal,
    closeDeckPanel,
    resetDieIcon,
    updateCostDisplay,
    syncBemTrButton,
    getPhenomenonAnimationEnabled: () => phenomenonAnimationEnabled,
    getHellridingMode: () => hellridingMode,
    getSmoothTravelEnabled: () => smoothTravelEnabled,
    getBemEdgePlaceholders: () => bemEdgePlaceholdersEnabled,
    getCounterBehavior: () => counterBehavior,
    getEasyPlaneswalk: () => easyPlaneswalk,
    showToast: (msg) => showToastFn?.(msg),
    renderGameSidePanel,
    syncGameToolsState,
    openGameReaderView,
    closeGameReaderView,
    closeAllGameMenus,
    pushHistory: pushGameHistory,
    updatePhenomenonBanner,
    gameBtnTr,
    gameView,
    bemMapArea,
    bemMapEl,
    bemCardNameLabel,
  });

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
  loadBemZoom();

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

  const autosaved = localStorage.getItem(GAME_STATE_AUTOSAVE_KEY);
  if (autosaved && window.location.hash !== "#play") {
    const decoded = decodeGameState(autosaved);
    if (decoded) {
      startGameFromState(decoded);
      showToastFn?.("Game resumed from previous session.");
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
