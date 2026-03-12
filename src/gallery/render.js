// ── gallery-render.js ─────────────────────────────────────────────────────────
// Card rendering in all view modes (grid, singleton, stack, list), pagination,
// active filter chips, and tag-based grouping.

import {
  getTagLabel,
  getTagToneClass,
  getBadgeTags,
  parseBadgeTag,
  escapeHtml
} from "./utils.js";

export function createRenderer({
  gallery,
  paginationControls,
  resultsCount,
  filters,
  displayState,
  paginationState,
  getFilteredCards,
  getTranscriptCache,
  callbacks
}) {
  const PAGE_SIZES = [10, 20, 50, 100];
  let stackActiveRaf = null;
  let infiniteScrollObserver = null;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function isSetCodeTag(tag) {
    return /^[A-Z]{2,6}$/.test(tag) || tag === "MagicCon";
  }

  function isRawBadgeTag(tag) {
    return tag.startsWith("badge:") || tag.startsWith(":top:badge:");
  }

  function getPlaneNameFromTags(tags) {
    return (
      tags.find(
        tag =>
          !isRawBadgeTag(tag) &&
          tag !== "Plane" &&
          tag !== "Phenomenon" &&
          tag !== "hidden" &&
          !isSetCodeTag(tag)
      ) || ""
    );
  }

  function getSetCodeFromTags(tags) {
    const setCodes = tags.filter(isSetCodeTag);
    const upperOnly = setCodes.filter(t => /^[A-Z]+$/.test(t));
    return upperOnly[0] || setCodes[0] || "";
  }

  function parseIllustratorFromTranscript(text) {
    const match = text.match(/^Illustrated by:\s*(.+)$/m);
    return match ? match[1].trim() : "";
  }

  function loadIllustratorCell(card, cell) {
    const cache = getTranscriptCache();
    const cached = cache.get(card.key);
    if (typeof cached === "string") {
      cell.textContent = parseIllustratorFromTranscript(cached) || "—";
      return;
    }
    if (cached === null) return;
    cache.set(card.key, null);
    fetch(card.transcriptPath)
      .then(r => (r.ok ? r.text() : ""))
      .then(text => {
        const t = text.trim();
        cache.set(card.key, t);
        if (cell.isConnected) {
          cell.textContent = parseIllustratorFromTranscript(t) || "—";
        }
      })
      .catch(() => {
        cache.set(card.key, "");
      });
  }

  // ── Layout helpers ────────────────────────────────────────────────────────────

  function getLayoutClassName() {
    if (displayState.viewMode === "single") return "single-card-layout";
    if (displayState.viewMode === "stack") return "stack-card-layout";
    if (displayState.viewMode === "list") return "list-card-layout";
    return "card-grid";
  }

  function groupCards(cards, mode, selectedTag) {
    const groups = new Map();
    if (mode === "tag") {
      if (!selectedTag) {
        addCardToGroup(groups, "Ungrouped", ...cards);
      } else {
        const selectedTagLower = selectedTag.toLowerCase();
        addCardToGroup(
          groups,
          `Has tag: ${getTagLabel(selectedTag)}`,
          ...cards.filter((card) => card.normalizedTags.includes(selectedTagLower))
        );
        addCardToGroup(
          groups,
          `Missing tag: ${getTagLabel(selectedTag)}`,
          ...cards.filter((card) => !card.normalizedTags.includes(selectedTagLower))
        );
      }
    }
    return [...groups.entries()].map(([label, groupedCards]) => ({
      label,
      cards: groupedCards
    }));
  }

  function addCardToGroup(map, label, ...cards) {
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(...cards);
  }

  // ── Badge / chip rendering ────────────────────────────────────────────────────

  function renderCardBadgeLayer(card) {
    const badges = getBadgeTags(card.tags);
    if (badges.length === 0) return null;

    const grouped = { tl: [], tr: [], bl: [], br: [] };
    for (const badge of badges) {
      grouped[badge.corner].push(badge);
    }

    const layer = document.createElement("div");
    layer.className = "card-badge-layer";

    for (const corner of ["tl", "tr", "bl", "br"]) {
      if (grouped[corner].length === 0) continue;
      const stack = document.createElement("div");
      stack.className = `card-badge-stack ${corner}`;
      for (const badge of grouped[corner]) {
        const badgeEl = document.createElement("div");
        badgeEl.className = `card-badge tone-${badge.color}`;
        badgeEl.textContent = badge.label;
        stack.appendChild(badgeEl);
      }
      layer.appendChild(stack);
    }

    return layer;
  }

  function createTagChipElement(tag, className = "card-tag") {
    const chip = document.createElement("span");
    chip.className = getTagToneClass(tag, className);
    chip.textContent = getTagLabel(tag);
    chip.dataset.tag = tag;
    chip.classList.toggle("active", filters.tags.has(tag));
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      callbacks.toggleTagFilter(tag);
    });
    return chip;
  }

  // ── Card elements ─────────────────────────────────────────────────────────────

  function createCardElement(card, index = 0) {
    const cardButton = document.createElement("button");
    cardButton.type = "button";
    cardButton.className = "card-link";
    cardButton.setAttribute("aria-label", `Open viewer for ${card.displayName}`);
    cardButton.dataset.cardKey = card.key;

    if (displayState.viewMode === "single") cardButton.classList.add("single-card-item");
    if (displayState.viewMode === "stack") {
      cardButton.classList.add("stack-card-item");
      cardButton.style.zIndex = String(index + 1);
    }

    const article = document.createElement("article");
    article.className = "card";

    const badgeLayer = renderCardBadgeLayer(card);
    if (badgeLayer) article.appendChild(badgeLayer);

    const imageWrap = document.createElement("div");
    imageWrap.className = "card-image-wrap";
    imageWrap.innerHTML = `<img class="card-image" src="${card.thumbPath}" alt="${escapeHtml(card.displayName)}" loading="lazy" />`;

    const deckOverlay = document.createElement("div");
    deckOverlay.className = "deck-card-overlay";
    deckOverlay.dataset.cardKey = card.key;

    const deckCount = callbacks.getCardDeckCount(card.key);
    deckOverlay.innerHTML = `
      <div class="deck-overlay-controls">
        <button class="deck-overlay-btn deck-overlay-dec" data-action="dec" aria-label="Remove one copy" type="button"${deckCount === 0 ? " disabled" : ""}>−</button>
        <span class="deck-overlay-count">${deckCount > 0 ? deckCount : ""}</span>
        <button class="deck-overlay-btn deck-overlay-inc" data-action="inc" aria-label="Add one copy" type="button">+</button>
      </div>
    `;
    if (deckCount > 0) deckOverlay.classList.add("deck-has-count");

    deckOverlay.addEventListener("click", (event) => {
      event.stopPropagation();
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      if (btn.dataset.action === "inc") callbacks.addCardToDeck(card.key);
      else if (btn.dataset.action === "dec") callbacks.removeCardFromDeck(card.key);
    });

    imageWrap.appendChild(deckOverlay);

    const footer = document.createElement("div");
    footer.className = "card-footer";

    const nameRow = document.createElement("div");
    nameRow.className = "card-name-row";
    nameRow.innerHTML = `
      <h3 class="card-name">${escapeHtml(card.displayName)}</h3>
      <div class="card-type">${escapeHtml(card.type)}</div>
    `;

    const tagsContainer = document.createElement("div");
    tagsContainer.className = "card-tags";

    const MAX_TAG_CHARS = 35;
    let charCount = 0;
    const visibleTags = [];
    for (const tag of card.tags) {
      const label = getTagLabel(tag);
      if (visibleTags.length === 0 || charCount + label.length <= MAX_TAG_CHARS) {
        visibleTags.push(tag);
        charCount += label.length;
      } else {
        break;
      }
    }
    for (const tag of visibleTags) {
      tagsContainer.appendChild(createTagChipElement(tag, "card-tag"));
    }
    const hiddenCount = card.tags.length - visibleTags.length;
    if (hiddenCount > 0) {
      const more = document.createElement("span");
      more.className = "card-tag card-tag-more";
      more.textContent = `+${hiddenCount}`;
      more.setAttribute("aria-hidden", "true");
      tagsContainer.appendChild(more);
    }

    footer.appendChild(nameRow);
    footer.appendChild(tagsContainer);
    article.appendChild(imageWrap);
    article.appendChild(footer);
    cardButton.appendChild(article);

    cardButton.addEventListener("click", () => {
      if (callbacks.isDeckPanelOpen()) return;
      callbacks.openModalByKey(card.key, true);
    });
    return cardButton;
  }

  function createListHeader() {
    const header = document.createElement("div");
    header.className = "list-card-header";
    header.setAttribute("aria-hidden", "true");
    const labels = ["Card Name", "Type", "Plane / Setting", "Set", "Illustrator", "Tags", ""];
    for (const label of labels) {
      const cell = document.createElement("span");
      cell.className = "list-header-cell";
      cell.textContent = label;
      header.appendChild(cell);
    }
    return header;
  }

  function createListCardElement(card) {
    const row = document.createElement("div");
    row.className = "list-card-row";
    row.dataset.cardKey = card.key;

    const nameBtn = document.createElement("button");
    nameBtn.type = "button";
    nameBtn.className = "list-card-name";
    nameBtn.textContent = card.displayName;
    nameBtn.setAttribute("aria-label", `Open viewer for ${card.displayName}`);
    nameBtn.addEventListener("click", () => {
      if (callbacks.isDeckPanelOpen()) return;
      callbacks.openModalByKey(card.key, true);
    });

    const typeEl = document.createElement("span");
    typeEl.className = "list-card-type";
    typeEl.textContent = card.type;

    const planeEl = document.createElement("span");
    planeEl.className = "list-card-plane";
    const planeName = card.type === "Plane" ? getPlaneNameFromTags(card.tags) : "";
    planeEl.textContent = planeName || "—";

    const setEl = document.createElement("span");
    setEl.className = "list-card-set";
    setEl.textContent = getSetCodeFromTags(card.tags) || "—";

    const illEl = document.createElement("span");
    illEl.className = "list-card-illustrator";
    illEl.textContent = "—";
    loadIllustratorCell(card, illEl);

    const tagsEl = document.createElement("div");
    tagsEl.className = "list-card-tags";
    const badgeTags = card.tags.filter(isRawBadgeTag);
    for (const tag of badgeTags.slice(0, 3)) {
      tagsEl.appendChild(createTagChipElement(tag, "card-tag"));
    }

    const deckEl = document.createElement("div");
    deckEl.className = "list-card-deck";
    const deckCount = callbacks.getCardDeckCount(card.key);
    deckEl.innerHTML = `
      <button class="list-deck-btn list-deck-dec" data-action="dec" aria-label="Remove one copy" type="button"${deckCount === 0 ? " disabled" : ""}>−</button>
      <span class="list-deck-count">${deckCount > 0 ? String(deckCount) : "·"}</span>
      <button class="list-deck-btn list-deck-inc" data-action="inc" aria-label="Add one copy" type="button">+</button>
    `;
    deckEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const decBtn = deckEl.querySelector("[data-action='dec']");
      if (btn.dataset.action === "inc") {
        callbacks.addCardToDeck(card.key);
      } else if (btn.dataset.action === "dec") {
        callbacks.removeCardFromDeck(card.key);
      }
      const newCount = callbacks.getCardDeckCount(card.key);
      const countEl = deckEl.querySelector(".list-deck-count");
      if (countEl) countEl.textContent = newCount > 0 ? String(newCount) : "·";
      if (decBtn) decBtn.disabled = newCount === 0;
    });

    row.appendChild(nameBtn);
    row.appendChild(typeEl);
    row.appendChild(planeEl);
    row.appendChild(setEl);
    row.appendChild(illEl);
    row.appendChild(tagsEl);
    row.appendChild(deckEl);

    return row;
  }

  // ── Stack active card ─────────────────────────────────────────────────────────

  function scheduleStackActiveUpdate() {
    if (stackActiveRaf !== null) return;
    stackActiveRaf = window.requestAnimationFrame(() => {
      stackActiveRaf = null;
      updateStackActiveCard();
    });
  }

  function updateStackActiveCard() {
    if (displayState.viewMode !== "stack") return;
    const stackItems = [...gallery.querySelectorAll(".stack-card-item")];
    if (!stackItems.length) return;

    stackItems.forEach((item, index) => {
      item.classList.remove("stack-active");
      item.style.zIndex = String(index + 1);
    });

    const prefersCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (!prefersCoarsePointer) return;

    const viewportCenter = window.innerHeight / 2;
    let bestItem = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const item of stackItems) {
      const rect = item.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      const itemCenter = rect.top + rect.height / 2;
      const distance = Math.abs(itemCenter - viewportCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestItem = item;
      }
    }

    if (!bestItem) bestItem = stackItems[0];
    bestItem.classList.add("stack-active");
    bestItem.style.zIndex = "50";
  }

  // ── Active filters ────────────────────────────────────────────────────────────

  function renderActiveFilters(parsedQuery, activeFiltersEl) {
    activeFiltersEl.innerHTML = "";
    const pillData = [];

    if (filters.search) pillData.push({ label: `Search: ${filters.search}`, removable: false });

    for (const tag of filters.tags) {
      pillData.push({ label: `Tag: ${getTagLabel(tag)}`, removable: true, tag });
    }

    for (const value of parsedQuery.tagTerms) pillData.push({ label: `tag:${value}`, removable: false });
    for (const value of parsedQuery.negTagTerms) pillData.push({ label: `-tag:${value}`, removable: false });
    for (const value of parsedQuery.nameTerms) pillData.push({ label: `name:${value}`, removable: false });
    for (const value of parsedQuery.negNameTerms) pillData.push({ label: `-name:${value}`, removable: false });
    for (const value of parsedQuery.oracleTerms) pillData.push({ label: `o:${value}`, removable: false });
    for (const value of parsedQuery.negOracleTerms) pillData.push({ label: `-o:${value}`, removable: false });

    if (parsedQuery.regexSource) pillData.push({ label: `regex:${parsedQuery.regexSource}`, removable: false });
    if (filters.fuzzy) pillData.push({ label: "Fuzzy", removable: false });
    if (filters.showHidden) pillData.push({ label: "Hidden", removable: false });

    for (const pill of pillData) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "active-filter-pill";
      element.textContent = pill.removable ? `${pill.label} ×` : pill.label;

      if (pill.removable) {
        element.classList.add("active-filter-pill-removable");
        element.dataset.tag = pill.tag;
        const badge = parseBadgeTag(pill.tag);
        if (badge) element.classList.add(`tone-${badge.color}`);
      } else {
        element.disabled = true;
      }

      activeFiltersEl.appendChild(element);
    }
  }

  // ── Preloading ────────────────────────────────────────────────────────────────

  function preloadCardImage(card) {
    if (!card || !card.imagePath) return;
    const img = new Image();
    img.src = card.imagePath;
  }

  function preloadPageImages(cards) {
    let i = 0;
    function preloadNext() {
      if (i >= cards.length) return;
      const card = cards[i++];
      if (card.imagePath) {
        const img = new Image();
        img.onload = preloadNext;
        img.onerror = preloadNext;
        img.src = card.imagePath;
      } else {
        preloadNext();
      }
    }
    preloadNext();
  }

  function startPreloadingAfterThumbnails(cards) {
    const thumbImgs = [...gallery.querySelectorAll(".card-image")];
    if (thumbImgs.length === 0) { preloadPageImages(cards); return; }

    let remaining = thumbImgs.filter((img) => !img.complete).length;
    if (remaining === 0) { preloadPageImages(cards); return; }

    const onSettled = () => {
      remaining--;
      if (remaining <= 0) preloadPageImages(cards);
    };

    for (const img of thumbImgs) {
      if (!img.complete) {
        img.addEventListener("load", onSettled, { once: true });
        img.addEventListener("error", onSettled, { once: true });
      }
    }
  }

  // ── Infinite scroll ───────────────────────────────────────────────────────────

  function setupInfiniteScroll() {
    disconnectInfiniteScroll();
    const sentinel = document.createElement("div");
    sentinel.className = "infinite-scroll-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    gallery.appendChild(sentinel);

    infiniteScrollObserver = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreInfiniteCards(); },
      { rootMargin: "0px 0px 400px 0px" }
    );
    infiniteScrollObserver.observe(sentinel);
  }

  function disconnectInfiniteScroll() {
    if (infiniteScrollObserver) {
      infiniteScrollObserver.disconnect();
      infiniteScrollObserver = null;
    }
  }

  function loadMoreInfiniteCards() {
    const filteredCards = getFilteredCards();
    if (paginationState.infiniteLoadedCount >= filteredCards.length) return;

    const startIndex = paginationState.infiniteLoadedCount;
    const newCount = Math.min(startIndex + paginationState.pageSize, filteredCards.length);
    const newCards = filteredCards.slice(startIndex, newCount);
    paginationState.infiniteLoadedCount = newCount;

    if (displayState.groupBy === "none") {
      const wrapper = gallery.querySelector(".card-grid, .single-card-layout, .stack-card-layout, .list-card-layout");
      if (wrapper) {
        newCards.forEach((card, i) => wrapper.appendChild(
          displayState.viewMode === "list"
            ? createListCardElement(card)
            : createCardElement(card, startIndex + i)
        ));
        scheduleStackActiveUpdate();
        renderPaginationControls(filteredCards.length);
        if (paginationState.infiniteLoadedCount < filteredCards.length) setupInfiniteScroll();
        return;
      }
    }
    renderGallery();
  }

  // ── Pagination ────────────────────────────────────────────────────────────────

  function getPageCards(totalCards) {
    const filteredCards = getFilteredCards();
    if (paginationState.mode === "infinite") {
      const count = Math.min(paginationState.infiniteLoadedCount, totalCards);
      return filteredCards.slice(0, count);
    }
    const start = (paginationState.currentPage - 1) * paginationState.pageSize;
    return filteredCards.slice(start, start + paginationState.pageSize);
  }

  function renderPaginationControls(totalCards) {
    if (!paginationControls) return;
    paginationControls.innerHTML = "";

    if (totalCards === 0) {
      paginationControls.classList.add("hidden");
      return;
    }

    paginationControls.classList.remove("hidden");

    if (paginationState.mode === "paginated") {
      const totalPages = Math.max(1, Math.ceil(totalCards / paginationState.pageSize));
      const startCard = (paginationState.currentPage - 1) * paginationState.pageSize + 1;
      const endCard = Math.min(paginationState.currentPage * paginationState.pageSize, totalCards);

      const navRow = document.createElement("div");
      navRow.className = "pagination-nav";

      const firstBtn = document.createElement("button");
      firstBtn.type = "button";
      firstBtn.className = "pagination-btn";
      firstBtn.setAttribute("aria-label", "First page");
      firstBtn.textContent = "First";
      firstBtn.disabled = paginationState.currentPage <= 1;
      firstBtn.addEventListener("click", goToFirstPage);

      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "pagination-btn";
      prevBtn.setAttribute("aria-label", "Previous page");
      prevBtn.textContent = "‹ Prev";
      prevBtn.disabled = paginationState.currentPage <= 1;
      prevBtn.addEventListener("click", goToPrevPage);

      const pageLabel = document.createElement("span");
      pageLabel.className = "pagination-page-label";
      pageLabel.textContent = `${startCard}–${endCard} of ${totalCards}`;

      const pageMeta = document.createElement("span");
      pageMeta.className = "pagination-page-meta";
      pageMeta.appendChild(document.createTextNode("Page "));
      const pageInput = document.createElement("input");
      pageInput.type = "number";
      pageInput.className = "pagination-page-input";
      pageInput.value = paginationState.currentPage;
      pageInput.min = 1;
      pageInput.max = totalPages;
      pageInput.setAttribute("aria-label", "Go to page");
      pageInput.setAttribute("inputmode", "numeric");
      pageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const page = parseInt(pageInput.value, 10);
          if (!isNaN(page)) {
            paginationState.currentPage = Math.max(1, Math.min(totalPages, page));
            renderGallery();
            callbacks.updateUrlFromState({ push: true });
          }
          pageInput.blur();
        }
      });
      pageMeta.appendChild(pageInput);
      pageMeta.appendChild(document.createTextNode(` of ${totalPages}`));

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "pagination-btn";
      nextBtn.setAttribute("aria-label", "Next page");
      nextBtn.textContent = "Next ›";
      nextBtn.disabled = paginationState.currentPage >= totalPages;
      nextBtn.addEventListener("click", goToNextPage);

      const lastBtn = document.createElement("button");
      lastBtn.type = "button";
      lastBtn.className = "pagination-btn";
      lastBtn.setAttribute("aria-label", "Last page");
      lastBtn.textContent = "Last";
      lastBtn.disabled = paginationState.currentPage >= totalPages;
      lastBtn.addEventListener("click", goToLastPage);

      const topBtn = document.createElement("button");
      topBtn.type = "button";
      topBtn.className = "pagination-btn pagination-top-btn";
      topBtn.setAttribute("aria-label", "Scroll to top");
      topBtn.textContent = "Top";
      topBtn.addEventListener("click", scrollToGalleryTop);

      navRow.appendChild(firstBtn);
      navRow.appendChild(prevBtn);
      navRow.appendChild(pageLabel);
      navRow.appendChild(pageMeta);
      navRow.appendChild(nextBtn);
      navRow.appendChild(lastBtn);
      paginationControls.appendChild(topBtn);
      paginationControls.appendChild(navRow);
    } else {
      const shown = Math.min(paginationState.infiniteLoadedCount, totalCards);
      const infoRow = document.createElement("div");
      infoRow.className = "pagination-infinite-info";
      infoRow.textContent = shown < totalCards
        ? `Showing ${shown} of ${totalCards} cards`
        : `All ${totalCards} cards loaded`;
      paginationControls.appendChild(infoRow);
    }

    const perPageRow = document.createElement("div");
    perPageRow.className = "pagination-per-page-row";

    const label = document.createElement("label");
    label.className = "pagination-per-page-label";
    label.htmlFor = "per-page-select";
    label.textContent = "Per page:";

    const select = document.createElement("select");
    select.className = "select-input pagination-per-page-select";
    select.id = "per-page-select";
    select.setAttribute("aria-label", "Cards per page");

    const options = [
      ...PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) })),
      { value: "infinite", label: "∞ Infinite scroll" }
    ];

    for (const { value, label: optLabel } of options) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = optLabel;
      const selected =
        (value === "infinite" && paginationState.mode === "infinite") ||
        (value !== "infinite" && paginationState.mode === "paginated" && parseInt(value, 10) === paginationState.pageSize);
      if (selected) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener("change", handlePerPageChange);

    perPageRow.appendChild(label);
    perPageRow.appendChild(select);
    paginationControls.appendChild(perPageRow);
  }

  function handlePerPageChange(event) {
    const value = event.target.value;
    if (value === "infinite") {
      paginationState.mode = "infinite";
      paginationState.infiniteLoadedCount = paginationState.pageSize;
    } else {
      const newSize = parseInt(value, 10);
      paginationState.mode = "paginated";
      paginationState.pageSize = newSize;
      paginationState.currentPage = 1;
      paginationState.infiniteLoadedCount = newSize;
    }
    callbacks.persistPreferences();
    renderGallery();
  }

  function goToFirstPage() {
    if (paginationState.currentPage <= 1) return;
    paginationState.currentPage = 1;
    renderGallery();
    callbacks.updateUrlFromState({ push: true });
  }

  function goToPrevPage() {
    if (paginationState.currentPage <= 1) return;
    paginationState.currentPage--;
    renderGallery();
    callbacks.updateUrlFromState({ push: true });
  }

  function goToNextPage() {
    const filteredCards = getFilteredCards();
    const totalPages = Math.ceil(filteredCards.length / paginationState.pageSize);
    if (paginationState.currentPage >= totalPages) return;
    paginationState.currentPage++;
    renderGallery();
    callbacks.updateUrlFromState({ push: true });
  }

  function goToLastPage() {
    const filteredCards = getFilteredCards();
    const totalPages = Math.ceil(filteredCards.length / paginationState.pageSize);
    if (paginationState.currentPage >= totalPages) return;
    paginationState.currentPage = totalPages;
    renderGallery();
    callbacks.updateUrlFromState({ push: true });
  }

  function scrollToGalleryTop() {
    const gallerySection = gallery.closest(".gallery-section");
    (gallerySection || gallery).scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  function renderGallery() {
    disconnectInfiniteScroll();
    gallery.innerHTML = "";

    const filteredCards = getFilteredCards();
    const totalCards = filteredCards.length;
    resultsCount.textContent = `${totalCards} ${totalCards === 1 ? "card" : "cards"}`;

    if (totalCards === 0) {
      gallery.innerHTML = `<p class="empty-state">No cards match the current filters.</p>`;
      renderPaginationControls(totalCards);
      return;
    }

    const cardsToShow = getPageCards(totalCards);

    if (displayState.groupBy === "none") {
      const wrapper = document.createElement("div");
      wrapper.className = getLayoutClassName();

      if (displayState.viewMode === "list") {
        wrapper.appendChild(createListHeader());
      }

      cardsToShow.forEach((card, index) => {
        wrapper.appendChild(
          displayState.viewMode === "list"
            ? createListCardElement(card)
            : createCardElement(card, index)
        );
      });

      gallery.appendChild(wrapper);
      scheduleStackActiveUpdate();
    } else {
      const grouped = groupCards(cardsToShow, displayState.groupBy, displayState.groupTag);
      const groupsWrap = document.createElement("div");
      groupsWrap.className = "result-groups";

      for (const group of grouped) {
        if (!group.cards.length) continue;

        const section = document.createElement("section");
        section.className = "result-group";

        const inner = document.createElement("div");
        inner.className = `${getLayoutClassName()} result-group-body`;

        if (displayState.viewMode === "list") {
          inner.appendChild(createListHeader());
        }

        group.cards.forEach((card, index) => {
          inner.appendChild(
            displayState.viewMode === "list"
              ? createListCardElement(card)
              : createCardElement(card, index)
          );
        });

        section.innerHTML = `
          <div class="result-group-header">
            <h3 class="result-group-title">${escapeHtml(group.label)}</h3>
            <p class="result-group-meta">${group.cards.length} ${group.cards.length === 1 ? "card" : "cards"}</p>
          </div>
        `;

        section.appendChild(inner);
        groupsWrap.appendChild(section);
      }

      gallery.appendChild(groupsWrap);
      scheduleStackActiveUpdate();
    }

    renderPaginationControls(totalCards);

    if (paginationState.mode === "infinite" && paginationState.infiniteLoadedCount < totalCards) {
      setupInfiniteScroll();
    }

    startPreloadingAfterThumbnails(cardsToShow);
  }

  return {
    renderGallery,
    renderPaginationControls,
    renderActiveFilters,
    createCardElement,
    createListCardElement,
    createTagChipElement,
    scheduleStackActiveUpdate,
    updateStackActiveCard,
    preloadCardImage,
    disconnectInfiniteScroll
  };
}
