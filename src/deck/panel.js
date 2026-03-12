// ── deck-panel.js ─────────────────────────────────────────────────────────────
// Deck panel UI: open/close/shelve, list rendering, slot management,
// card overlays, auto-import, and deck import/export.

import { escapeHtml, isHiddenCard } from "../gallery/utils.js";
import { encodeDeck, decodeDeck } from "./codec.js";

// ── Module state ──────────────────────────────────────────────────────────────

let deckPanelOpen = false;
let deckPanelShelved = false;

// ── Context (set by initDeckPanel) ───────────────────────────────────────────

let ctx = null;

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

// ── Initialization ────────────────────────────────────────────────────────────

/**
 * Initialises the deck panel module with shared state accessors and callbacks.
 * Binds all deck panel DOM events.
 * @param {object} context - Shared context from deck.js.
 */
export function initDeckPanel(context) {
  ctx = context;
  bindDeckPanelEvents();
}

// ── Panel open/close/shelve ───────────────────────────────────────────────────

/** Toggles the deck panel open or closed. */
export function toggleDeckPanel() {
  if (deckPanelOpen || deckPanelShelved) closeDeckPanel();
  else openDeckPanel();
}

/** Opens the deck panel. */
export function openDeckPanel() {
  deckPanelOpen = true;
  deckPanelShelved = false;
  deckPanel?.classList.remove("hidden", "shelved");
  deckButton?.classList.add("deck-panel-open");
  const total = ctx.getDeckTotal();
  if (deckButtonBadge) {
    deckButtonBadge.textContent = total > 0 ? String(total) : "";
    deckButtonBadge.classList.toggle("hidden", total === 0);
  }
  renderDeckList();
  ctx.onDeckChange();
  requestAnimationFrame(() => {
    deckPanel?.classList.add("open");
  });
}

/** Closes the deck panel. */
export function closeDeckPanel() {
  deckPanelOpen = false;
  deckPanelShelved = false;
  deckPanel?.classList.remove("open", "shelved");
  deckButton?.classList.remove("deck-panel-open");
  deckAutoimportMenu?.classList.add("hidden");
  deckButtonBadge?.classList.add("hidden");
  ctx.onDeckChange();
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
  ctx.onDeckChange();
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
  ctx.onDeckChange();
}

/** @returns {boolean} True if the deck panel is open or shelved. */
export function isDeckPanelOpen() {
  return deckPanelOpen || deckPanelShelved;
}

// ── Deck list rendering ───────────────────────────────────────────────────────

/** Re-renders the full sorted deck card list inside the panel. */
export function renderDeckList() {
  if (!deckCardList) return;
  deckCardList.innerHTML = "";

  const deck = ctx.deckCards();
  if (deck.size === 0) {
    deckCardList.innerHTML = `<p class="deck-empty-state">No cards yet. Browse the gallery and use the <strong>+</strong> buttons to add cards.</p>`;
    return;
  }

  const allCards = ctx.getAllCards();
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
        <button class="deck-count-btn" data-key="${escapeHtml(key)}" data-action="inc" aria-label="Add one copy" type="button"${count >= ctx.MAX_CARD_COUNT ? " disabled" : ""}>+</button>
      </div>
    `;

    for (const btn of item.querySelectorAll(".deck-count-btn")) {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "inc") ctx.addCardToDeck(key);
        else if (action === "dec") ctx.removeCardFromDeck(key);
      });
    }

    deckCardList.appendChild(item);
  }
}

// ── Deck slot management ──────────────────────────────────────────────────────

/**
 * Switches the active deck slot and refreshes the panel.
 * @param {number} slot - The slot index to switch to (0-based).
 */
export function switchDeckSlot(slot) {
  if (slot < 0 || slot >= ctx.NUM_DECK_SLOTS) return;
  if (slot === ctx.getCurrentSlot()) return;
  ctx.setCurrentSlot(slot);
  ctx.saveDecksToStorage();
  renderDeckList();
  renderDeckSlotDropdown();
  updateDeckButton();
  updateAllCardOverlays();
}

/**
 * Re-renders the slot selector dropdown.
 * @param {{ updateNameInput?: boolean }} [options]
 */
export function renderDeckSlotDropdown({ updateNameInput = true } = {}) {
  if (!deckSlotSelect) return;
  deckSlotSelect.innerHTML = "";
  const deckNames = ctx.getDeckNames();
  const currentSlot = ctx.getCurrentSlot();
  const allDecks = ctx.getAllDecks();
  for (let i = 0; i < ctx.NUM_DECK_SLOTS; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    const count = [...allDecks[i].values()].reduce((a, b) => a + b, 0);
    opt.textContent = `${deckNames[i]}${count > 0 ? ` (${count})` : ""}`;
    if (i === currentSlot) opt.selected = true;
    deckSlotSelect.appendChild(opt);
  }
  if (updateNameInput && deckSlotNameInput) {
    deckSlotNameInput.value = deckNames[currentSlot];
  }
}

// ── Deck button ───────────────────────────────────────────────────────────────

/** Updates the deck button badge and aria-label to reflect the current deck size. */
export function updateDeckButton() {
  const total = ctx.getDeckTotal();
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

// ── Card item refresh ─────────────────────────────────────────────────────────

/**
 * Efficiently updates a single card item in the deck panel list without a full re-render.
 * @param {string} cardKey - The card key to refresh.
 */
export function refreshDeckCardItem(cardKey) {
  if (!deckCardList || !deckPanelOpen) return;
  const deck = ctx.deckCards();
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
  if (incBtn) incBtn.disabled = count >= ctx.MAX_CARD_COUNT;
}

// ── Card overlays ─────────────────────────────────────────────────────────────

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

/**
 * Updates all visible deck overlays and list rows for a single card key.
 * @param {string} cardKey
 */
export function updateCardOverlays(cardKey) {
  const count = ctx.deckCards().get(cardKey) || 0;
  for (const overlay of document.querySelectorAll(`.deck-card-overlay[data-card-key="${CSS.escape(cardKey)}"]`)) {
    applyOverlayCount(overlay, count);
  }
  for (const row of document.querySelectorAll(`.list-card-row[data-card-key="${CSS.escape(cardKey)}"]`)) {
    applyListRowCount(row, count);
  }
}

/** Updates all visible deck overlays and list rows for every card in the gallery. */
export function updateAllCardOverlays() {
  for (const overlay of document.querySelectorAll(".deck-card-overlay")) {
    const key = overlay.dataset.cardKey;
    if (!key) continue;
    const count = ctx.deckCards().get(key) || 0;
    applyOverlayCount(overlay, count);
  }
  for (const row of document.querySelectorAll(".list-card-row[data-card-key]")) {
    const key = row.dataset.cardKey;
    if (!key) continue;
    const count = ctx.deckCards().get(key) || 0;
    applyListRowCount(row, count);
  }
}

// ── Modal deck button ─────────────────────────────────────────────────────────

/**
 * Updates the modal's "+ Deck" / "In Deck" button state for a given card.
 * @param {string} cardKey
 */
export function updateModalDeckButton(cardKey) {
  if (!modalAddToDeckBtn || modalAddToDeckBtn.dataset.cardKey !== cardKey) return;
  const count = ctx.deckCards().get(cardKey) || 0;
  modalAddToDeckBtn.textContent = count > 0 ? "In Deck" : "+ Deck";
  modalAddToDeckBtn.classList.toggle("deck-in-deck", count > 0);
  if (modalDeckQty) {
    modalDeckQty.classList.toggle("hidden", count === 0);
    if (modalDeckCount) modalDeckCount.textContent = count;
    if (modalDeckDec) modalDeckDec.disabled = count <= 0;
    if (modalDeckInc) modalDeckInc.disabled = count >= ctx.MAX_CARD_COUNT;
  }
}

/**
 * Sets the card key tracked by the modal deck button and refreshes its display.
 * @param {string} cardKey
 */
export function setModalCardKey(cardKey) {
  if (!modalAddToDeckBtn) return;
  modalAddToDeckBtn.dataset.cardKey = cardKey;
  updateModalDeckButton(cardKey);
}

// ── Auto-import ───────────────────────────────────────────────────────────────

function buildAutoimportTagList() {
  if (!deckAutoimportTagList) return;
  deckAutoimportTagList.innerHTML = "";
  const allCards = ctx.getAllCards();
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
      autoImportCards(`tag:${tag}`);
      deckAutoimportMenu?.classList.add("hidden");
    });
    deckAutoimportTagList.appendChild(btn);
  }
}

/**
 * Auto-imports cards matching a filter into the current deck slot.
 * Named filters: "official", "custom", "planes", "phenomena".
 * Prefixed filter: "tag:<tagName>" imports all cards with that tag (case-insensitive).
 * @param {string} filter - The filter string.
 */
function autoImportCards(filter) {
  const allCards = ctx.getAllCards();
  const deck = ctx.deckCards();

  let candidates;
  switch (filter) {
    case "all":
      candidates = allCards.filter((c) => !isHiddenCard(c.normalizedTags));
      break;
    case "official":
      candidates = allCards.filter((c) => !isHiddenCard(c.normalizedTags) && c.normalizedTags.some((t) => t.includes("official")));
      break;
    case "custom":
      candidates = allCards.filter((c) => !isHiddenCard(c.normalizedTags) && c.normalizedTags.some((t) => t.includes("custom")));
      break;
    case "planes":
      candidates = allCards.filter((c) => c.type === "Plane" && !isHiddenCard(c.normalizedTags));
      break;
    case "phenomena":
      candidates = allCards.filter((c) => c.type === "Phenomenon" && !isHiddenCard(c.normalizedTags));
      break;
    default:
      if (filter.startsWith("tag:")) {
        const tag = filter.slice(4).toLowerCase();
        candidates = allCards.filter((c) => c.normalizedTags.includes(tag) && !isHiddenCard(c.normalizedTags));
      } else {
        candidates = allCards.filter((c) => !isHiddenCard(c.normalizedTags) && c.normalizedTags.includes(filter.toLowerCase()));
      }
  }

  let added = 0;
  for (const card of candidates) {
    if (!deck.has(card.key)) {
      deck.set(card.key, 1);
      added++;
    }
  }

  ctx.saveDecksToStorage();
  updateDeckButton();
  renderDeckList();
  updateAllCardOverlays();
  renderDeckSlotDropdown();
  ctx.showToast(added > 0 ? `Added ${added} card${added !== 1 ? "s" : ""} to deck.` : "No new cards to add.");
}

// ── Import / Export ───────────────────────────────────────────────────────────

/** Encodes the current deck to a seed and copies it to the clipboard. */
export function exportDeckSeed() {
  const seed = encodeDeck(ctx.deckCards());
  if (!seed) { ctx.showToast("Deck is empty."); return; }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(seed).then(() => ctx.showToast("Deck seed copied!")).catch(() => prompt("Copy this deck seed:", seed));
  } else {
    prompt("Copy this deck seed:", seed);
  }
}

/** Prompts the user for a deck seed and imports it into the current deck slot. */
export function importDeckPrompt() {
  const seed = prompt("Paste a deck seed to import:");
  if (!seed?.trim()) return;
  const decoded = decodeDeck(seed.trim());
  if (decoded.size === 0) { ctx.showToast("Invalid deck seed."); return; }
  const valid = ctx.filterValidDeck(decoded);
  const skipped = decoded.size - valid.size;
  ctx.setCurrentDeckMap(valid);
  ctx.saveDecksToStorage();
  updateDeckButton();
  renderDeckList();
  updateAllCardOverlays();
  renderDeckSlotDropdown();
  const total = ctx.getDeckTotal();
  if (skipped > 0) {
    ctx.showToast(`Imported ${total} cards (${skipped} unknown card${skipped > 1 ? "s" : ""} skipped).`);
  } else {
    ctx.showToast(`Imported deck: ${total} card${total !== 1 ? "s" : ""}.`);
  }
}

/** Encodes the current deck as a shareable link and copies it to the clipboard. */
export function shareDeckLink() {
  const seed = encodeDeck(ctx.deckCards());
  if (!seed) { ctx.showToast("Deck is empty."); return; }
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.set("deck", seed);
  const urlStr = url.toString();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(urlStr).then(() => ctx.showToast("Deck link copied!")).catch(() => prompt("Copy this deck link:", urlStr));
  } else {
    prompt("Copy this deck link:", urlStr);
  }
}

// ── Event binding ─────────────────────────────────────────────────────────────

function bindDeckPanelEvents() {
  deckButton?.addEventListener("click", toggleDeckPanel);
  deckCloseBtn?.addEventListener("click", closeDeckPanel);
  deckPlayBtn?.addEventListener("click", () => ctx.showGameModeDialog());
  deckClearBtn?.addEventListener("click", () => ctx.clearDeck());
  deckExportBtn?.addEventListener("click", exportDeckSeed);
  deckImportBtn?.addEventListener("click", importDeckPrompt);
  deckLinkBtn?.addEventListener("click", shareDeckLink);

  deckSlotSelect?.addEventListener("change", () => {
    const slot = parseInt(deckSlotSelect.value, 10);
    if (!isNaN(slot)) switchDeckSlot(slot);
  });

  deckSlotNameInput?.addEventListener("input", () => {
    const rawValue = deckSlotNameInput.value;
    const deckNames = ctx.getDeckNames();
    deckNames[ctx.getCurrentSlot()] = rawValue.trim() || `Deck ${ctx.getCurrentSlot() + 1}`;
    ctx.setDeckNames(deckNames);
    ctx.saveDeckNamesToStorage();
    const savedValue = rawValue;
    renderDeckSlotDropdown({ updateNameInput: false });
    if (deckSlotNameInput) deckSlotNameInput.value = savedValue;
  });

  deckSlotNameInput?.addEventListener("blur", () => {
    if (deckSlotNameInput && !deckSlotNameInput.value.trim()) {
      const deckNames = ctx.getDeckNames();
      deckNames[ctx.getCurrentSlot()] = `Deck ${ctx.getCurrentSlot() + 1}`;
      ctx.setDeckNames(deckNames);
      ctx.saveDeckNamesToStorage();
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
    const count = ctx.deckCards().get(cardKey) || 0;
    if (count === 0) ctx.addCardToDeck(cardKey);
  });

  modalDeckDec?.addEventListener("click", () => {
    const cardKey = modalAddToDeckBtn?.dataset.cardKey;
    if (cardKey) ctx.removeCardFromDeck(cardKey);
  });

  modalDeckInc?.addEventListener("click", () => {
    const cardKey = modalAddToDeckBtn?.dataset.cardKey;
    if (cardKey) ctx.addCardToDeck(cardKey);
  });
}
