// ── game-classic.js ───────────────────────────────────────────────────────────
// Rendering and game logic for the Classic shared-deck Planechase game mode.

import { escapeHtml, shuffleArray } from "../gallery/utils.js";

let ctx = null;

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
    updateGameView();
    showToast("No more planes in the library.");
    ctx.updatePhenomenonBanner?.();
    return;
  }

  const nextCard = remaining.shift();
  gameState.activePlanes = [nextCard];
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
        updateGameView();
        showToast(`${top.displayName} added simultaneously.`);
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
        gameState.activePlanes = [card];
        gameState.focusedIndex = 0;
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
        closeGameReaderView();
        updateGameView();
        showToast(`${card.displayName} exiled.`);
      }
    }
  ];
}
