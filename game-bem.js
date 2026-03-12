import { escapeHtml, shuffleArray } from "./gallery-utils.js";

const BEM_VIEW_RADIUS = 1;
const BEM_FALLOFF_DIST = 2;
const BEM_DRAG_THRESHOLD = 44;
const BEM_FACEDOWN_IMG = "images/assets/card-preview.jpg";

let ctx = null;

let bemViewOffset = { dx: 0, dy: 0 };
let bemDragPointerId = null;
let bemDragStart = null;
let bemDragHandled = false;
let bemLandOnPhenomenon = false;
let bemPlaneswalkPending = false;
let bemAnimating = false;

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

function bemDrawNonPhenomenon(remaining) {
  let attempts = 0;
  while (remaining.length > 0 && attempts < remaining.length) {
    const card = remaining.shift();
    if (card.type !== "Phenomenon") return card;
    remaining.push(card);
    attempts++;
  }
  return null;
}

function bemDiscoverAdjacent() {
  const { bemGrid, bemPos, remaining } = ctx.getGameState();
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
        const card = bemDrawNonPhenomenon(remaining);
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
  bemMapEl.style.transform = `translate(${fromDx * 33.333}%, ${fromDy * 33.333}%)`;
  // Use double rAF so the browser paints the "from" position before starting
  // the slide transition, avoiding a visual jerk from the offsetWidth reflow trick.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!bemAnimating) return;
      bemMapEl.style.transition = "transform 300ms ease";
      bemMapEl.style.transform = "translate(0, 0)";
      bemMapEl.addEventListener("transitionend", function onEnd() {
        bemMapEl.removeEventListener("transitionend", onEnd);
        bemMapEl.style.transition = "";
        bemMapEl.style.transform = "";
        bemAnimating = false;
      });
    });
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

  for (const { dx, dy, faceUp } of positions) {
    if (faceUp) {
      if (shuffled.length === 0) {
        bemGrid.set(bemKey(dx, dy), { card: null, faceUp: true, placeholder: true });
        continue;
      }
      const card = bemDrawNonPhenomenon(shuffled);
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
    bemGrid,
    bemPos: { x: 0, y: 0 },
    bemHellridedPositions: new Set()
  });

  setGameActive(true);
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
    const nextCard = bemDrawNonPhenomenon(remaining);
    if (nextCard) {
      cell.card = nextCard;
      cell.placeholder = false;
      ctx.showToast(`Moving to ${nextCard.displayName}.`);
    } else {
      ctx.showToast("Moving to empty spot, no planes remain.");
    }
    bemLandOnPhenomenon = cell.card?.type === "Phenomenon" && ctx.getPhenomenonAnimationEnabled();
    gameState.bemPos = { x: nx, y: ny };
    bemViewOffset = { dx: 0, dy: 0 };
    bemClearActivePlanesToBottom();
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
    if (ctx.getRiskyHellridingEnabled() && originalCard.type !== "Phenomenon" && !alreadyHellrided) {
      gameState.bemHellridedPositions?.add(key);
      const phenIdx = gameState.remaining.findIndex(c => c.type === "Phenomenon");
      if (phenIdx !== -1 && Math.random() < 2 / 3) {
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

  gameState.bemPos = { x: nx, y: ny };
  bemViewOffset = { dx: 0, dy: 0 };

  bemClearActivePlanesToBottom();

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
  const nextCard = cell.queuedCard ?? bemDrawNonPhenomenon(remaining);
  delete cell.queuedCard;
  remaining.push(phenomenon);

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

  const nextCard = bemDrawNonPhenomenon(remaining);
  if (nextCard) {
    bemLandOnPhenomenon = nextCard.type === "Phenomenon" && ctx.getPhenomenonAnimationEnabled();
    bemGrid.set(key, { card: nextCard, faceUp: true });
    ctx.showToast(`${nextCard.displayName} revealed.`);
  } else {
    ctx.showToast("No planes remain in the library.");
  }

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

  const R = BEM_VIEW_RADIUS;
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

      if (bemPlaneswalkPending && !isPlayer) {
        if (isOrthogToPlayer && cell?.faceUp) div.classList.add("bem-cell-planeswalk-glow");
        else if (isDiagToPlayer && cell && !cell.faceUp) div.classList.add("bem-cell-hellride-glow");
      }

      if (!cell) {
        div.classList.add(isPlayer ? "bem-cell-faceup" : "bem-cell-void");
        if (isPlayer) div.classList.add("bem-cell-player");
      } else if (cell.placeholder && !cell.card) {
        div.classList.add("bem-cell-placeholder");
        if (isPlayer) div.classList.add("bem-cell-player");
        const img = document.createElement("img");
        img.className = "bem-cell-placeholder-img";
        img.src = "images/assets/card-preview.jpg";
        img.alt = "";
        div.appendChild(img);
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
            if (bemLandOnPhenomenon) {
              div.classList.add("bem-cell-phenomenon-landing");
              bemLandOnPhenomenon = false;
            }
          } else {
            div.classList.add("bem-cell-active-plane");
          }
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
  const { bemCardNameLabel, bemStatusLabel } = ctx;
  const gameState = ctx.getGameState();
  if (!gameState?.bemGrid || !gameState?.bemPos) return;

  const cell = gameState.bemGrid.get(bemKey(gameState.bemPos.x, gameState.bemPos.y));

  if (cell?.placeholder && !cell?.card) {
    if (bemCardNameLabel) bemCardNameLabel.textContent = "Empty Cell";
    if (bemStatusLabel) bemStatusLabel.textContent = "Planeswalk to reveal a card.";
  } else {
    const card = cell?.card;
    if (bemCardNameLabel) bemCardNameLabel.textContent = card ? card.displayName : "";
    if (bemStatusLabel) {
      if (card?.type === "Phenomenon") {
        bemStatusLabel.textContent = "You've encountered a Phenomenon!";
      } else {
        const remaining = gameState.remaining.length;
        bemStatusLabel.textContent = `${remaining} card${remaining !== 1 ? "s" : ""} left`;
      }
    }
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
      if (gridCell?.card && gridCell.faceUp) openGameReaderView(gridCell.card, buildBemAdjacentCardActions(nx, ny));
    }
    return;
  }

  const gridCell = gameState.bemGrid.get(bemKey(nx, ny));
  if (gridCell?.card && gridCell.faceUp) {
    openGameReaderView(gridCell.card, buildBemAdjacentCardActions(nx, ny));
  }
}

export function toggleBemPlaneswalkMode() {
  const gameState = ctx.getGameState();
  if (!gameState?.bemGrid) return;
  const isPanning = bemViewOffset.dx !== 0 || bemViewOffset.dy !== 0;
  if (isPanning) {
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

  return [
    makeAction("Return to Library", (gs, key, cell, name) => {
      gs.remaining.push(cell.card);
      gs.bemGrid.set(key, { card: null, faceUp: true, placeholder: true });
      closeGameReaderView(); renderBemMap(); updateBemInfoBar(); syncBemTrButton();
      showToast(`${name} returned to library.`);
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
  const { closeGameReaderView } = ctx;
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

export function buildBemSideCardActions(sideIdx) {
  const { getGameState, closeGameReaderView, showToast } = ctx;

  return [
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
        closeGameReaderView();
        updateBemInfoBar();
        showToast(`${card.displayName} exiled.`);
      }
    }
  ];
}
