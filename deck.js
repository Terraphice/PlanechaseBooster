import { escapeHtml, shuffleArray, isHiddenCard } from "./gallery-utils.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const DECK_STORAGE_KEY = "planar-atlas-decks-v2";
const NUM_DECK_SLOTS = 3;
const MAX_CARD_COUNT = 9;

// ── Module state ──────────────────────────────────────────────────────────────

let allCards = [];
let allDecks = [new Map(), new Map(), new Map()];
let currentSlot = 0;
let deckPanelOpen = false;
let gameActive = false;
let gameState = null;
let showToastFn = null;
let onDeckChangeFn = null;

function deckCards() {
  return allDecks[currentSlot];
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
const modalAddToDeckBtn = document.getElementById("modal-add-to-deck");
const modalDeckQty = document.getElementById("modal-deck-qty");
const modalDeckDec = document.getElementById("modal-deck-dec");
const modalDeckInc = document.getElementById("modal-deck-inc");
const modalDeckCount = document.getElementById("modal-deck-count");

const gameView = document.getElementById("game-view");
const gameCardImageBtn = document.getElementById("game-card-image-btn");
const gameCardImage = document.getElementById("game-card-image");
const gameCardName = document.getElementById("game-card-name");
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
const gameReaderClose = document.getElementById("game-reader-close");
const gameReaderBackdrop = document.getElementById("game-reader-backdrop");

// ── Initialization ────────────────────────────────────────────────────────────

export function initDeck({ cards, showToast, onDeckChange }) {
  allCards = cards;
  showToastFn = showToast;
  onDeckChangeFn = onDeckChange;

  const stored = loadDecksFromStorage();
  allDecks = stored.decks;
  currentSlot = stored.slot;

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
  renderDeckSlotButtons();
  updateDeckButton();

  if (window.location.hash === "#play") {
    if (getDeckTotal() > 0) {
      startGame();
    } else {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }
}

// ── Deck slot management ──────────────────────────────────────────────────────

function renderDeckSlotButtons() {
  const buttons = document.querySelectorAll(".deck-slot-btn");
  for (const btn of buttons) {
    const slot = parseInt(btn.dataset.slot, 10);
    btn.classList.toggle("active", slot === currentSlot);
    const total = [...allDecks[slot].values()].reduce((a, b) => a + b, 0);
    btn.textContent = `Deck ${slot + 1}${total > 0 ? ` (${total})` : ""}`;
  }
}

function switchDeckSlot(slot) {
  if (slot === currentSlot) return;
  currentSlot = slot;
  saveDecksToStorage();
  renderDeckSlotButtons();
  updateDeckButton();
  if (deckPanelOpen) renderDeckList();
  updateAllCardOverlays();
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
  renderDeckSlotButtons();
  showToastFn?.(count > 0 ? `Added ${count} card${count !== 1 ? "s" : ""} to deck.` : "No new cards to add.");
}

// ── Events ────────────────────────────────────────────────────────────────────

function bindDeckEvents() {
  deckButton?.addEventListener("click", toggleDeckPanel);
  deckCloseBtn?.addEventListener("click", closeDeckPanel);
  deckPlayBtn?.addEventListener("click", startGame);
  deckClearBtn?.addEventListener("click", clearDeck);
  deckExportBtn?.addEventListener("click", exportDeckSeed);
  deckImportBtn?.addEventListener("click", importDeckPrompt);
  deckLinkBtn?.addEventListener("click", shareDeckLink);

  for (const btn of document.querySelectorAll(".deck-slot-btn")) {
    btn.addEventListener("click", () => switchDeckSlot(parseInt(btn.dataset.slot, 10)));
  }

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

  gameBtnTr?.addEventListener("click", gamePlaneswalk);
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

  gameOptExit?.addEventListener("click", exitGame);
  gameOptReset?.addEventListener("click", resetGame);
  gameOptDeckBuilder?.addEventListener("click", () => {
    exitGame();
    openDeckPanel();
  });

  gameCostReset?.addEventListener("click", () => {
    if (gameState) {
      gameState.chaosCost = 0;
      updateCostDisplay();
    }
  });

  gameCardImageBtn?.addEventListener("click", openGameReaderView);

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
}

// ── Deck panel ────────────────────────────────────────────────────────────────

function toggleDeckPanel() {
  if (deckPanelOpen) closeDeckPanel();
  else openDeckPanel();
}

function openDeckPanel() {
  deckPanelOpen = true;
  deckPanel?.classList.remove("hidden");
  deckButton?.classList.add("deck-panel-open");
  renderDeckList();
  onDeckChangeFn?.();
  // Defer adding .open so the CSS transition plays after display:none → flex
  requestAnimationFrame(() => {
    deckPanel?.classList.add("open");
  });
}
export function closeDeckPanel() {
  deckPanelOpen = false;
  deckPanel?.classList.remove("open");
  deckButton?.classList.remove("deck-panel-open");
  deckAutoimportMenu?.classList.add("hidden");
  onDeckChangeFn?.();
  // Re-hide after transition so it's out of tab order
  const panel = deckPanel;
  if (panel) {
    const onEnd = () => {
      if (!panel.classList.contains("open")) panel.classList.add("hidden");
      panel.removeEventListener("transitionend", onEnd);
    };
    panel.addEventListener("transitionend", onEnd);
  }
}

export function isDeckPanelOpen() {
  return deckPanelOpen;
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
  renderDeckSlotButtons();
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
  renderDeckSlotButtons();
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
  renderDeckSlotButtons();
  showToastFn?.("Deck cleared.");
}

function updateDeckButton() {
  const total = getDeckTotal();
  if (deckButtonBadge) {
    deckButtonBadge.textContent = total > 0 ? String(total) : "";
    deckButtonBadge.classList.toggle("hidden", total === 0);
  }
  if (deckButton) {
    deckButton.classList.toggle("deck-has-cards", total > 0);
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

function updateCardOverlays(cardKey) {
  const count = deckCards().get(cardKey) || 0;
  for (const overlay of document.querySelectorAll(`.deck-card-overlay[data-card-key="${CSS.escape(cardKey)}"]`)) {
    const countEl = overlay.querySelector(".deck-overlay-count");
    if (countEl) countEl.textContent = count > 0 ? count : "";
    overlay.classList.toggle("deck-has-count", count > 0);
  }
}

function updateAllCardOverlays() {
  for (const overlay of document.querySelectorAll(".deck-card-overlay")) {
    const key = overlay.dataset.cardKey;
    if (!key) continue;
    const count = deckCards().get(key) || 0;
    const countEl = overlay.querySelector(".deck-overlay-count");
    if (countEl) countEl.textContent = count > 0 ? count : "";
    overlay.classList.toggle("deck-has-count", count > 0);
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
  renderDeckSlotButtons();
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

// ── Storage ───────────────────────────────────────────────────────────────────

function loadDecksFromStorage() {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    if (!raw) return { slot: 0, decks: [new Map(), new Map(), new Map()] };
    const parsed = JSON.parse(raw);
    const slot = typeof parsed.slot === "number" && parsed.slot >= 0 && parsed.slot < NUM_DECK_SLOTS ? parsed.slot : 0;
    const decks = Array.isArray(parsed.decks)
      ? parsed.decks.slice(0, NUM_DECK_SLOTS).map((d) => {
          if (!Array.isArray(d)) return new Map();
          return new Map(d.filter(([k, v]) => typeof k === "string" && typeof v === "number" && v > 0 && v <= MAX_CARD_COUNT));
        })
      : [];
    while (decks.length < NUM_DECK_SLOTS) decks.push(new Map());
    return { slot, decks };
  } catch {
    return { slot: 0, decks: [new Map(), new Map(), new Map()] };
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

function startGame() {
  const total = getDeckTotal();
  if (total === 0) { showToastFn?.("Add cards to your deck first."); return; }

  const shuffled = shuffleArray(buildDeckArray());
  gameState = {
    remaining: shuffled,
    activePlanes: [],
    focusedIndex: 0,
    dieRolling: false,
    chaosCost: 0,
    _dieResetTimer: null
  };

  gameActive = true;
  closeDeckPanel();
  document.body.classList.add("game-open");
  gameView?.classList.remove("hidden");
  showGamePlaceholder();
  resetDieIcon();
  updateCostDisplay();

  if (window.location.hash !== "#play") {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}#play`);
  }
}

function exitGame({ updateHash = true } = {}) {
  clearTimeout(gameState?._dieResetTimer);
  gameActive = false;
  gameState = null;
  document.body.classList.remove("game-open");
  gameView?.classList.add("hidden");
  closeAllGameMenus();

  if (updateHash && window.location.hash === "#play") {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
  }
}

function resetGame() {
  if (!gameState) return;
  clearTimeout(gameState._dieResetTimer);
  const shuffled = shuffleArray(buildDeckArray());
  gameState = {
    remaining: shuffled,
    activePlanes: [],
    focusedIndex: 0,
    dieRolling: false,
    chaosCost: 0,
    _dieResetTimer: null
  };
  showGamePlaceholder();
  closeAllGameMenus();
  resetDieIcon();
  updateCostDisplay();
  showToastFn?.("Deck reshuffled and reset.");
}

function gamePlaneswalk() {
  if (!gameState) return;

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
    gameCardImage.alt = "Press Planeswalk to begin";
  }
  if (gameCardName) gameCardName.textContent = "Press ▶ to planeswalk";
  if (gameSidePanel) gameSidePanel.innerHTML = "";
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
  if (gameCardName) {
    gameCardName.textContent = focused.displayName;
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
    sideCard.setAttribute("aria-label", `Switch to ${card.displayName}`);
    sideCard.innerHTML = `
      <img class="game-side-card-img" src="${card.thumbPath}" alt="${escapeHtml(card.displayName)}" />
      <div class="game-side-card-label">${escapeHtml(card.displayName)}</div>
    `;
    sideCard.addEventListener("click", () => {
      if (!gameState) return;
      gameState.focusedIndex = idx;
      updateGameView();
    });
    gameSidePanel.appendChild(sideCard);
  }
}

function syncGameToolsState(remainingCount) {
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
    gameToolsReturnTop.disabled = !gameState || gameState.activePlanes.length === 0;
  }
  if (gameToolsReturnBottom) {
    gameToolsReturnBottom.disabled = !gameState || gameState.activePlanes.length === 0;
  }
}

function openGameReaderView() {
  if (!gameState) return;
  const src = gameCardImage?.src;
  if (!src || src === window.location.href) return;
  if (gameReaderImage) {
    gameReaderImage.src = src;
    gameReaderImage.alt = gameCardImage?.alt ?? "";
  }
  gameReaderView?.classList.remove("hidden");
  document.body.classList.add("game-reader-open");
}

function closeGameReaderView() {
  gameReaderView?.classList.add("hidden");
  document.body.classList.remove("game-reader-open");
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
  for (const card of gameState.remaining) {
    const li = document.createElement("li");
    li.className = "game-deck-view-item";
    li.innerHTML = `<span class="game-deck-view-name">${escapeHtml(card.displayName)}</span><span class="game-deck-view-type">${escapeHtml(card.type)}</span>`;
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
  for (const card of gameState.remaining) {
    if (!seen.has(card.key) && card.displayName.toLowerCase().includes(query)) {
      seen.add(card.key);
      matches.push(card);
    }
    if (matches.length >= 8) break;
  }

  if (matches.length === 0) {
    gameToolsSearchResults.innerHTML = `<p class="game-search-empty">No matches in remaining library.</p>`;
    return;
  }

  for (const card of matches) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "game-search-result-btn";
    btn.textContent = card.displayName;
    btn.addEventListener("click", () => {
      const idx = gameState.remaining.findIndex((c) => c.key === card.key);
      if (idx !== -1) gameState.remaining.splice(idx, 1);
      gameState.activePlanes.push(card);
      updateGameView();
      closeAllGameMenus();
      showToastFn?.(`${card.displayName} added simultaneously.`);
    });
    gameToolsSearchResults.appendChild(btn);
  }
}

function toggleGameToolsMenu() {
  const isHidden = gameToolsMenu?.classList.contains("hidden");
  closeAllGameMenus();
  if (isHidden) {
    gameToolsMenu?.classList.remove("hidden");
    gameMenuSearchSection?.classList.add("hidden");
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
