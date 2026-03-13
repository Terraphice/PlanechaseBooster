// ── game-state.js ─────────────────────────────────────────────────────────────
// Game state machine: history management, undo/redo, state encoding/decoding,
// and game lifecycle transitions (start, exit, reset).

import { shuffleArray } from "../gallery/utils.js";
import { compressKey, decompressKey, remapLegacyKey, toBase64Url, fromBase64Url } from "../deck/codec.js";
import {
  bemKey,
  resetBemState,
  startBemGame,
  renderBemMap,
  updateBemInfoBar,
  syncBemTrButton,
} from "./bem.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const GAME_STATE_AUTOSAVE_KEY = "planar-atlas-game-state-autosave-v2";
const MAX_GAME_HISTORY = 20;

// ── Module state ──────────────────────────────────────────────────────────────

const gameHistory = [];
let gameRedoStack = [];

// ── Context (set by initGameStateManager) ────────────────────────────────────

let ctx = null;

// ── DOM references ────────────────────────────────────────────────────────────

const gameToolsUndo = document.getElementById("game-tools-undo");
const gameToolsRedo = document.getElementById("game-tools-redo");
const gameView = document.getElementById("game-view");
const bemMapArea = document.getElementById("bem-map-area");
const gameRevealOverlay = document.getElementById("game-reveal-overlay");
const classicViewCardBtn = document.getElementById("classic-view-card-btn");

// ── Initialization ────────────────────────────────────────────────────────────

/**
 * Initialises the game state manager with shared state accessors and UI callbacks.
 * Must be called once from initDeck() before any game actions are taken.
 * @param {object} context - Context object with state accessors and callbacks.
 */
export function initGameStateManager(context) {
  ctx = context;
}

// ── History accessors (exported for game-ui.js syncGameToolsState) ────────────

/** @returns {object[]} The current undo history stack. */
export function getGameHistory() { return gameHistory; }

/** @returns {object[]} The current redo stack. */
export function getGameRedoStack() { return gameRedoStack; }

// ── State cloning ─────────────────────────────────────────────────────────────

/**
 * Creates a deep clone of a game state object suitable for history storage.
 * @param {object | null} state - The game state to clone.
 * @returns {object | null} A deep clone with dieRolling reset to false.
 */
function cloneGameState(state) {
  if (!state) return null;
  const clone = { ...state };
  clone.remaining = [...state.remaining];
  clone.activePlanes = [...state.activePlanes];
  clone.exiled = [...state.exiled];
  if (state.recentPhenomena) clone.recentPhenomena = [...state.recentPhenomena];
  if (state.bemGrid instanceof Map) {
    const gridClone = new Map();
    for (const [key, cell] of state.bemGrid) {
      gridClone.set(key, { ...cell });
    }
    clone.bemGrid = gridClone;
  }
  if (state.bemPos) clone.bemPos = { ...state.bemPos };
  if (state.bemHellridedPositions instanceof Set) {
    clone.bemHellridedPositions = new Set(state.bemHellridedPositions);
  }
  clone.dieRolling = false;
  clone._dieResetTimer = null;
  return clone;
}

// ── History management ────────────────────────────────────────────────────────

/**
 * Pushes the current game state onto the undo history stack and clears redo.
 */
export function pushGameHistory() {
  const gameState = ctx.getGameState();
  if (!gameState) return;
  if (gameHistory.length >= MAX_GAME_HISTORY) gameHistory.shift();
  gameHistory.push(cloneGameState(gameState));
  gameRedoStack = [];
  if (gameToolsUndo) gameToolsUndo.disabled = false;
  if (gameToolsRedo) gameToolsRedo.disabled = true;
}

/**
 * Reverts the game state to the previous history entry (undo).
 */
export function undoLastAction() {
  const gameState = ctx.getGameState();
  if (gameHistory.length === 0) {
    ctx.showToast("Nothing to undo.");
    return;
  }
  gameRedoStack.push(cloneGameState(gameState));
  const prev = gameHistory.pop();
  clearTimeout(gameState?._dieResetTimer);
  ctx.setGameState(prev);
  ctx.closePlaneswalkerPopup();
  ctx.closeChaosPopup();
  resetBemState();
  ctx.updateCostDisplay();
  const restored = ctx.getGameState();
  if (restored.mode === "bem") {
    renderBemMap();
    updateBemInfoBar();
  } else {
    ctx.updateGameView();
  }
  syncBemTrButton();
  ctx.syncGameToolsState(restored.remaining.length);
  ctx.updatePhenomenonBanner?.();
  ctx.closeAllGameMenus();
  if (gameToolsUndo) gameToolsUndo.disabled = gameHistory.length === 0;
  if (gameToolsRedo) gameToolsRedo.disabled = false;
  ctx.showToast("Action undone.");
}

/**
 * Re-applies the last undone game state (redo).
 */
export function redoNextAction() {
  const gameState = ctx.getGameState();
  if (gameRedoStack.length === 0) {
    ctx.showToast("Nothing to redo.");
    return;
  }
  gameHistory.push(cloneGameState(gameState));
  const next = gameRedoStack.pop();
  clearTimeout(gameState?._dieResetTimer);
  ctx.setGameState(next);
  ctx.closePlaneswalkerPopup();
  ctx.closeChaosPopup();
  resetBemState();
  ctx.updateCostDisplay();
  const restored = ctx.getGameState();
  if (restored.mode === "bem") {
    renderBemMap();
    updateBemInfoBar();
  } else {
    ctx.updateGameView();
  }
  syncBemTrButton();
  ctx.syncGameToolsState(restored.remaining.length);
  ctx.updatePhenomenonBanner?.();
  ctx.closeAllGameMenus();
  if (gameToolsUndo) gameToolsUndo.disabled = false;
  if (gameToolsRedo) gameToolsRedo.disabled = gameRedoStack.length === 0;
  ctx.showToast("Action redone.");
}

// ── Game state encoding / decoding ────────────────────────────────────────────

/**
 * Encodes the current game state to a "g2:" seed string for saving or sharing.
 * @returns {string} The encoded seed, or an empty string on failure.
 */
export function encodeGameState() {
  const gameState = ctx.getGameState();
  const revealedCards = ctx.getRevealedCards();
  if (!gameState) return "";
  if (gameState.mode === "bem") {
    const grid = [];
    for (const [key, cell] of gameState.bemGrid.entries()) {
      const [x, y] = key.split(",").map(Number);
      if (cell.placeholder && !cell.card) {
        grid.push([x, y, null, 1, null, true]);
      } else {
        const entry = [x, y, compressKey(cell.card.id), cell.faceUp ? 1 : 0];
        if (cell.queuedCard) entry.push(compressKey(cell.queuedCard.id));
        grid.push(entry);
      }
    }
    const obj = {
      m: "bem",
      r: gameState.remaining.map((c) => compressKey(c.id)),
      a: gameState.activePlanes.map((c) => compressKey(c.id)),
      e: gameState.exiled.map((c) => compressKey(c.id)),
      c: gameState.chaosCost,
      g: grid,
      px: gameState.bemPos.x,
      py: gameState.bemPos.y
    };
    try {
      return "g2:" + toBase64Url(JSON.stringify(obj));
    } catch {
      return "";
    }
  }
  const obj = {
    r: gameState.remaining.map((c) => compressKey(c.id)),
    a: gameState.activePlanes.map((c) => compressKey(c.id)),
    f: gameState.focusedIndex,
    c: gameState.chaosCost,
    e: gameState.exiled.map((c) => compressKey(c.id))
  };
  if (revealedCards.length > 0) {
    obj.rv = revealedCards.map((c) => compressKey(c.id));
  }
  try {
    return "g2:" + toBase64Url(JSON.stringify(obj));
  } catch {
    return "";
  }
}

/**
 * Decodes a "g2:" or legacy "g1:" seed string back into a game state object.
 * @param {string | null | undefined} seed - The seed string to decode.
 * @returns {object | null} The decoded game state, or null if invalid.
 */
export function decodeGameState(seed) {
  const isLegacy = seed?.startsWith("g1:");
  if (!seed?.startsWith("g2:") && !isLegacy) return null;
  const allCards = ctx.getAllCards();
  try {
    const raw = fromBase64Url(seed.slice(3));
    const obj = JSON.parse(raw);
    const lookupCard = (ck) => {
      let id = decompressKey(ck);
      if (!id) return null;
      if (isLegacy) id = remapLegacyKey(id);
      return allCards.find((c) => c.id === id) || null;
    };
    if (obj.m === "bem") {
      const remaining = (obj.r || []).map(lookupCard).filter(Boolean);
      const activePlanes = (obj.a || []).map(lookupCard).filter(Boolean);
      const exiled = (obj.e || []).map(lookupCard).filter(Boolean);
      const chaosCost = typeof obj.c === "number" ? Math.max(0, obj.c) : 0;
      const bemGrid = new Map();
      for (const [x, y, ck, fu, qck, ph] of (obj.g || [])) {
        if (ph) {
          bemGrid.set(bemKey(x, y), { card: null, faceUp: true, placeholder: true });
        } else {
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
      }
      const bemPos = {
        x: typeof obj.px === "number" ? obj.px : 0,
        y: typeof obj.py === "number" ? obj.py : 0
      };
      return { mode: "bem", remaining, activePlanes, focusedIndex: 0, exiled, chaosCost, bemGrid, bemPos };
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

/**
 * Persists the current game state to localStorage for session restoration.
 */
export function autoSaveGameState() {
  if (!ctx.getGameState()) return;
  try {
    const seed = encodeGameState();
    if (seed) localStorage.setItem(GAME_STATE_AUTOSAVE_KEY, seed);
  } catch {
    // ignore storage errors
  }
}

// ── Game lifecycle ────────────────────────────────────────────────────────────

/**
 * Restores a game from a previously decoded game state object.
 * @param {object} decoded - A decoded game state returned by decodeGameState().
 */
export function startGameFromState(decoded) {
  clearTimeout(ctx.getGameState()?._dieResetTimer);
  gameHistory.length = 0;
  gameRedoStack = [];
  if (gameToolsUndo) gameToolsUndo.disabled = true;
  if (gameToolsRedo) gameToolsRedo.disabled = true;
  if (decoded.mode === "bem") {
    ctx.setGameState({
      mode: "bem",
      remaining: decoded.remaining,
      exiled: decoded.exiled,
      chaosCost: decoded.chaosCost,
      dieRolling: false,
      _dieResetTimer: null,
      activePlanes: decoded.activePlanes ?? [],
      focusedIndex: 0,
      bemGrid: decoded.bemGrid,
      bemPos: decoded.bemPos
    });
    ctx.setRevealedCards([]);

    ctx.setGameActive(true);
    ctx.closeDeckPanel();
    document.body.classList.add("game-open");
    gameView?.classList.remove("hidden");
    gameView?.classList.add("bem-active");
    bemMapArea?.classList.remove("hidden");
    ctx.resetDieIcon();
    ctx.updateCostDisplay();
    renderBemMap();
    updateBemInfoBar();
    syncBemTrButton();
  } else {
    ctx.setGameState({
      mode: "classic",
      remaining: decoded.remaining,
      activePlanes: decoded.activePlanes,
      focusedIndex: decoded.focusedIndex,
      dieRolling: false,
      chaosCost: decoded.chaosCost,
      exiled: decoded.exiled,
      _dieResetTimer: null
    });
    ctx.setRevealedCards(decoded.revealed);

    ctx.setGameActive(true);
    ctx.closeDeckPanel();
    document.body.classList.add("game-open");
    gameView?.classList.remove("hidden");
    gameView?.classList.remove("bem-active");
    bemMapArea?.classList.add("hidden");
    ctx.resetDieIcon();
    ctx.updateCostDisplay();
    syncBemTrButton();

    if (ctx.getGameState().activePlanes.length > 0) {
      ctx.updateGameView();
    } else {
      ctx.showGamePlaceholder();
    }

    if (ctx.getRevealedCards().length > 0) {
      ctx.renderRevealCards();
      ctx.updateRevealFooter();
      gameRevealOverlay?.classList.remove("hidden");
    }
  }

  if (window.location.hash !== "#play") {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}#play`);
  }

  ctx.updatePhenomenonBanner?.();
}

/**
 * Terminates the current game and resets all game state.
 * @param {{ updateHash?: boolean }} [options]
 */
export function exitGame({ updateHash = true } = {}) {
  clearTimeout(ctx.getGameState()?._dieResetTimer);
  ctx.setGameActive(false);
  ctx.setGameState(null);
  gameHistory.length = 0;
  gameRedoStack = [];
  if (gameToolsUndo) gameToolsUndo.disabled = true;
  if (gameToolsRedo) gameToolsRedo.disabled = true;
  ctx.setRevealedCards([]);
  resetBemState();
  try { localStorage.removeItem(GAME_STATE_AUTOSAVE_KEY); } catch { /* ignore */ }
  ctx.setReaderOpenedFromReveal(false);
  document.body.classList.remove("game-open");
  gameView?.classList.add("hidden");
  gameView?.classList.remove("bem-active");
  bemMapArea?.classList.add("hidden");
  gameRevealOverlay?.classList.add("hidden");
  ctx.closePlaneswalkerPopup();
  ctx.closeChaosPopup();
  ctx.closeGameReaderView();
  ctx.closeAllGameMenus();
  ctx.updatePhenomenonBanner?.();
  syncBemTrButton();
  if (classicViewCardBtn) classicViewCardBtn.classList.add("hidden");

  if (updateHash && window.location.hash === "#play") {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
  }
}

/**
 * Resets the current game to its initial state with a reshuffled deck.
 */
export function resetGame() {
  const gameState = ctx.getGameState();
  if (!gameState) return;
  clearTimeout(gameState._dieResetTimer);
  gameHistory.length = 0;
  gameRedoStack = [];
  if (gameToolsUndo) gameToolsUndo.disabled = true;
  if (gameToolsRedo) gameToolsRedo.disabled = true;
  ctx.closeAllGameMenus();
  ctx.resetDieIcon();
  if (gameState.mode === "bem") {
    startBemGame();
  } else {
    const shuffled = shuffleArray(ctx.buildDeckArray());
    ctx.setGameState({
      mode: "classic",
      remaining: shuffled,
      activePlanes: [],
      focusedIndex: 0,
      dieRolling: false,
      chaosCost: 0,
      exiled: [],
      recentPhenomena: [],
      _dieResetTimer: null
    });
    ctx.showGamePlaceholder();
    ctx.updateCostDisplay();
    ctx.updatePhenomenonBanner?.();
    ctx.showToast("Deck reshuffled and reset.");
  }
}
