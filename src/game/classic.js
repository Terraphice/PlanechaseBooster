// ── game-classic.js ───────────────────────────────────────────────────────────
// Rendering and game logic for the Classic shared-deck Planechase game mode.

import { escapeHtml, shuffleArray } from "../gallery/utils.js";

let ctx = null;

function ensureCounterState(gameState) {
  if (!gameState.cardCounters) gameState.cardCounters = new Map();
  if (!(gameState.counterTrackedIds instanceof Set)) gameState.counterTrackedIds = new Set();
}

function getCardCounter(gameState, cardId) {
  return gameState.cardCounters?.get(cardId) || 0;
}

function setCardCounter(gameState, cardId, nextValue) {
  ensureCounterState(gameState);
  if (nextValue <= 0) gameState.cardCounters.delete(cardId);
  else gameState.cardCounters.set(cardId, nextValue);
}

function addCounter(gameState, cardId, delta) {
  const current = getCardCounter(gameState, cardId);
  const next = Math.max(0, current + delta);
  setCardCounter(gameState, cardId, next);
  return next;
}

function trimCountersToCards(gameState) {
  ensureCounterState(gameState);
  const ids = new Set(gameState.activePlanes.map((card) => card.id));
  for (const id of [...gameState.counterTrackedIds]) {
    if (!ids.has(id)) {
      gameState.counterTrackedIds.delete(id);
      gameState.cardCounters.delete(id);
    }
  }
  for (const id of [...gameState.cardCounters.keys()]) {
    if (!ids.has(id)) gameState.cardCounters.delete(id);
  }
}

function clearTemporaryCountersForClassic(gameState, nextActiveCard) {
  if (ctx.getCounterBehavior?.() !== "temporary") return;
  ensureCounterState(gameState);
  const keepId = nextActiveCard?.id;
  for (const id of [...gameState.counterTrackedIds]) {
    if (id !== keepId) {
      gameState.counterTrackedIds.delete(id);
      gameState.cardCounters.delete(id);
    }
  }
}

export function initClassicGame(context) {
  ctx = context;
}

// ── Classic game startup ───────────────────────────────────────────────────────

export function startClassicGame() {
  const { setGameState, setGameActive, buildDeckArray, getDeckTotal, closeDeckPanel, showGamePlaceholder, resetDieIcon, updateCostDisplay, syncBemTrButton, showToast, gameView, bemMapArea } = ctx;

  const total = getDeckTotal();
  if (total === 0) { showToast("Add cards to your deck first."); return; }

  const shuffled = shuffleArray(buildDeckArray());
  setGameState({
    mode: "classic",
    remaining: shuffled,
    activePlanes: [],
    focusedIndex: 0,
    dieRolling: false,
    chaosCost: 0,
    exiled: [],
    recentPhenomena: [],
    cardCounters: new Map(),
    counterTrackedIds: new Set(),
    _dieResetTimer: null
  });

  setGameActive(true);
  closeDeckPanel();
  document.body.classList.add("game-open");
  gameView?.classList.remove("hidden");
  gameView?.classList.remove("bem-active");
  bemMapArea?.classList.add("hidden");
  showGamePlaceholder();
  resetDieIcon();
  updateCostDisplay();
  syncBemTrButton();
  ctx.updatePhenomenonBanner?.();

  if (window.location.hash !== "#play") {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}#play`);
  }
}

// ── Classic planeswalk ────────────────────────────────────────────────────────

export function gamePlaneswalk() {
  const { getGameState, updateGameView, showToast } = ctx;
  const gameState = getGameState();
  if (!gameState) return;
  if (gameState.mode === "bem") return;

  ctx.pushHistory?.();

  const { activePlanes, remaining } = gameState;

  if (!gameState.recentPhenomena) gameState.recentPhenomena = [];

  let hasPhenomenon = false;
  let hasNonPhenomenon = false;
  for (const card of activePlanes) {
    if (card.type === "Phenomenon") {
      hasPhenomenon = true;
      if (!gameState.recentPhenomena.includes(card)) {
        gameState.recentPhenomena.push(card);
      }
    } else {
      hasNonPhenomenon = true;
    }
  }

  if (!hasPhenomenon && hasNonPhenomenon && gameState.recentPhenomena.length > 0) {
    gameState.recentPhenomena = [];
  }

  for (const card of activePlanes) remaining.push(card);

  if (remaining.length === 0) {
    gameState.activePlanes = [];
    gameState.focusedIndex = 0;
    trimCountersToCards(gameState);
    updateGameView();
    showToast("No more planes in the library.");
    ctx.updatePhenomenonBanner?.();
    return;
  }

  const nextCard = remaining.shift();
  clearTemporaryCountersForClassic(gameState, nextCard);
  gameState.activePlanes = [nextCard];
  trimCountersToCards(gameState);
  gameState.focusedIndex = 0;
  updateGameView();
  ctx.updatePhenomenonBanner?.();
}

// ── Classic view rendering ────────────────────────────────────────────────────

export function updateClassicGameView(gameState) {
  const { syncGameToolsState, gameCardImage, gameCardImageBtn, classicViewCardBtn, classicCardNameLabel } = ctx;

  const { activePlanes, focusedIndex, remaining } = gameState;
  const focused = activePlanes[focusedIndex] ?? activePlanes[0];

  if (!focused) return;

  if (gameCardImage) {
    gameCardImage.src = focused.imagePath;
    gameCardImage.alt = focused.displayName;
  }
  if (gameCardImageBtn) {
    const getEasyPlaneswalk = ctx.getEasyPlaneswalk;
    gameCardImageBtn.setAttribute("aria-label", getEasyPlaneswalk() ? "Planeswalk" : "View card close-up");
    gameCardImageBtn.classList.remove("game-card-image-btn-placeholder");
    gameCardImageBtn.classList.toggle("active-plane", focused.type !== "Phenomenon");
    gameCardImageBtn.classList.toggle("active-phenomenon", focused.type === "Phenomenon");
  }

  if (classicViewCardBtn) {
    classicViewCardBtn.classList.remove("hidden");
    if (classicCardNameLabel) classicCardNameLabel.textContent = focused.displayName;
  }

  renderClassicSidePanel(activePlanes, focusedIndex);
  syncGameToolsState(remaining.length);
}

export function renderClassicSidePanel(activePlanes, focusedIndex) {
  const { getGameState, openGameReaderView, gameSidePanel } = ctx;

  if (!gameSidePanel) return;

  if (activePlanes.length <= 1) { gameSidePanel.innerHTML = ""; return; }

  gameSidePanel.innerHTML = "";

  const cycleBtn = document.createElement("button");
  cycleBtn.type = "button";
  cycleBtn.className = "game-cycle-btn";
  cycleBtn.setAttribute("aria-label", "Cycle active planes");
  cycleBtn.innerHTML = `<span class="game-cycle-icon" aria-hidden="true">↻</span>`;
  cycleBtn.addEventListener("click", () => {
    const gameState = getGameState();
    if (!gameState) return;
    gameState.focusedIndex = (focusedIndex + 1) % activePlanes.length;
    ctx.updateGameView();
  });
  gameSidePanel.appendChild(cycleBtn);

  for (let i = 0; i < activePlanes.length; i++) {
    if (i === focusedIndex) continue;
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

    const gameState = getGameState();
    ensureCounterState(gameState);
    if (gameState.counterTrackedIds.has(card.id)) {
      const counterWrap = document.createElement("div");
      counterWrap.className = "game-side-counter-wrap";
      const value = getCardCounter(gameState, card.id);
      counterWrap.innerHTML = `
        <button type="button" class="game-side-counter-toggle game-counter-glow" aria-label="Adjust counters">
          <span aria-hidden="true">⬤</span>
        </button>
        <div class="game-side-counter-controls">
          <button type="button" class="game-side-counter-step" data-step="-1" aria-label="Remove counter">−</button>
          <span class="game-side-counter-value">${value}</span>
          <button type="button" class="game-side-counter-step" data-step="1" aria-label="Add counter">+</button>
        </div>
      `;
      const toggle = counterWrap.querySelector(".game-side-counter-toggle");
      const controls = counterWrap.querySelector(".game-side-counter-controls");
      toggle?.addEventListener("click", (event) => {
        event.stopPropagation();
        controls?.classList.toggle("game-side-counter-controls-visible");
      });
      counterWrap.querySelectorAll(".game-side-counter-step").forEach((stepBtn) => {
        stepBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          const gs = getGameState();
          if (!gs) return;
          ctx.pushHistory?.();
          const delta = Number(stepBtn.dataset.step || 0);
          addCounter(gs, card.id, delta);
          ctx.updateGameView();
        });
      });
      sideCard.appendChild(counterWrap);
    }
    sideCard.addEventListener("click", () => {
      const gameState = getGameState();
      if (!gameState) return;
      openGameReaderView(card, buildSideCardActions(idx));
    });
    gameSidePanel.appendChild(sideCard);
  }
}

// ── Classic card action builders ──────────────────────────────────────────────

export function buildMainCardActions(focusedIdx) {
  const { getGameState, closeGameReaderView, updateGameView, showToast } = ctx;

  return [
    {
      label: "Add",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        if (gameState.remaining.length === 0) {
          showToast("No cards remaining in the library.");
          return;
        }
        ctx.pushHistory?.();
        const top = gameState.remaining.shift();
        gameState.activePlanes.push(top);
        closeGameReaderView();
        trimCountersToCards(gameState);
        updateGameView();
        showToast(`${top.displayName} added simultaneously.`);
      }
    },
    {
      label: "Counters",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        const card = gameState.activePlanes[focusedIdx];
        if (!card) return;
        ctx.pushHistory?.();
        ensureCounterState(gameState);
        gameState.counterTrackedIds.add(card.id);
        if (!gameState.cardCounters.has(card.id)) gameState.cardCounters.set(card.id, 0);
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} is now tracking counters.`);
      }
    },
    {
      label: "Planeswalk Away",
      action: () => { closeGameReaderView(); gamePlaneswalk(); }
    },
    {
      label: "Return to Top",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        ctx.pushHistory?.();
        const card = gameState.activePlanes.splice(focusedIdx, 1)[0];
        if (!card) return;
        gameState.remaining.unshift(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        trimCountersToCards(gameState);
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} returned to top.`);
      }
    },
    {
      label: "Return to Bottom",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        ctx.pushHistory?.();
        const card = gameState.activePlanes.splice(focusedIdx, 1)[0];
        if (!card) return;
        gameState.remaining.push(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        trimCountersToCards(gameState);
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} returned to bottom.`);
      }
    },
    {
      label: "Shuffle Into Library",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        ctx.pushHistory?.();
        const card = gameState.activePlanes.splice(focusedIdx, 1)[0];
        if (!card) return;
        gameState.remaining.push(card);
        gameState.remaining = shuffleArray(gameState.remaining);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        trimCountersToCards(gameState);
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} shuffled into library.`);
      }
    },
    {
      label: "Exile",
      danger: true,
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        ctx.pushHistory?.();
        const card = gameState.activePlanes.splice(focusedIdx, 1)[0];
        if (!card) return;
        gameState.exiled.push(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        trimCountersToCards(gameState);
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} exiled.`);
      }
    }
  ];
}

export function buildSideCardActions(sideIdx) {
  const { getGameState, closeGameReaderView, updateGameView, showToast } = ctx;

  return [
    {
      label: "Counters",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        const card = gameState.activePlanes[sideIdx];
        if (!card) return;
        ctx.pushHistory?.();
        ensureCounterState(gameState);
        gameState.counterTrackedIds.add(card.id);
        if (!gameState.cardCounters.has(card.id)) gameState.cardCounters.set(card.id, 0);
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} is now tracking counters.`);
      }
    },
    {
      label: "Make Main",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        ctx.pushHistory?.();
        gameState.focusedIndex = sideIdx;
        closeGameReaderView();
        updateGameView();
      }
    },
    {
      label: "Planeswalk Here",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        ctx.pushHistory?.();
        const card = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!card) return;
        gameState.remaining.push(...gameState.activePlanes);
        clearTemporaryCountersForClassic(gameState, card);
        gameState.activePlanes = [card];
        gameState.focusedIndex = 0;
        trimCountersToCards(gameState);
        closeGameReaderView();
        updateGameView();
        showToast(`Planeswalked to ${card.displayName}.`);
      }
    },
    {
      label: "Return to Top",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        ctx.pushHistory?.();
        const card = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!card) return;
        gameState.remaining.unshift(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        trimCountersToCards(gameState);
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} returned to top.`);
      }
    },
    {
      label: "Return to Bottom",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        ctx.pushHistory?.();
        const card = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!card) return;
        gameState.remaining.push(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        trimCountersToCards(gameState);
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} returned to bottom.`);
      }
    },
    {
      label: "Shuffle Into Library",
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        ctx.pushHistory?.();
        const card = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!card) return;
        gameState.remaining.push(card);
        gameState.remaining = shuffleArray(gameState.remaining);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        trimCountersToCards(gameState);
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} shuffled into library.`);
      }
    },
    {
      label: "Exile",
      danger: true,
      action: () => {
        const gameState = getGameState();
        if (!gameState) return;
        ctx.pushHistory?.();
        const card = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!card) return;
        gameState.exiled.push(card);
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        trimCountersToCards(gameState);
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} exiled.`);
      }
    }
  ];
}
