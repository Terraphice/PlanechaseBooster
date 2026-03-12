// ── gallery-modal.js ──────────────────────────────────────────────────────────
// Card detail modal: navigation between cards, asynchronous transcript loading,
// phenomenon flip animation, and URL hash synchronisation.

import { enhanceManaSymbols } from "./utils.js";

export function createModalManager({
  modal,
  modalImageWrap,
  modalImage,
  modalFlipHint,
  modalName,
  modalType,
  modalTranscript,
  modalSourceLink,
  modalScryfallLink,
  modalPrevButton,
  modalNextButton,
  modalTagList,
  randomCardButton,
  randomCardIcon,
  filters,
  displayState,
  paginationState,
  getFilteredCards,
  getAllCards,
  getTranscriptCache,
  callbacks
}) {
  const ALL_PALETTES = ["standard", "gruvbox", "atom", "dracula", "solarized", "nord", "catppuccin", "scryfall"];
  const THEME_PREFERENCES = ["system", "dark", "light"];
  const VIEW_MODES = ["grid", "single", "stack", "list"];
  const GROUP_MODES = ["none", "tag"];

  let currentModalIndex = -1;
  let modalImageFlipped = false;
  let modalCurrentCardImagePath = "";
  let randomLongPressTimer = null;
  let suppressRandomClick = false;
  let randomIconResetTimer = null;

  // ── URL helpers ───────────────────────────────────────────────────────────────

  function updateUrlForCard(card) {
    const hash = `#card=${encodeURIComponent(card.key)}`;
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
      history.pushState(null, "", url);
    }
  }

  function clearCardHash() {
    if (window.location.hash.startsWith("#card=")) {
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  }

  function getCardKeyFromHash() {
    const match = window.location.hash.match(/^#card=(.+)$/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  }

  function tryOpenCardFromHash() {
    const key = getCardKeyFromHash();
    if (!key) return;
    openModalByKey(key, false);
  }

  // ── Modal navigation ──────────────────────────────────────────────────────────

  function getPageBounds() {
    if (paginationState.mode === "paginated") {
      const start = (paginationState.currentPage - 1) * paginationState.pageSize;
      const end = Math.min(start + paginationState.pageSize, getFilteredCards().length) - 1;
      return { start, end };
    }
    return { start: 0, end: Math.min(paginationState.infiniteLoadedCount, getFilteredCards().length) - 1 };
  }

  function updateModalNavButtons() {
    const { start, end } = getPageBounds();
    modalPrevButton.disabled = currentModalIndex <= start;
    modalNextButton.disabled = currentModalIndex >= end;
  }

  function preloadAdjacentImages() {
    const filteredCards = getFilteredCards();
    callbacks.preloadCardImage(filteredCards[currentModalIndex - 1]);
    callbacks.preloadCardImage(filteredCards[currentModalIndex + 1]);
  }

  function getCurrentModalIndex() {
    return currentModalIndex;
  }

  function openModalByKey(cardKey, updateHash = true) {
    const filteredCards = getFilteredCards();
    let index = filteredCards.findIndex((card) => card.key === cardKey);

    if (index === -1) {
      const allCards = getAllCards();
      const cardInAll = allCards.find((card) => card.key === cardKey);
      if (!cardInAll) return;

      if (!filteredCards.some((card) => card.key === cardKey)) {
        const newFiltered = [...allCards];
        callbacks.sortCards(newFiltered);
        paginationState.currentPage = 1;
        paginationState.infiniteLoadedCount = paginationState.pageSize;
        callbacks.setFilteredCards(newFiltered);
        callbacks.renderGallery();
      }

      const updatedFiltered = getFilteredCards();
      index = updatedFiltered.findIndex((card) => card.key === cardKey);
      if (index === -1) return;
    }

    if (paginationState.mode === "paginated") {
      const targetPage = Math.floor(index / paginationState.pageSize) + 1;
      if (targetPage !== paginationState.currentPage) {
        paginationState.currentPage = targetPage;
        callbacks.renderGallery();
      }
    } else if (paginationState.mode === "infinite" && index >= paginationState.infiniteLoadedCount) {
      paginationState.infiniteLoadedCount = index + 1;
      callbacks.renderGallery();
    }

    currentModalIndex = index;
    renderModal(getFilteredCards()[currentModalIndex], updateHash);
  }

  async function renderModal(card, updateHash = true) {
    modalImageFlipped = false;
    modalCurrentCardImagePath = card.imagePath;
    modalImageWrap?.classList.remove("modal-image-flipped");
    modalImage.src = "";
    modalImage.alt = card.displayName;
    modalImage.src = card.imagePath;
    modalName.textContent = card.displayName;
    modalType.textContent = card.type;
    modalSourceLink.href = card.imagePath;

    const isOfficial = card.normalizedTags.some((t) => t.includes("official"));
    modalScryfallLink.classList.toggle("hidden", !isOfficial);
    const scryfallQuery = encodeURIComponent(`"${card.displayName}"`);
    modalScryfallLink.href = `https://scryfall.com/search?q=${scryfallQuery}&utm_source=planar-atlas&utm_medium=referral`;

    callbacks.setModalCardKey(card.key);

    modalTagList.innerHTML = "";
    for (const tag of card.tags) {
      modalTagList.appendChild(callbacks.createTagChipElement(tag, "modal-tag"));
    }

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    updateModalNavButtons();
    if (updateHash) updateUrlForCard(card);
    preloadAdjacentImages();

    const transcriptCache = getTranscriptCache();
    const cached = transcriptCache.get(card.key);
    if (typeof cached === "string") {
      renderTranscriptMarkdown(cached || "No transcript available.");
      return;
    }

    modalTranscript.innerHTML = "Loading transcript…";

    try {
      const response = await fetch(card.transcriptPath);
      if (!response.ok) throw new Error("Transcript not found");
      const transcript = await response.text();
      transcriptCache.set(card.key, transcript.trim());
      renderTranscriptMarkdown(transcript.trim() || "No transcript available.");
    } catch {
      transcriptCache.set(card.key, "");
      renderTranscriptMarkdown("No transcript available.");
    }
  }

  function closeModal(updateHash = true) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    modalImage.src = "";
    modalImage.alt = "";
    modalSourceLink.href = "#";
    modalTranscript.innerHTML = "No transcript available.";
    modalTagList.innerHTML = "";
    currentModalIndex = -1;
    if (updateHash) clearCardHash();
  }

  function showPreviousCard() {
    const { start } = getPageBounds();
    if (currentModalIndex <= start) return;
    currentModalIndex -= 1;
    renderModal(getFilteredCards()[currentModalIndex], true);
  }

  function showNextCard() {
    const { end } = getPageBounds();
    if (currentModalIndex >= end) return;
    currentModalIndex += 1;
    renderModal(getFilteredCards()[currentModalIndex], true);
  }

  // ── Transcript ────────────────────────────────────────────────────────────────

  function renderTranscriptMarkdown(markdownText) {
    try {
      const rawHtml = window.marked
        ? window.marked.parse(markdownText, { breaks: true })
        : markdownText.replace(/\n/g, "<br>");
      const safeHtml = window.DOMPurify ? window.DOMPurify.sanitize(rawHtml) : rawHtml;
      modalTranscript.innerHTML = enhanceManaSymbols(safeHtml);
    } catch {
      modalTranscript.textContent = markdownText;
    }
  }

  // ── Image flip ────────────────────────────────────────────────────────────────

  function flipModalImage() {
    if (!modalImage || !modalImageWrap) return;
    const wasFlipped = modalImageFlipped;
    modalImageFlipped = !wasFlipped;

    modalImageWrap.classList.add("modal-image-spinning");

    setTimeout(() => {
      if (wasFlipped) {
        modalImage.src = modalCurrentCardImagePath;
        modalImage.alt = modalName.textContent;
      } else {
        modalImage.src = "assets/card-preview.jpg";
        modalImage.alt = "Card back";
      }
      modalImageWrap.classList.toggle("modal-image-flipped", modalImageFlipped);
    }, 200);

    setTimeout(() => {
      modalImageWrap.classList.remove("modal-image-spinning");
    }, 400);
  }

  // ── Link copying ──────────────────────────────────────────────────────────────

  async function copyCurrentCardLink() {
    if (currentModalIndex < 0 || currentModalIndex >= getFilteredCards().length) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      callbacks.showToast("Link copied.");
    } catch {
      callbacks.showToast("Copy failed.");
    }
  }

  // ── Random card ───────────────────────────────────────────────────────────────

  function openRandomCard() {
    const filteredCards = getFilteredCards();
    if (!filteredCards.length) return;
    const randomIndex = Math.floor(Math.random() * filteredCards.length);
    openModalByKey(filteredCards[randomIndex].key, true);
  }

  function handleRandomPointerDown(event) {
    if (event.pointerType === "mouse") return;
    clearRandomLongPress();
    randomLongPressTimer = window.setTimeout(() => {
      suppressRandomClick = true;
      triggerChaosMode();
    }, 650);
  }

  function clearRandomLongPress() {
    if (randomLongPressTimer !== null) {
      window.clearTimeout(randomLongPressTimer);
      randomLongPressTimer = null;
    }
  }

  function getSuppressRandomClick() {
    return suppressRandomClick;
  }

  function clearSuppressRandomClick() {
    suppressRandomClick = false;
  }

  // ── Chaos mode ────────────────────────────────────────────────────────────────

  function triggerChaosIcon() {
    if (!randomCardButton) return;
    randomCardButton.classList.add("is-chaos");
    window.clearTimeout(randomIconResetTimer);
    randomIconResetTimer = window.setTimeout(() => {
      randomCardButton.classList.remove("is-chaos");
    }, 1200);
  }

  function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function sampleTags(max = 3) {
    const allCards = getAllCards();
    const allTags = [...new Set(allCards.flatMap((card) => card.tags))];
    const count = Math.floor(Math.random() * (max + 1));
    const selected = new Set();
    while (selected.size < count && allTags.length > 0) {
      selected.add(randomFrom(allTags));
    }
    return selected;
  }

  function capitalize(value) {
    return value ? value[0].toUpperCase() + value.slice(1) : value;
  }

  function triggerChaosMode() {
    const allCards = getAllCards();
    if (!allCards.length) return;

    triggerChaosIcon();

    const randomTheme = randomFrom(THEME_PREFERENCES);
    const randomPalette = randomFrom(ALL_PALETTES);
    callbacks.themeController.setTheme(randomTheme, {
      silent: true,
      paletteOverride: randomPalette,
      animate: true
    });

    filters.fuzzy = Math.random() < 0.5;
    filters.inlineAutocomplete = Math.random() < 0.5;
    filters.tags = sampleTags(3);

    const searchModeRoll = Math.random();
    if (searchModeRoll < 0.33) {
      filters.search = "";
    } else if (searchModeRoll < 0.66) {
      filters.search = randomFrom(allCards).displayName;
    } else {
      filters.search = `tag:${randomFrom([...new Set(allCards.flatMap((card) => card.tags))])}`;
    }

    displayState.viewMode = randomFrom(VIEW_MODES);
    displayState.groupBy = randomFrom(GROUP_MODES);
    displayState.groupTag = displayState.groupBy === "tag"
      ? randomFrom([...new Set(allCards.flatMap((card) => card.tags))])
      : "";

    callbacks.syncChaosUI(filters, displayState);
    callbacks.applyFilters();
    callbacks.renderGallery();
    callbacks.scheduleStackActiveUpdate();

    callbacks.showToast("Chaos unleashed.");
  }

  return {
    openModalByKey,
    renderModal,
    closeModal,
    showPreviousCard,
    showNextCard,
    flipModalImage,
    copyCurrentCardLink,
    openRandomCard,
    handleRandomPointerDown,
    clearRandomLongPress,
    getSuppressRandomClick,
    clearSuppressRandomClick,
    triggerChaosMode,
    triggerChaosIcon,
    renderTranscriptMarkdown,
    updateUrlForCard,
    clearCardHash,
    getCardKeyFromHash,
    tryOpenCardFromHash,
    getCurrentModalIndex
  };
}
