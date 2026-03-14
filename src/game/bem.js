// ── game-bem.js ───────────────────────────────────────────────────────────────
// Rendering and game logic for the Blind Eternities Map game mode.

import { shuffleArray } from "../gallery/utils.js";
const BEM_FALLOFF_DIST = 2;
const BEM_DRAG_THRESHOLD = 44;
const BEM_FACEDOWN_IMG = "assets/card-preview.jpg";

let ctx = null;

let bemViewOffset = { dx: 0, dy: 0 };
let bemDragPointerId = null;
let bemDragStart = null;
let bemDragHandled = false;
let bemLandOnPhenomenon = false;
let bemPlaneswalkPending = false;
let bemAnimating = false;
let bemCurrentR = 1;

function ensureCounterState(gameState) {
  if (!gameState) return;
  if (!gameState.cardCounters) gameState.cardCounters = new Map();
  if (!(gameState.counterTrackedIds instanceof Set)) gameState.counterTrackedIds = new Set();
}

function trimBemCounters(gameState) {
  ensureCounterState(gameState);
  const mapIds = new Set();
  for (const cell of gameState.bemGrid.values()) {
    if (cell.card && !cell.placeholder) mapIds.add(cell.card.id);
  }
  for (const card of gameState.activePlanes) mapIds.add(card.id);
  for (const id of [...gameState.counterTrackedIds]) {
    if (!mapIds.has(id)) {
      gameState.counterTrackedIds.delete(id);
      gameState.cardCounters.delete(id);
    }
  }
  for (const id of [...gameState.cardCounters.keys()]) {
    if (!mapIds.has(id)) gameState.cardCounters.delete(id);
  }
}

function clearTemporaryBemCounters(gameState, activeCard) {
  if (ctx.getCounterBehavior?.() !== "temporary") return;
  ensureCounterState(gameState);
  const keepId = activeCard?.id;
  for (const id of [...gameState.counterTrackedIds]) {
    if (id !== keepId) {
      gameState.counterTrackedIds.delete(id);
      gameState.cardCounters.delete(id);
    }
  }
}

function getCardCounter(gameState, cardId) {
  return gameState.cardCounters?.get(cardId) || 0;
}

function addBemCounterControls(gameState, container, card) {
  ensureCounterState(gameState);
  if (!card || !gameState.counterTrackedIds.has(card.id)) return;
  const wrap = document.createElement("div");
  wrap.className = "bem-cell-counter-wrap";
  wrap.innerHTML = `
    <button type="button" class="bem-cell-counter-toggle game-counter-glow" aria-label="Adjust counters">
      <img src="assets/favicon.svg" alt="" aria-hidden="true" />
    </button>
    <div class="bem-cell-counter-controls">
      <button type="button" class="bem-cell-counter-step" data-step="-1" aria-label="Remove counter">−</button>
      <span class="bem-cell-counter-value">${getCardCounter(gameState, card.id)}</span>
      <button type="button" class="bem-cell-counter-step" data-step="1" aria-label="Add counter">+</button>
    </div>
  `;
  const toggle = wrap.querySelector('.bem-cell-counter-toggle');
  const controls = wrap.querySelector('.bem-cell-counter-controls');
  toggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    controls?.classList.toggle('bem-cell-counter-controls-visible');
  });
  wrap.querySelectorAll('.bem-cell-counter-step').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const gs = ctx.getGameState();
      if (!gs) return;
      ctx.pushHistory?.();
      const delta = Number(btn.dataset.step || 0);
      const next = Math.max(0, getCardCounter(gs, card.id) + delta);
      if (next <= 0) gs.cardCounters.delete(card.id);
      else gs.cardCounters.set(card.id, next);
      renderBemMap();
      updateBemInfoBar();
      syncBemTrButton();
    });
  });
  container.appendChild(wrap);
}

export function initBemGame(context) {
  ctx = context;
}

// ── State accessors ───────────────────────────────────────────────────────────

export function getBemPlaneswalkPending() {
  return bemPlaneswalkPending;
}

export function getBemViewOffset() {
  return bemViewOffset;
}

export function getBemAnimating() {
  return bemAnimating;
}

export function resetBemState() {
  cancelBemPanAnimation();
  bemViewOffset = { dx: 0, dy: 0 };
  bemPlaneswalkPending = false;
  bemLandOnPhenomenon = false;
}

// ── BEM utility functions ─────────────────────────────────────────────────────

export function bemKey(x, y) {
  return `${x},${y}`;
}

function bemIsValidPlaneswalkTarget(dx, dy, cell) {
  const isOrthog = (Math.abs(dx) + Math.abs(dy)) === 1;
  const isDiag = Math.abs(dx) === 1 && Math.abs(dy) === 1;
  return (isOrthog && cell?.faceUp) || (isDiag && cell && !cell.faceUp);
}

function bemDrawFirstPlane(remaining) {
  const planeIdx = remaining.findIndex((card) => card.type !== "Phenomenon");
  if (planeIdx === -1) return null;
  return remaining.splice(planeIdx, 1)[0] || null;
}

function bemDrawForMap(remaining, { avoidPhenomena = false } = {}) {
  if (!avoidPhenomena) return remaining.shift() || null;
  return bemDrawFirstPlane(remaining);
}

function bemShouldAvoidPhenomena() {
  const mode = ctx.getHellridingMode?.() ?? "risky";
  return mode !== "normal";
}

function bemHellridePhenomenonChance() {
  const mode = ctx.getHellridingMode?.() ?? "risky";
  if (mode === "safe") return 0;
  if (mode === "extreme") return 1;
  if (mode === "risky") return 2 / 3;
  return 0;
}

function bemRestorePhenomenaToTop(remaining, cards) {
  if (!cards.length) return;
  const shuffled = shuffleArray([...cards]);
  remaining.unshift(...shuffled);
}

function bemRevealOrthogonalsAround(nx, ny) {
  const gameState = ctx.getGameState();
  const { bemGrid, remaining } = gameState;
  const antiPhenomena = bemShouldAvoidPhenomena();
  const orthDirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  const replacedPhenomena = [];

  for (const { dx: odx, dy: ody } of orthDirs) {
    const adjCell = bemGrid.get(bemKey(nx + odx, ny + ody));
    if (!adjCell || adjCell.faceUp) continue;

    if (antiPhenomena && adjCell.card?.type === "Phenomenon") {
      replacedPhenomena.push(adjCell.card);
      const nextCard = bemDrawForMap(remaining, { avoidPhenomena: true });
      if (nextCard) {
        adjCell.card = nextCard;
        delete adjCell.placeholder;
      } else {
        adjCell.card = null;
        adjCell.placeholder = true;
      }
    }

    adjCell.faceUp = true;
  }

  bemRestorePhenomenaToTop(remaining, replacedPhenomena);
}

function bemDiscoverAdjacent() {
  const { bemGrid, bemPos, remaining } = ctx.getGameState();
  const antiPhenomena = bemShouldAvoidPhenomena();
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
    if (!bemGrid.has(key)) {
      if (faceUp) {
        const card = bemDrawForMap(remaining, { avoidPhenomena: antiPhenomena });
        if (card) {
          bemGrid.set(key, { card, faceUp: true });
        } else {
          bemGrid.set(key, { card: null, faceUp: true, placeholder: true });
        }
      } else if (remaining.length > 0) {
        const card = remaining.shift();
        if (card) bemGrid.set(key, { card, faceUp: false });
      }
    }
  }
}

function bemRemoveFalloff() {
  const { bemGrid, bemPos, remaining } = ctx.getGameState();
  const { x: px, y: py } = bemPos;

  for (const [key, cell] of [...bemGrid.entries()]) {
    const [cx, cy] = key.split(",").map(Number);
    const dist = Math.max(Math.abs(cx - px), Math.abs(cy - py));
    if (dist > BEM_FALLOFF_DIST) {
      bemGrid.delete(key);
      if (cell.card && !cell.placeholder) remaining.push(cell.card);
    }
  }
}

function bemClearActivePlanesToBottom() {
  const gameState = ctx.getGameState();
  if (!gameState?.activePlanes?.length) return;
  gameState.remaining.push(...shuffleArray([...gameState.activePlanes]));
  gameState.activePlanes = [];
  gameState.focusedIndex = 0;
}

// ── BEM pan animation ─────────────────────────────────────────────────────────

function cancelBemPanAnimation() {
  if (!bemAnimating) return;
  const bemMapEl = ctx?.bemMapEl;
  if (bemMapEl) {
    bemMapEl.style.transition = "";
    bemMapEl.style.transform = "";
  }
  bemAnimating = false;
}

function startBemPanAnimation(fromDx, fromDy) {
  const { bemMapEl } = ctx;
  if (!bemMapEl) return;
  bemAnimating = true;
  bemMapEl.style.transition = "none";
  // Negate fromDx/fromDy: to show the OLD card in the viewport centre we must
  // shift the newly-rendered map in the opposite direction of travel so that
  // the adjacent column containing the old card slides into view.
  // The percentage is relative to the grid's own size: 1 cell = 100/(2R+1)%.
  const cellPct = 100 / (2 * bemCurrentR + 1);
  bemMapEl.style.transform = `translate(${-fromDx * cellPct}%, ${-fromDy * cellPct}%)`;
  // Force a synchronous reflow so the browser commits the initial transform
  // before we enable the transition, preventing it from being skipped.
  bemMapEl.getBoundingClientRect();
  bemMapEl.style.transition = "transform 300ms ease";
  bemMapEl.style.transform = "translate(0, 0)";
  bemMapEl.addEventListener("transitionend", function onEnd() {
    bemMapEl.removeEventListener("transitionend", onEnd);
    bemMapEl.style.transition = "";
    bemMapEl.style.transform = "";
    bemAnimating = false;
  });
}

// ── BEM game startup ──────────────────────────────────────────────────────────

export function startBemGame() {
  const { getDeckTotal, buildDeckArray, setGameState, setGameActive, closeDeckPanel, resetDieIcon, updateCostDisplay, syncBemTrButton, showToast, gameView, bemMapArea } = ctx;

  const total = getDeckTotal();
  if (total === 0) { showToast("Add cards to your deck first."); return; }

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

  const antiPhenomena = bemShouldAvoidPhenomena();

  for (const { dx, dy, faceUp } of positions) {
    const isCenter = dx === 0 && dy === 0;
    if (faceUp) {
      if (shuffled.length === 0) {
        bemGrid.set(bemKey(dx, dy), { card: null, faceUp: true, placeholder: true });
        continue;
      }
      const card = isCenter
        ? bemDrawFirstPlane(shuffled)
        : bemDrawForMap(shuffled, { avoidPhenomena: antiPhenomena });
      if (card) {
        bemGrid.set(bemKey(dx, dy), { card, faceUp: true });
      } else {
        bemGrid.set(bemKey(dx, dy), { card: null, faceUp: true, placeholder: true });
      }
    } else {
      if (shuffled.length === 0) break;
      const card = shuffled.shift();
      if (card) bemGrid.set(bemKey(dx, dy), { card, faceUp: false });
    }
  }

  bemViewOffset = { dx: 0, dy: 0 };
  bemPlaneswalkPending = false;

  setGameState({
    mode: "bem",
    remaining: shuffled,
    exiled: [],
    chaosCost: 0,
    dieRolling: false,
    _dieResetTimer: null,
    activePlanes: [],
    focusedIndex: 0,
    recentPhenomena: [],
    bemGrid,
    bemPos: { x: 0, y: 0 },
    bemHellridedPositions: new Set(),
    cardCounters: new Map(),
    counterTrackedIds: new Set()
  });

  setGameActive(true);
  closeDeckPanel();
  document.body.classList.add("game-open");
  gameView?.classList.remove("hidden");
  gameView?.classList.add("bem-active");
  bemMapArea?.classList.remove("hidden");
  resetDieIcon();
  updateCostDisplay();
  trimBemCounters(ctx.getGameState());
  renderBemMap();
  updateBemInfoBar();
  syncBemTrButton();
  ctx.updatePhenomenonBanner?.();

  if (window.location.hash !== "#play") {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}#play`);
  }

  showToast("The game has begun!");
}

// ── BEM movement ──────────────────────────────────────────────────────────────

export function bemMovePlayer(nx, ny) {
  const gameState = ctx.getGameState();
  if (!gameState?.bemGrid || !gameState?.bemPos) return;

  cancelBemPanAnimation();

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

  ctx.pushHistory?.();

  if (cell.placeholder && !cell.card) {
    const { remaining } = gameState;
    const nextCard = bemDrawForMap(remaining, { avoidPhenomena: bemShouldAvoidPhenomena() });
    if (nextCard) {
      cell.card = nextCard;
      cell.placeholder = false;
      ctx.showToast(`Moving to ${nextCard.displayName}.`);
    } else {
      ctx.showToast("Moving to empty spot, no planes remain.");
    }
    bemLandOnPhenomenon = cell.card?.type === "Phenomenon" && ctx.getPhenomenonAnimationEnabled();
    clearTemporaryBemCounters(gameState, cell.card);
    gameState.bemPos = { x: nx, y: ny };
    bemViewOffset = { dx: 0, dy: 0 };
    bemClearActivePlanesToBottom();
    if (cell.card?.type !== "Phenomenon" && gameState.recentPhenomena?.length > 0) {
      gameState.recentPhenomena = [];
    }
    bemRevealOrthogonalsAround(nx, ny);
    bemPlaneswalkPending = false;
    bemRemoveFalloff();
    bemDiscoverAdjacent();
    trimBemCounters(gameState);
    renderBemMap();
    updateBemInfoBar();
    syncBemTrButton();
    ctx.updatePhenomenonBanner?.();
    ctx.closeAllGameMenus();
    return;
  }

  if (isDiag) {
    if (cell.faceUp) {
      ctx.showToast("Can only Hellride to a face-down diagonal card.");
      return;
    }

    const originalCard = cell.card;
    const alreadyHellrided = gameState.bemHellridedPositions?.has(key);
    const hellrideChance = bemHellridePhenomenonChance();
    if (hellrideChance > 0 && originalCard.type !== "Phenomenon" && !alreadyHellrided) {
      gameState.bemHellridedPositions?.add(key);
      const phenIdx = gameState.remaining.findIndex(c => c.type === "Phenomenon");
      if (phenIdx !== -1 && Math.random() < hellrideChance) {
        const [phenomenon] = gameState.remaining.splice(phenIdx, 1);
        cell.card = phenomenon;
        cell.queuedCard = originalCard;
      }
    }

    cell.faceUp = true;
    ctx.showToast("Hellriding!");
  } else {
    if (!cell.faceUp) cell.faceUp = true;
    ctx.showToast(`Moving to ${cell.card.displayName}.`);
  }

  bemLandOnPhenomenon = cell.card?.type === "Phenomenon" && ctx.getPhenomenonAnimationEnabled();

  clearTemporaryBemCounters(gameState, cell.card);
  gameState.bemPos = { x: nx, y: ny };
  bemViewOffset = { dx: 0, dy: 0 };

  bemClearActivePlanesToBottom();

  if (cell.card?.type !== "Phenomenon" && gameState.recentPhenomena?.length > 0) {
    gameState.recentPhenomena = [];
  }

  bemRevealOrthogonalsAround(nx, ny);

  bemPlaneswalkPending = false;
  bemRemoveFalloff();
  bemDiscoverAdjacent();

  renderBemMap();
  updateBemInfoBar();
  syncBemTrButton();
  ctx.updatePhenomenonBanner?.();
  ctx.closeAllGameMenus();
}

export function bemResolvePhenomenon() {
  const gameState = ctx.getGameState();
  if (!gameState?.bemGrid || !gameState?.bemPos) return;

  const { bemGrid, bemPos, remaining } = gameState;
  const key = bemKey(bemPos.x, bemPos.y);
  const cell = bemGrid.get(key);

  if (!cell || cell.card.type !== "Phenomenon") {
    ctx.showToast("No phenomenon to resolve here.");
    return;
  }

  ctx.pushHistory?.();

  const phenomenon = cell.card;
  const nextCard = cell.queuedCard ?? bemDrawForMap(remaining, { avoidPhenomena: bemShouldAvoidPhenomena() });
  delete cell.queuedCard;
  remaining.push(phenomenon);

  if (!gameState.recentPhenomena) gameState.recentPhenomena = [];
  gameState.recentPhenomena.push(phenomenon);

  if (nextCard) {
    bemGrid.set(key, { card: nextCard, faceUp: true });
    ctx.showToast(`${phenomenon.displayName} resolved. ${nextCard.displayName} appears.`);
  } else {
    bemGrid.set(key, { card: null, faceUp: true, placeholder: true });
    ctx.showToast(`${phenomenon.displayName} resolved. No planes remain.`);
  }

  renderBemMap();
  updateBemInfoBar();
  syncBemTrButton();
  ctx.updatePhenomenonBanner?.();
}

export function bemFillPlaceholder() {
  const gameState = ctx.getGameState();
  if (!gameState?.bemGrid || !gameState?.bemPos) return;

  const { bemGrid, bemPos, remaining } = gameState;
  const key = bemKey(bemPos.x, bemPos.y);
  const cell = bemGrid.get(key);

  if (!cell?.placeholder) return;

  if (remaining.length === 0) {
    ctx.showToast("Library is empty.");
    return;
  }

  ctx.pushHistory?.();

  const nextCard = bemDrawForMap(remaining, { avoidPhenomena: bemShouldAvoidPhenomena() });
  if (nextCard) {
    bemLandOnPhenomenon = nextCard.type === "Phenomenon" && ctx.getPhenomenonAnimationEnabled();
    bemGrid.set(key, { card: nextCard, faceUp: true });
    ctx.showToast(`${nextCard.displayName} revealed.`);
  } else {
    ctx.showToast("No planes remain in the library.");
  }

  trimBemCounters(gameState);
  renderBemMap();
  updateBemInfoBar();
  syncBemTrButton();
}

// ── BEM UI sync ───────────────────────────────────────────────────────────────

export function syncBemTrButton() {
  const { gameBtnTr } = ctx;
  if (!gameBtnTr) return;
  const gameState = ctx.getGameState();
  const isBem = gameState?.mode === "bem";
  const currentCell = isBem ? gameState.bemGrid?.get(bemKey(gameState.bemPos.x, gameState.bemPos.y)) : null;
  const isPhenomenon = isBem && currentCell?.card?.type === "Phenomenon";
  const isPlaceholder = isBem && currentCell?.placeholder && !currentCell?.card;

  gameBtnTr.classList.toggle("bem-phenomenon-active", !!isPhenomenon);
  gameBtnTr.classList.toggle("bem-planeswalk-pending", !!(isBem && bemPlaneswalkPending && !isPlaceholder));
  gameBtnTr.setAttribute("aria-label", isBem
    ? (isPhenomenon ? "Resolve Phenomenon"
      : isPlaceholder ? "Reveal Card"
      : bemPlaneswalkPending ? "Cancel Planeswalk"
      : "Planeswalk")
    : "Planeswalk");
}

// ── BEM map rendering ─────────────────────────────────────────────────────────

export function renderBemMap() {
  const { bemMapEl } = ctx;
  if (!bemMapEl) return;
  const gameState = ctx.getGameState();
  if (!gameState?.bemGrid || !gameState?.bemPos) return;

  const { bemGrid, bemPos } = gameState;
  const { x: px, y: py } = bemPos;
  const viewX = px + bemViewOffset.dx;
  const viewY = py + bemViewOffset.dy;
  const isPanning = bemViewOffset.dx !== 0 || bemViewOffset.dy !== 0;

  bemMapEl.innerHTML = "";

  // Compute bounds of all active cells relative to the view centre
  let actMinGx = 0, actMaxGx = 0, actMinGy = 0, actMaxGy = 0;
  if (bemGrid.size > 0) {
    actMinGx = Infinity; actMaxGx = -Infinity;
    actMinGy = Infinity; actMaxGy = -Infinity;
    for (const key of bemGrid.keys()) {
      const [cx, cy] = key.split(",").map(Number);
      const gx = cx - viewX;
      const gy = cy - viewY;
      if (gx < actMinGx) actMinGx = gx;
      if (gx > actMaxGx) actMaxGx = gx;
      if (gy < actMinGy) actMinGy = gy;
      if (gy > actMaxGy) actMaxGy = gy;
    }
  }

  // Expand by 1 for the placeholder edge layer; make symmetric for CSS grid centering
  const R = Math.max(Math.abs(actMinGx - 1), actMaxGx + 1, Math.abs(actMinGy - 1), actMaxGy + 1);
  bemCurrentR = R;

  // Extended bounding box including the edge layer
  const edgeMinGx = actMinGx - 1, edgeMaxGx = actMaxGx + 1;
  const edgeMinGy = actMinGy - 1, edgeMaxGy = actMaxGy + 1;

  // Update grid template dynamically to accommodate all active cells plus edge layer
  bemMapEl.style.gridTemplateColumns = `repeat(${2 * R + 1}, var(--bem-cell-w))`;
  bemMapEl.style.gridTemplateRows = `repeat(${2 * R + 1}, var(--bem-cell-h))`;

  for (let gy = -R; gy <= R; gy++) {
    for (let gx = -R; gx <= R; gx++) {
      const cx = viewX + gx;
      const cy = viewY + gy;
      const key = bemKey(cx, cy);
      const cell = bemGrid.get(key);

      const div = document.createElement("div");
      div.style.gridColumn = (gx + R + 1).toString();
      div.style.gridRow = (gy + R + 1).toString();
      div.className = "bem-cell";
      div.dataset.x = cx;
      div.dataset.y = cy;

      const pdx = cx - px;
      const pdy = cy - py;
      const isPlayer = pdx === 0 && pdy === 0;
      const isDiagToPlayer = Math.abs(pdx) === 1 && Math.abs(pdy) === 1;
      const isOrthogToPlayer = (Math.abs(pdx) + Math.abs(pdy)) === 1;

      ensureCounterState(gameState);
      if (cell?.card && gameState.counterTrackedIds.has(cell.card.id)) div.classList.add("game-counter-glow");

      if (bemPlaneswalkPending && !isPlayer) {
        if (isOrthogToPlayer && cell?.faceUp) div.classList.add("bem-cell-planeswalk-glow");
        else if (isDiagToPlayer && cell && !cell.faceUp) div.classList.add("bem-cell-hellride-glow");
      }

      if (!cell) {
        const inEdgeBounds = gx >= edgeMinGx && gx <= edgeMaxGx && gy >= edgeMinGy && gy <= edgeMaxGy;
        if (ctx.getBemEdgePlaceholders?.() && inEdgeBounds) {
          div.classList.add("bem-cell-edge");
          const img = document.createElement("img");
          img.className = "bem-cell-img";
          img.src = BEM_FACEDOWN_IMG;
          img.alt = "";
          div.appendChild(img);
        } else {
          div.classList.add("bem-cell-void");
        }
      } else if (cell.placeholder && !cell.card) {
        div.classList.add("bem-cell-placeholder");
        if (isPlayer) div.classList.add("bem-cell-player");
        const img = document.createElement("img");
        img.className = "bem-cell-placeholder-img";
        img.src = "assets/card-preview.jpg";
        img.alt = "";
        div.appendChild(img);
      } else if (cell.faceUp) {
        div.classList.add("bem-cell-faceup");

        const img = document.createElement("img");
        img.className = "bem-cell-img";
        img.src = cell.card.thumbPath;
        img.alt = cell.card.displayName;
        div.appendChild(img);

        if (isPlayer) {
          div.classList.add("bem-cell-player");
          if (cell.card.type === "Phenomenon") {
            div.classList.add("bem-cell-phenomenon");
            if (bemLandOnPhenomenon) {
              div.classList.add("bem-cell-phenomenon-landing");
              bemLandOnPhenomenon = false;
            }
          } else {
            div.classList.add("bem-cell-active-plane");
          }
          addBemCounterControls(gameState, div, cell.card);
        } else if (isOrthogToPlayer && !isPanning) {
          if (!bemPlaneswalkPending) div.classList.add("bem-cell-moveable");
        }
      } else {
        div.classList.add("bem-cell-facedown");

        const img = document.createElement("img");
        img.className = "bem-cell-img";
        img.src = BEM_FACEDOWN_IMG;
        img.alt = "Face-down card";
        div.appendChild(img);

        if (isDiagToPlayer && !isPanning) {
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

// ── BEM info bar ──────────────────────────────────────────────────────────────

export function updateBemInfoBar() {
  const { bemCardNameLabel } = ctx;
  const gameState = ctx.getGameState();
  if (!gameState?.bemGrid || !gameState?.bemPos) return;

  const cell = gameState.bemGrid.get(bemKey(gameState.bemPos.x, gameState.bemPos.y));

  if (cell?.placeholder && !cell?.card) {
    if (bemCardNameLabel) bemCardNameLabel.textContent = "Empty Cell";
  } else {
    const card = cell?.card;
    if (bemCardNameLabel) bemCardNameLabel.textContent = card ? card.displayName : "";
  }

  ctx.renderGameSidePanel(gameState.activePlanes, gameState.focusedIndex);
  ctx.syncGameToolsState(gameState.remaining.length);
}

// ── BEM cell click ────────────────────────────────────────────────────────────

export function handleBemCellClick(event) {
  const { openGameReaderView } = ctx;
  const gameState = ctx.getGameState();
  if (!gameState || gameState.mode !== "bem") return;
  if (bemDragHandled) { bemDragHandled = false; return; }

  const cell = event.target.closest(".bem-cell");
  if (!cell) return;

  const nx = parseInt(cell.dataset.x, 10);
  const ny = parseInt(cell.dataset.y, 10);
  if (isNaN(nx) || isNaN(ny)) return;

  const { x: px, y: py } = gameState.bemPos;
  const dx = nx - px;
  const dy = ny - py;
  const isPanning = bemViewOffset.dx !== 0 || bemViewOffset.dy !== 0;

  if (dx === 0 && dy === 0) {
    if (ctx.getEasyPlaneswalk()) {
      if (isPanning) {
        bemViewOffset = { dx: 0, dy: 0 };
        renderBemMap();
        ctx.showToast("Returned to your position.");
        return;
      }
      const currentCell = gameState.bemGrid.get(bemKey(nx, ny));
      if (currentCell?.placeholder && !currentCell?.card) {
        bemFillPlaceholder();
      } else if (currentCell?.card?.type === "Phenomenon") {
        bemResolvePhenomenon();
      } else {
        toggleBemPlaneswalkMode();
      }
      return;
    }
    const gridCell = gameState.bemGrid.get(bemKey(nx, ny));
    if (gridCell?.card) openGameReaderView(gridCell.card, buildBemCardActions());
    return;
  }

  if (bemPlaneswalkPending) {
    if (isPanning) {
      const gridCell = gameState.bemGrid.get(bemKey(nx, ny));
      if (bemIsValidPlaneswalkTarget(dx, dy, gridCell)) {
        bemMovePlayer(nx, ny);
        return;
      }
      bemViewOffset = { dx: 0, dy: 0 };
      renderBemMap();
      ctx.showToast("Returned to your position. Select a direction to planeswalk.");
      return;
    }
    const gridCell = gameState.bemGrid.get(bemKey(nx, ny));
    if (bemIsValidPlaneswalkTarget(dx, dy, gridCell)) {
      bemMovePlayer(nx, ny);
    } else {
      bemPlaneswalkPending = false;
      renderBemMap();
      syncBemTrButton();
    }
    return;
  }

  if (ctx.getEasyPlaneswalk()) {
    if (isPanning) {
      bemViewOffset = { dx: 0, dy: 0 };
      renderBemMap();
      ctx.showToast("Returned to your position. Tap an adjacent card to move.");
      return;
    }
    const isValidMove = (Math.abs(dx) + Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 1);
    if (isValidMove) {
      bemMovePlayer(nx, ny);
    } else {
      const gridCell = gameState.bemGrid.get(bemKey(nx, ny));
      if (gridCell?.card) openGameReaderView(gridCell.card, buildBemAdjacentCardActions(nx, ny), { faceDown: !gridCell.faceUp });
    }
    return;
  }

  const gridCell = gameState.bemGrid.get(bemKey(nx, ny));
  if (gridCell?.card) {
    openGameReaderView(gridCell.card, buildBemAdjacentCardActions(nx, ny), { faceDown: !gridCell.faceUp });
  }
}

export function toggleBemPlaneswalkMode() {
  const gameState = ctx.getGameState();
  if (!gameState?.bemGrid) return;
  const isPanning = bemViewOffset.dx !== 0 || bemViewOffset.dy !== 0;
  if (isPanning && bemPlaneswalkPending) {
    const nx = gameState.bemPos.x + bemViewOffset.dx;
    const ny = gameState.bemPos.y + bemViewOffset.dy;
    const cell = gameState.bemGrid.get(bemKey(nx, ny));
    if (bemIsValidPlaneswalkTarget(bemViewOffset.dx, bemViewOffset.dy, cell)) {
      bemMovePlayer(nx, ny);
      return;
    }
    bemViewOffset = { dx: 0, dy: 0 };
    renderBemMap();
    ctx.showToast("Returned to your position. Planeswalk again to continue.");
    return;
  }
  bemPlaneswalkPending = !bemPlaneswalkPending;
  renderBemMap();
  syncBemTrButton();
  if (bemPlaneswalkPending) ctx.showToast("Choose an adjacent card to planeswalk to.");
}

// ── BEM drag/key navigation ───────────────────────────────────────────────────

export function handleBemArrowKey(event) {
  const gameState = ctx.getGameState();
  if (!ctx.getGameActive() || gameState?.mode !== "bem") return;
  if (document.body.classList.contains("game-reader-open")) return;
  if (document.body.classList.contains("tutorial-open")) return;
  if (bemAnimating) return;

  let panDx = 0, panDy = 0;
  switch (event.key) {
    case "ArrowLeft":  panDx = -1; break;
    case "ArrowRight": panDx = 1;  break;
    case "ArrowUp":    panDy = -1; break;
    case "ArrowDown":  panDy = 1;  break;
    default: return;
  }
  event.preventDefault();

  const { x: px, y: py } = gameState.bemPos;
  const newViewX = px + bemViewOffset.dx + panDx;
  const newViewY = py + bemViewOffset.dy + panDy;
  if (!gameState.bemGrid.has(bemKey(newViewX, newViewY))) return;

  bemViewOffset = { dx: bemViewOffset.dx + panDx, dy: bemViewOffset.dy + panDy };
  renderBemMap();
  if (ctx.getSmoothTravelEnabled?.()) startBemPanAnimation(-panDx, -panDy);
}

export function handleBemPointerDown(event) {
  if (!ctx.getGameState()?.bemGrid) return;
  if (bemDragPointerId !== null) return;
  if (event.pointerType === "mouse" && event.button !== 1) return;
  bemDragPointerId = event.pointerId;
  bemDragStart = { x: event.clientX, y: event.clientY };
  bemDragHandled = false;
}

export function handleBemPointerMove(event) {
  if (event.pointerId !== bemDragPointerId || !bemDragStart || !ctx.getGameState()?.bemGrid) return;
  if (bemAnimating) return;
  const dx = event.clientX - bemDragStart.x;
  const dy = event.clientY - bemDragStart.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < BEM_DRAG_THRESHOLD && ady < BEM_DRAG_THRESHOLD) return;

  bemDragHandled = true;
  bemDragPointerId = null;
  bemDragStart = null;

  let panDx = 0, panDy = 0;

  const isPortraitMobile = event.pointerType !== "mouse" && window.innerHeight > window.innerWidth;

  if (isPortraitMobile) {
    if (adx >= ady) { panDy = dx > 0 ? -1 : 1; }
    else { panDx = dy > 0 ? 1 : -1; }
  } else {
    if (adx >= ady) { panDx = dx > 0 ? -1 : 1; }
    else { panDy = dy > 0 ? -1 : 1; }
  }

  const gameState = ctx.getGameState();
  const { x: px, y: py } = gameState.bemPos;
  const newViewX = px + bemViewOffset.dx + panDx;
  const newViewY = py + bemViewOffset.dy + panDy;
  if (!gameState.bemGrid.has(bemKey(newViewX, newViewY))) return;

  bemViewOffset = { dx: bemViewOffset.dx + panDx, dy: bemViewOffset.dy + panDy };
  renderBemMap();
  if (ctx.getSmoothTravelEnabled?.()) startBemPanAnimation(-panDx, -panDy);
}

export function handleBemPointerUp(event) {
  if (event.pointerId === bemDragPointerId) {
    bemDragPointerId = null;
    bemDragStart = null;
  }
}

// ── BEM action builders ───────────────────────────────────────────────────────


function buildBemFlipAction(x, y) {
  return {
    label: "Flip",
    action: () => {
      const gameState = ctx.getGameState();
      if (!gameState?.bemGrid) return;
      const key = bemKey(x, y);
      const target = gameState.bemGrid.get(key);
      if (!target?.card || target.placeholder) return;
      ctx.pushHistory?.();
      target.faceUp = !target.faceUp;
      const nowFaceUp = target.faceUp;
      ctx.closeGameReaderView?.();
      renderBemMap();
      updateBemInfoBar();
      syncBemTrButton();
      ctx.showToast(nowFaceUp ? `${target.card.displayName} turned face-up.` : `${target.card.displayName} turned face-down.`);
    }
  };
}

export function buildBemCardActions() {
  const { closeGameReaderView, showToast } = ctx;

  function makeAction(label, handler, danger = false) {
    return { label, danger, action: () => {
      const gameState = ctx.getGameState();
      if (!gameState?.bemGrid || !gameState?.bemPos) return;
      const key = bemKey(gameState.bemPos.x, gameState.bemPos.y);
      const cell = gameState.bemGrid.get(key);
      if (!cell?.card) return;
      ctx.pushHistory?.();
      handler(gameState, key, cell, cell.card.displayName);
    }};
  }

  const gameState = ctx.getGameState();
  const pos = gameState?.bemPos;

  return [
    ...(pos ? [buildBemFlipAction(pos.x, pos.y)] : []),
    makeAction("Counters", (gs, key, cell, name) => {
      ensureCounterState(gs);
      gs.counterTrackedIds.add(cell.card.id);
      if (!gs.cardCounters.has(cell.card.id)) gs.cardCounters.set(cell.card.id, 0);
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} is now tracking counters.`);
    }),
    makeAction("Add", (gs, key, cell, name) => {
      gs.activePlanes.push(cell.card);
      gs.bemGrid.set(key, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} added simultaneously.`);
    }),
    makeAction("Return to Top", (gs, key, cell, name) => {
      gs.remaining.unshift(cell.card);
      gs.bemGrid.set(key, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} returned to top.`);
    }),
    makeAction("Return to Bottom", (gs, key, cell, name) => {
      gs.remaining.push(cell.card);
      gs.bemGrid.set(key, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} returned to bottom.`);
    }),
    makeAction("Shuffle Into Library", (gs, key, cell, name) => {
      gs.remaining.push(cell.card);
      gs.remaining = shuffleArray(gs.remaining);
      gs.bemGrid.set(key, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} shuffled into library.`);
    }),
    makeAction("Exile", (gs, key, cell, name) => {
      gs.exiled.push(cell.card);
      gs.bemGrid.set(key, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} exiled.`);
    }, true)
  ];
}

export function buildBemAdjacentCardActions(nx, ny) {
  const { closeGameReaderView, showToast } = ctx;
  const gameState = ctx.getGameState();
  if (!gameState?.bemPos || !gameState?.bemGrid) return [];

  const dx = nx - gameState.bemPos.x;
  const dy = ny - gameState.bemPos.y;
  const targetKey = bemKey(nx, ny);
  const targetCell = gameState.bemGrid.get(targetKey);
  if (!targetCell?.card || targetCell.placeholder) return [];

  const canPlaneswalkHere = bemIsValidPlaneswalkTarget(dx, dy, targetCell);

  function makeTargetAction(label, handler, danger = false) {
    return {
      label,
      danger,
      action: () => {
        const gs = ctx.getGameState();
        const cell = gs?.bemGrid?.get(targetKey);
        if (!gs || !cell?.card || cell.placeholder) return;
        ctx.pushHistory?.();
        handler(gs, cell, cell.card.displayName);
      }
    };
  }

  return [
    buildBemFlipAction(nx, ny),
    makeTargetAction("Counters", (gs, cell, name) => {
      ensureCounterState(gs);
      gs.counterTrackedIds.add(cell.card.id);
      if (!gs.cardCounters.has(cell.card.id)) gs.cardCounters.set(cell.card.id, 0);
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} is now tracking counters.`);
    }),
    ...(canPlaneswalkHere ? [{
      label: "Planeswalk Here",
      action: () => {
        closeGameReaderView();
        bemMovePlayer(nx, ny);
      }
    }] : []),
    makeTargetAction("Add", (gs, cell, name) => {
      gs.activePlanes.push(cell.card);
      gs.bemGrid.set(targetKey, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} added simultaneously.`);
    }),
    makeTargetAction("Return to Top", (gs, cell, name) => {
      gs.remaining.unshift(cell.card);
      gs.bemGrid.set(targetKey, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} returned to top.`);
    }),
    makeTargetAction("Return to Bottom", (gs, cell, name) => {
      gs.remaining.push(cell.card);
      gs.bemGrid.set(targetKey, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} returned to bottom.`);
    }),
    makeTargetAction("Shuffle Into Library", (gs, cell, name) => {
      gs.remaining.push(cell.card);
      gs.remaining = shuffleArray(gs.remaining);
      gs.bemGrid.set(targetKey, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} shuffled into library.`);
    }),
    makeTargetAction("Exile", (gs, cell, name) => {
      gs.exiled.push(cell.card);
      gs.bemGrid.set(targetKey, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} exiled.`);
    }, true)
  ];
}

export function buildBemSideCardActions(sideIdx) {
  const { getGameState, closeGameReaderView, showToast } = ctx;

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
        updateBemInfoBar();
        showToast(`${card.displayName} is now tracking counters.`);
      }
    },
    {
      label: "Make Main",
      action: () => {
        const gameState = getGameState();
        if (!gameState?.bemGrid || !gameState?.bemPos) return;
        ctx.pushHistory?.();
        const sideCard = gameState.activePlanes.splice(sideIdx, 1)[0];
        if (!sideCard) return;
        const key = bemKey(gameState.bemPos.x, gameState.bemPos.y);
        const cell = gameState.bemGrid.get(key);
        if (cell?.card) {
          gameState.activePlanes.splice(sideIdx, 0, cell.card);
          cell.card = sideCard;
        } else if (cell) {
          cell.card = sideCard;
          cell.placeholder = false;
        } else {
          gameState.bemGrid.set(key, { card: sideCard, faceUp: true });
        }
        gameState.focusedIndex = Math.min(gameState.focusedIndex, Math.max(0, gameState.activePlanes.length - 1));
        closeGameReaderView();
        renderBemMap();
        updateBemInfoBar();
        syncBemTrButton();
        showToast(`${sideCard.displayName} is now the active plane.`);
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
        trimBemCounters(gameState);
        closeGameReaderView();
        updateBemInfoBar();
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
        trimBemCounters(gameState);
        closeGameReaderView();
        updateBemInfoBar();
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
        trimBemCounters(gameState);
        closeGameReaderView();
        updateBemInfoBar();
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
        trimBemCounters(gameState);
        closeGameReaderView();
        updateBemInfoBar();
        showToast(`${card.displayName} exiled.`);
      }
    }
  ];
}
