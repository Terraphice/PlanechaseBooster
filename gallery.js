import {
  loadPreferences,
  savePreferences,
  enrichCard,
  sortCards,
  reconcileSelectedTags,
  readUrlState,
  writeUrlState,
  matchesFilters,
  parseSearchQuery,
  getTagLabel,
  getTagToneClass,
  getBadgeTags,
  parseBadgeTag,
  isTopTag,
  escapeHtml
} from "./gallery-utils.js";

import {
  initToastManager,
  initThemeController
} from "./gallery-ui.js";

const STORAGE_KEY = "planechaseGalleryPreferences.v2";
const ALL_PALETTES = ["standard", "gruvbox", "atom", "dracula", "solarized", "nord", "catppuccin"];
const THEME_PREFERENCES = ["system", "dark", "light"];
const VIEW_MODES = ["grid", "single", "stack"];
const GROUP_MODES = ["none", "tag"];
const PAGE_SIZES = [10, 20, 50, 100];

let allCards = [];
let filteredCards = [];
let currentModalIndex = -1;
let stackActiveRaf = null;
let suggestionIndex = -1;
let activeSearchSurface = "top";
let randomLongPressTimer = null;
let suppressRandomClick = false;
let randomIconResetTimer = null;
let infiniteScrollObserver = null;

const transcriptCache = new Map();

const resultsCount = document.getElementById("results-count");
const activeFilters = document.getElementById("active-filters");
const tagFilterList = document.getElementById("tag-filter-list");

const topSearch = document.getElementById("top-search");
const topSearchGhost = document.getElementById("top-search-ghost");
const topSearchSuggestions = document.getElementById("top-search-suggestions");

const sidebarSearch = document.getElementById("sidebar-search");
const sidebarSearchGhost = document.getElementById("sidebar-search-ghost");
const sidebarSearchSuggestions = document.getElementById("sidebar-search-suggestions");

const fuzzySearchToggle = document.getElementById("fuzzy-search-toggle");
const inlineAutocompleteToggle = document.getElementById("inline-autocomplete-toggle");

const sidebar = document.getElementById("sidebar");
const sidebarContent = document.getElementById("sidebar-content");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarLip = document.getElementById("sidebar-lip");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const randomCardButton = document.getElementById("random-card-button");
const randomCardIcon = document.getElementById("random-card-icon");

const clearTagFiltersButton = document.getElementById("clear-tag-filters");
const clearAllFiltersButton = document.getElementById("clear-all-filters");

const viewModeSelect = document.getElementById("view-mode-select");
const groupBySelect = document.getElementById("group-by-select");
const groupTagPickerWrap = document.getElementById("group-tag-picker-wrap");
const groupTagSelect = document.getElementById("group-tag-select");

const settingsMenuToggle = document.getElementById("settings-menu-toggle");
const settingsMenu = document.getElementById("settings-menu");
const settingsClearPreferencesButton = document.getElementById("settings-clear-preferences");
const settingsContactDeveloperLink = document.getElementById("settings-contact-developer");
const themeToggleButton = document.getElementById("theme-toggle");

const modal = document.getElementById("card-modal");
const modalImage = document.getElementById("modal-image");
const modalName = document.getElementById("modal-card-name");
const modalType = document.getElementById("modal-card-type");
const modalTranscript = document.getElementById("modal-transcript");
const modalSourceLink = document.getElementById("modal-source-link");
const modalCloseButton = document.getElementById("modal-close");
const modalPrevButton = document.getElementById("modal-prev");
const modalNextButton = document.getElementById("modal-next");
const modalTagList = document.getElementById("modal-tag-list");
const modalCopyLinkButton = document.getElementById("modal-copy-link");
const gallery = document.getElementById("gallery");
const toastRegion = document.getElementById("toast-region");
const paginationControls = document.getElementById("pagination-controls");

const preferences = loadPreferences(STORAGE_KEY);

const paginationState = {
  currentPage: 1,
  pageSize: preferences.pageSize,
  mode: preferences.paginationMode,
  infiniteLoadedCount: preferences.pageSize
};

const filters = {
  search: "",
  tags: new Set(),
  fuzzy: preferences.fuzzySearch,
  inlineAutocomplete: preferences.inlineAutocomplete
};

const displayState = {
  viewMode: preferences.viewMode,
  groupBy: preferences.groupBy,
  groupTag: preferences.groupTag
};

const showToast = initToastManager(toastRegion);
const themeController = initThemeController({
  button: themeToggleButton,
  initialTheme: preferences.theme,
  initialPalette: preferences.themePalette,
  onChange(theme, palette) {
    persistPreferences();
    const paletteLabel = palette === "standard" ? "" : ` ${capitalize(palette)}`;
    showToast(`Theme set to ${theme}${paletteLabel}.`);
  }
});

init();

async function init() {
  try {
    readUrlState(filters, displayState);
    applyStoredPreferencesToUI();

    const response = await fetch("cards.json");
    if (!response.ok) throw new Error("Failed to load cards.json");

    const rawCards = await response.json();
    allCards = rawCards.map(enrichCard);

    filters.tags = reconcileSelectedTags(filters.tags, allCards);

    if (displayState.groupTag) {
      displayState.groupTag = reconcileSelectedTags(new Set([displayState.groupTag]), allCards).values().next().value || "";
    }

    buildTagFilters(allCards);
    buildGroupTagOptions(allCards);
    bindEvents();
    syncTagFilterUI();
    applyFilters({ updateUrl: false });
    tryOpenCardFromHash();
  } catch (error) {
    console.error(error);
    gallery.innerHTML = `<p class="empty-state">Could not load gallery data.</p>`;
    resultsCount.textContent = "";
  }
}

function applyStoredPreferencesToUI() {
  viewModeSelect.value = displayState.viewMode;
  groupBySelect.value = displayState.groupBy;
  fuzzySearchToggle.checked = filters.fuzzy;
  inlineAutocompleteToggle.checked = filters.inlineAutocomplete;
  topSearch.value = filters.search;
  sidebarSearch.value = filters.search;
  topSearchGhost.value = "";
  sidebarSearchGhost.value = "";
  groupTagPickerWrap.classList.toggle("hidden", displayState.groupBy !== "tag");
}

function persistPreferences() {
  savePreferences(
    STORAGE_KEY,
    displayState,
    filters,
    themeController.getTheme(),
    themeController.getPalette(),
    paginationState
  );
}

function updateUrlFromState(options) {
  writeUrlState(filters, displayState, options);
}

function bindEvents() {
  topSearch.addEventListener("focus", () => {
    activeSearchSurface = "top";
    renderSearchSuggestions();
    updateInlineAutocomplete();
  });

  sidebarSearch.addEventListener("focus", () => {
    activeSearchSurface = "sidebar";
    hideAllSearchSuggestions();
    updateInlineAutocomplete();
  });

  topSearch.addEventListener("input", syncSearchInputsFromTop);
  sidebarSearch.addEventListener("input", syncSearchInputsFromSidebar);

  topSearch.addEventListener("keydown", handleSearchKeydown);
  sidebarSearch.addEventListener("keydown", handleSearchKeydown);

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;

    const insideTopSearch = topSearch.contains(event.target) || topSearchSuggestions.contains(event.target);
    const insideSidebarSearch = sidebarSearch.contains(event.target);
    const insideSettings = settingsMenu.contains(event.target) || settingsMenuToggle.contains(event.target);

    if (!insideTopSearch && !insideSidebarSearch) {
      hideAllSearchSuggestions();
    }

    if (!insideSettings) {
      closeSettingsMenu();
    }
  });

  fuzzySearchToggle.addEventListener("change", () => {
    filters.fuzzy = fuzzySearchToggle.checked;
    persistPreferences();
    applyFilters();
  });

  inlineAutocompleteToggle.addEventListener("change", () => {
    filters.inlineAutocomplete = inlineAutocompleteToggle.checked;
    persistPreferences();
    updateInlineAutocomplete();
    applyFilters();
  });

  clearTagFiltersButton.addEventListener("click", () => {
    filters.tags.clear();
    syncTagFilterUI();
    applyFilters();
    showToast("Tag filters cleared.");
  });

  clearAllFiltersButton.addEventListener("click", () => {
    clearAllFilters();
    showToast("All filters cleared.");
  });

  viewModeSelect.addEventListener("change", () => {
    displayState.viewMode = viewModeSelect.value;
    persistPreferences();
    renderGallery();
    scheduleStackActiveUpdate();
    updateUrlFromState();
  });

  groupBySelect.addEventListener("change", () => {
    displayState.groupBy = groupBySelect.value;
    groupTagPickerWrap.classList.toggle("hidden", displayState.groupBy !== "tag");
    persistPreferences();
    paginationState.currentPage = 1;
    paginationState.infiniteLoadedCount = paginationState.pageSize;
    renderGallery();
    scheduleStackActiveUpdate();
    updateUrlFromState();
  });

  groupTagSelect.addEventListener("change", () => {
    displayState.groupTag = groupTagSelect.value;
    persistPreferences();
    paginationState.currentPage = 1;
    paginationState.infiniteLoadedCount = paginationState.pageSize;
    renderGallery();
    scheduleStackActiveUpdate();
    updateUrlFromState();
  });

  sidebarToggle.addEventListener("click", closeSidebar);
  sidebarLip.addEventListener("click", toggleSidebar);
  sidebarBackdrop.addEventListener("click", closeSidebar);

  settingsMenuToggle.addEventListener("click", toggleSettingsMenu);
  settingsClearPreferencesButton.addEventListener("click", clearSavedPreferences);
  settingsContactDeveloperLink.addEventListener("click", closeSettingsMenu);

  randomCardButton.addEventListener("click", (event) => {
    if (suppressRandomClick) {
      suppressRandomClick = false;
      event.preventDefault();
      return;
    }

    if (event.altKey) {
      event.preventDefault();
      triggerChaosMode();
      return;
    }

    openRandomCard();
  });

  randomCardButton.addEventListener("pointerdown", handleRandomPointerDown);
  randomCardButton.addEventListener("pointerup", clearRandomLongPress);
  randomCardButton.addEventListener("pointercancel", clearRandomLongPress);
  randomCardButton.addEventListener("pointerleave", clearRandomLongPress);

  modal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
      closeModal();
    }
  });

  modalCloseButton.addEventListener("click", closeModal);
  modalPrevButton.addEventListener("click", showPreviousCard);
  modalNextButton.addEventListener("click", showNextCard);
  modalCopyLinkButton.addEventListener("click", copyCurrentCardLink);

  modalTagList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const tag = target.dataset.tag;
    if (!tag) return;
    event.preventDefault();
    event.stopPropagation();
    toggleTagFilter(tag);
  });

  activeFilters.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const tag = target.dataset.tag;
    if (!tag) return;
    event.preventDefault();
    toggleTagFilter(tag);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!topSearchSuggestions.classList.contains("hidden")) {
        hideAllSearchSuggestions();
        return;
      }

      if (!settingsMenu.classList.contains("hidden")) {
        closeSettingsMenu();
        return;
      }

      if (!modal.classList.contains("hidden")) {
        closeModal();
        return;
      }

      if (sidebar.classList.contains("open")) {
        closeSidebar();
        return;
      }
    }

    if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const active = document.activeElement;
      const typing = active && (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable
      );

      if (!typing) {
        event.preventDefault();
        activeSearchSurface = "top";
        topSearch.focus();
      }
    }

    if (event.key.toLowerCase() === "f" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const active = document.activeElement;
      const typing = active && (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable
      );

      if (!typing) {
        toggleSidebar();
      }
    }

    if (event.key.toLowerCase() === "g" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const active = document.activeElement;
      const typing = active && (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable
      );

      if (!typing) {
        event.preventDefault();
        gallery.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey && !modal.classList.contains("hidden")) {
      event.preventDefault();
      showNextCard();
    }

    if (event.key.toLowerCase() === "p" && !event.metaKey && !event.ctrlKey && !event.altKey && !modal.classList.contains("hidden")) {
      event.preventDefault();
      showPreviousCard();
    }

    if (modal.classList.contains("hidden")) return;

    if (event.key === "ArrowLeft") showPreviousCard();
    if (event.key === "ArrowRight") showNextCard();
  });

  window.addEventListener("hashchange", () => {
    const key = getCardKeyFromHash();

    if (!key) {
      if (!modal.classList.contains("hidden")) closeModal(false);
      return;
    }

    openModalByKey(key, false);
  });

  window.addEventListener("popstate", () => {
    readUrlState(filters, displayState);
    filters.tags = reconcileSelectedTags(filters.tags, allCards);

    if (displayState.groupTag) {
      displayState.groupTag = reconcileSelectedTags(new Set([displayState.groupTag]), allCards).values().next().value || "";
    }

    applyStoredPreferencesToUI();
    buildGroupTagOptions(allCards);
    syncTagFilterUI();
    applyFilters({ updateUrl: false });
    tryOpenCardFromHash();
  });

  window.addEventListener("scroll", scheduleStackActiveUpdate, { passive: true });
  window.addEventListener("resize", scheduleStackActiveUpdate);
}

function syncSearchInputsFromTop() {
  const value = topSearch.value;
  sidebarSearch.value = value;
  filters.search = value.trim();
  activeSearchSurface = "top";
  applyFilters();
}

function syncSearchInputsFromSidebar() {
  const value = sidebarSearch.value;
  topSearch.value = value;
  filters.search = value.trim();
  activeSearchSurface = "sidebar";
  hideAllSearchSuggestions();
  applyFilters();
}

function getActiveSearchElements() {
  return activeSearchSurface === "sidebar"
    ? {
        input: sidebarSearch,
        ghost: sidebarSearchGhost,
        suggestions: null
      }
    : {
        input: topSearch,
        ghost: topSearchGhost,
        suggestions: topSearchSuggestions
      };
}

function clearInactiveAutocomplete() {
  if (activeSearchSurface === "sidebar") {
    topSearchGhost.value = "";
  } else {
    sidebarSearchGhost.value = "";
  }
}

function openSidebar() {
  sidebar.classList.remove("collapsed");
  sidebar.classList.add("open");
  sidebarBackdrop.classList.remove("hidden");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebar.classList.add("collapsed");
  sidebarBackdrop.classList.add("hidden");
  hideAllSearchSuggestions();
  sidebarContent.scrollTop = 0;
}

function toggleSidebar() {
  if (sidebar.classList.contains("open")) closeSidebar();
  else openSidebar();
}

function openSettingsMenu() {
  settingsMenu.classList.remove("hidden");
  settingsMenuToggle.setAttribute("aria-expanded", "true");
}

function closeSettingsMenu() {
  settingsMenu.classList.add("hidden");
  settingsMenuToggle.setAttribute("aria-expanded", "false");
  settingsMenu.scrollTop = 0;
}

function toggleSettingsMenu() {
  if (settingsMenu.classList.contains("hidden")) openSettingsMenu();
  else closeSettingsMenu();
}

function buildTagFilters(cards) {
  const allTags = [...new Set(cards.flatMap((card) => card.tags))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  const topTags = allTags.filter(isTopTag);
  const regularTags = allTags.filter((tag) => !isTopTag(tag));

  tagFilterList.innerHTML = "";

  for (const tag of topTags) {
    tagFilterList.appendChild(createTagFilterChip(tag));
  }

  if (topTags.length > 0 && regularTags.length > 0) {
    const divider = document.createElement("div");
    divider.className = "tag-filter-divider";
    divider.setAttribute("aria-hidden", "true");
    tagFilterList.appendChild(divider);
  }

  for (const tag of regularTags) {
    tagFilterList.appendChild(createTagFilterChip(tag));
  }

  syncTagFilterUI();
}

function createTagFilterChip(tag) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = getTagToneClass(tag, "tag-chip");
  button.textContent = getTagLabel(tag);
  button.dataset.tag = tag;

  button.addEventListener("click", () => {
    toggleTagFilter(tag);
  });

  return button;
}

function buildGroupTagOptions(cards) {
  const tags = [...new Set(cards.flatMap((card) => card.tags))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  groupTagSelect.innerHTML = `<option value="">Choose a tag...</option>`;

  for (const tag of tags) {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = getTagLabel(tag);
    groupTagSelect.appendChild(option);
  }

  if (displayState.groupTag && tags.includes(displayState.groupTag)) {
    groupTagSelect.value = displayState.groupTag;
  } else {
    displayState.groupTag = "";
    groupTagSelect.value = "";
    persistPreferences();
  }
}

function syncTagFilterUI() {
  const chips = [...tagFilterList.querySelectorAll(".tag-chip")];
  for (const chip of chips) {
    chip.classList.toggle("active", filters.tags.has(chip.dataset.tag));
  }
}

function toggleTagFilter(tag) {
  const currentKey = getCurrentModalCardKey();

  if (filters.tags.has(tag)) filters.tags.delete(tag);
  else filters.tags.add(tag);

  syncTagFilterUI();
  applyFilters();

  if (!modal.classList.contains("hidden") && currentKey) {
    const matchingIndex = filteredCards.findIndex((card) => card.key === currentKey);

    if (matchingIndex === -1) {
      closeModal(false);
      return;
    }

    currentModalIndex = matchingIndex;
    renderModal(filteredCards[currentModalIndex], false);
  }
}

function getCurrentModalCardKey() {
  const hashKey = getCardKeyFromHash();
  if (hashKey) return hashKey;

  if (currentModalIndex >= 0 && currentModalIndex < filteredCards.length) {
    return filteredCards[currentModalIndex].key;
  }

  return null;
}

function applyFilters({ updateUrl = true } = {}) {
  const parsedQuery = parseSearchQuery(filters.search);

  filteredCards = allCards.filter((card) => matchesFilters(card, parsedQuery, filters));
  sortCards(filteredCards);

  paginationState.currentPage = 1;
  paginationState.infiniteLoadedCount = paginationState.pageSize;

  renderActiveFilters(parsedQuery);
  renderGallery();
  renderSearchSuggestions();
  updateInlineAutocomplete();

  if (updateUrl) updateUrlFromState();
}

function renderGallery() {
  disconnectInfiniteScroll();
  gallery.innerHTML = "";

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

    cardsToShow.forEach((card, index) => {
      wrapper.appendChild(createCardElement(card, index));
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

      group.cards.forEach((card, index) => {
        inner.appendChild(createCardElement(card, index));
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

function getPageCards(totalCards) {
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
    pageMeta.textContent = `Page ${paginationState.currentPage} of ${totalPages}`;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "pagination-btn";
    nextBtn.setAttribute("aria-label", "Next page");
    nextBtn.textContent = "Next ›";
    nextBtn.disabled = paginationState.currentPage >= totalPages;
    nextBtn.addEventListener("click", goToNextPage);

    navRow.appendChild(prevBtn);
    navRow.appendChild(pageLabel);
    navRow.appendChild(pageMeta);
    navRow.appendChild(nextBtn);
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

  persistPreferences();
  renderGallery();
}

function goToPrevPage() {
  if (paginationState.currentPage <= 1) return;
  paginationState.currentPage--;
  renderGallery();
  scrollToGalleryTop();
}

function goToNextPage() {
  const totalPages = Math.ceil(filteredCards.length / paginationState.pageSize);
  if (paginationState.currentPage >= totalPages) return;
  paginationState.currentPage++;
  renderGallery();
  scrollToGalleryTop();
}

function scrollToGalleryTop() {
  const gallerySection = gallery.closest(".gallery-section");
  (gallerySection || gallery).scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupInfiniteScroll() {
  disconnectInfiniteScroll();

  const sentinel = document.createElement("div");
  sentinel.className = "infinite-scroll-sentinel";
  sentinel.setAttribute("aria-hidden", "true");
  gallery.appendChild(sentinel);

  infiniteScrollObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        loadMoreInfiniteCards();
      }
    },
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
  if (paginationState.infiniteLoadedCount >= filteredCards.length) return;

  const startIndex = paginationState.infiniteLoadedCount;
  const newCount = Math.min(startIndex + paginationState.pageSize, filteredCards.length);
  const newCards = filteredCards.slice(startIndex, newCount);
  paginationState.infiniteLoadedCount = newCount;

  if (displayState.groupBy === "none") {
    const wrapper = gallery.querySelector(".card-grid, .single-card-layout, .stack-card-layout");
    if (wrapper) {
      newCards.forEach((card, i) => wrapper.appendChild(createCardElement(card, startIndex + i)));
      scheduleStackActiveUpdate();
      renderPaginationControls(filteredCards.length);

      if (paginationState.infiniteLoadedCount < filteredCards.length) {
        setupInfiniteScroll();
      }
      return;
    }
  }

  renderGallery();
}

function getLayoutClassName() {
  if (displayState.viewMode === "single") return "single-card-layout";
  if (displayState.viewMode === "stack") return "stack-card-layout";
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

  for (const tag of card.tags.slice(0, 6)) {
    tagsContainer.appendChild(createTagChipElement(tag, "card-tag"));
  }

  footer.appendChild(nameRow);
  footer.appendChild(tagsContainer);

  article.appendChild(imageWrap);
  article.appendChild(footer);
  cardButton.appendChild(article);

  cardButton.addEventListener("click", () => openModalByKey(card.key, true));
  return cardButton;
}

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
    toggleTagFilter(tag);
  });

  return chip;
}

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

function renderActiveFilters(parsedQuery) {
  activeFilters.innerHTML = "";

  const pillData = [];

  if (filters.search) {
    pillData.push({ label: `Search: ${filters.search}`, removable: false });
  }

  for (const tag of filters.tags) {
    pillData.push({
      label: `Tag: ${getTagLabel(tag)}`,
      removable: true,
      tag
    });
  }

  for (const value of parsedQuery.tagTerms) pillData.push({ label: `tag:${value}`, removable: false });
  for (const value of parsedQuery.negTagTerms) pillData.push({ label: `-tag:${value}`, removable: false });
  for (const value of parsedQuery.nameTerms) pillData.push({ label: `name:${value}`, removable: false });
  for (const value of parsedQuery.negNameTerms) pillData.push({ label: `-name:${value}`, removable: false });

  if (parsedQuery.regexSource) {
    pillData.push({ label: `regex:${parsedQuery.regexSource}`, removable: false });
  }

  if (filters.fuzzy) {
    pillData.push({ label: "Fuzzy", removable: false });
  }

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

    activeFilters.appendChild(element);
  }
}

function renderSearchSuggestions() {
  topSearchSuggestions.innerHTML = "";
  sidebarSearchSuggestions.innerHTML = "";
  sidebarSearchSuggestions.classList.add("hidden");

  if (activeSearchSurface !== "top") {
    topSearchSuggestions.classList.add("hidden");
    return;
  }

  const query = filters.search.trim();
  const suggestions = buildSuggestions(query);

  suggestionIndex = -1;
  topSearchSuggestions.innerHTML = "";

  if (!query || suggestions.length === 0) {
    topSearchSuggestions.classList.add("hidden");
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-suggestion";
    button.setAttribute("role", "option");
    button.dataset.index = String(index);
    button.innerHTML = `
      <span class="search-suggestion-title">${escapeHtml(suggestion.title)}</span>
      <span class="search-suggestion-meta">${escapeHtml(suggestion.meta)}</span>
    `;

    button.addEventListener("click", () => {
      applySuggestion(suggestion);
    });

    topSearchSuggestions.appendChild(button);
  });

  topSearchSuggestions.classList.remove("hidden");
}

function buildSuggestions(query) {
  const queryLower = query.toLowerCase();
  const parsed = parseSearchQuery(query);
  const matches = allCards
    .filter((card) => matchesFilters(card, parsed, filters))
    .slice(0, 6);

  const suggestions = [];

  for (const card of matches) {
    suggestions.push({
      kind: "card",
      value: card.displayName,
      title: card.displayName,
      meta: `${card.type} · ${card.tags.slice(0, 3).map(getTagLabel).join(" · ")}`,
      cardKey: card.key
    });
  }

  const matchingTags = [...new Set(
    allCards.flatMap((card) => card.tags).filter((tag) => getTagLabel(tag).toLowerCase().includes(queryLower))
  )].slice(0, 4);

  for (const tag of matchingTags) {
    suggestions.push({
      kind: "tag",
      value: `tag:${tag}`,
      title: `tag:${getTagLabel(tag)}`,
      meta: "Filter by tag"
    });
  }

  return suggestions.slice(0, 8);
}

function getBestCardSuggestion() {
  const query = filters.search.trim();
  if (!query) return null;
  if (query.includes(":") || /^\/.*\/[gimsuy]*$/.test(query)) return null;

  const normalized = query.toLowerCase();
  const candidates = filteredCards
    .filter((card) => card.displayName.toLowerCase().includes(normalized))
    .sort((a, b) => {
      const aStarts = a.displayName.toLowerCase().startsWith(normalized) ? 0 : 1;
      const bStarts = b.displayName.toLowerCase().startsWith(normalized) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.displayName.length - b.displayName.length;
    });

  if (!candidates.length) return null;

  const card = candidates[0];
  return {
    kind: "card",
    value: card.displayName,
    title: card.displayName,
    meta: `${card.type} · ${card.tags.slice(0, 3).map(getTagLabel).join(" · ")}`,
    cardKey: card.key
  };
}

function updateInlineAutocomplete() {
  topSearchGhost.value = "";
  sidebarSearchGhost.value = "";

  if (!filters.inlineAutocomplete) return;

  const { input, ghost } = getActiveSearchElements();
  const query = input.value;

  if (!query.trim()) return;
  if (query.includes(":") || /^\/.*\/[gimsuy]*$/.test(query)) return;

  const bestCard = getBestCardSuggestion();
  if (!bestCard) return;

  const cardName = bestCard.title;
  if (!cardName.toLowerCase().startsWith(query.toLowerCase()) || cardName.length <= query.length) return;

  ghost.value = query + cardName.slice(query.length);
  clearInactiveAutocomplete();
}

function applySuggestion(suggestion) {
  topSearch.value = suggestion.value;
  sidebarSearch.value = suggestion.value;
  filters.search = suggestion.value.trim();
  hideAllSearchSuggestions();
  applyFilters();
  getActiveSearchElements().input.blur();
}

function hideAllSearchSuggestions() {
  topSearchSuggestions.classList.add("hidden");
  sidebarSearchSuggestions.classList.add("hidden");
  topSearchSuggestions.innerHTML = "";
  sidebarSearchSuggestions.innerHTML = "";
  topSearchGhost.value = "";
  suggestionIndex = -1;
}

function handleSearchKeydown(event) {
  activeSearchSurface = event.currentTarget === sidebarSearch ? "sidebar" : "top";

  const { input, ghost, suggestions } = getActiveSearchElements();
  const items = suggestions ? [...suggestions.querySelectorAll(".search-suggestion")] : [];
  const hasSuggestionsOpen = Boolean(
    suggestions &&
    !suggestions.classList.contains("hidden") &&
    items.length > 0
  );

  if (event.key === "Tab" && filters.inlineAutocomplete) {
    const query = input.value;

    if (ghost.value && ghost.value.length > query.length && ghost.value.toLowerCase().startsWith(query.toLowerCase())) {
      event.preventDefault();
      input.value = ghost.value;
      topSearch.value = ghost.value;
      sidebarSearch.value = ghost.value;
      filters.search = ghost.value.trim();
      applyFilters();
      return;
    }
  }

  if (event.key === "ArrowDown" && hasSuggestionsOpen) {
    event.preventDefault();
    suggestionIndex = Math.min(suggestionIndex + 1, items.length - 1);
    updateSuggestionHighlight(items);
    return;
  }

  if (event.key === "ArrowUp" && hasSuggestionsOpen) {
    event.preventDefault();
    suggestionIndex = Math.max(suggestionIndex - 1, 0);
    updateSuggestionHighlight(items);
    return;
  }

  if (event.key === "Enter") {
    if (hasSuggestionsOpen && suggestionIndex >= 0) {
      event.preventDefault();
      items[suggestionIndex].click();
      return;
    }

    const bestCard = getBestCardSuggestion();
    if (bestCard) {
      event.preventDefault();
      openModalByKey(bestCard.cardKey, true);
      hideAllSearchSuggestions();
      return;
    }
  }

  if (event.key === "Escape") {
    hideAllSearchSuggestions();
  }
}

function updateSuggestionHighlight(items) {
  items.forEach((item, index) => {
    item.classList.toggle("is-active", index === suggestionIndex);
  });
}

function openModalByKey(cardKey, updateHash = true) {
  let index = filteredCards.findIndex((card) => card.key === cardKey);

  if (index === -1) {
    const cardInAll = allCards.find((card) => card.key === cardKey);
    if (!cardInAll) return;

    if (!filteredCards.some((card) => card.key === cardKey)) {
      filteredCards = [...allCards];
      sortCards(filteredCards);
      paginationState.currentPage = 1;
      paginationState.infiniteLoadedCount = paginationState.pageSize;
      renderGallery();
    }

    index = filteredCards.findIndex((card) => card.key === cardKey);
    if (index === -1) return;
  }

  if (paginationState.mode === "paginated") {
    const targetPage = Math.floor(index / paginationState.pageSize) + 1;
    if (targetPage !== paginationState.currentPage) {
      paginationState.currentPage = targetPage;
      renderGallery();
    }
  } else if (paginationState.mode === "infinite" && index >= paginationState.infiniteLoadedCount) {
    paginationState.infiniteLoadedCount = index + 1;
    renderGallery();
  }

  currentModalIndex = index;
  renderModal(filteredCards[currentModalIndex], updateHash);
}

async function renderModal(card, updateHash = true) {
  modalImage.src = card.imagePath;
  modalImage.alt = card.displayName;
  modalName.textContent = card.displayName;
  modalType.textContent = card.type;
  modalSourceLink.href = card.imagePath;

  modalTagList.innerHTML = "";
  for (const tag of card.tags) {
    modalTagList.appendChild(createTagChipElement(tag, "modal-tag"));
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  updateModalNavButtons();

  if (updateHash) updateUrlForCard(card);
  preloadAdjacentImages();

  const cached = transcriptCache.get(card.key);
  if (typeof cached === "string") {
    renderTranscriptMarkdown(cached || "No transcript available.");
    return;
  }

  modalTranscript.innerHTML = "Loading transcript…";

  try {
    let response = await fetch(card.transcriptPathMd);
    if (!response.ok) response = await fetch(card.transcriptPathTxt);
    if (!response.ok) throw new Error("Transcript not found");

    const transcript = await response.text();
    transcriptCache.set(card.key, transcript.trim());
    renderTranscriptMarkdown(transcript.trim() || "No transcript available.");
  } catch {
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
  if (currentModalIndex <= 0) return;
  currentModalIndex -= 1;
  renderModal(filteredCards[currentModalIndex], true);
}

function showNextCard() {
  if (currentModalIndex >= filteredCards.length - 1) return;
  currentModalIndex += 1;
  renderModal(filteredCards[currentModalIndex], true);
}

function updateModalNavButtons() {
  modalPrevButton.disabled = currentModalIndex <= 0;
  modalNextButton.disabled = currentModalIndex >= filteredCards.length - 1;
}

function preloadAdjacentImages() {
  preloadCardImage(filteredCards[currentModalIndex - 1]);
  preloadCardImage(filteredCards[currentModalIndex + 1]);
}

function preloadCardImage(card) {
  if (!card || !card.imagePath) return;
  const img = new Image();
  img.src = card.imagePath;
}

function preloadPageImagesAndTranscripts(cards) {
  for (const card of cards) {
    preloadCardImage(card);

    if (!transcriptCache.has(card.key)) {
      transcriptCache.set(card.key, null); // null = fetch in progress; string = completed
      fetch(card.transcriptPathMd)
        .then((r) => {
          if (r.ok) return r.text();
          return fetch(card.transcriptPathTxt).then((r2) => (r2.ok ? r2.text() : ""));
        })
        .then((text) => {
          transcriptCache.set(card.key, text ? text.trim() : "");
        })
        .catch(() => {
          transcriptCache.set(card.key, "");
        });
    }
  }
}

function startPreloadingAfterThumbnails(cards) {
  const thumbImgs = [...gallery.querySelectorAll(".card-image")];

  if (thumbImgs.length === 0) {
    preloadPageImagesAndTranscripts(cards);
    return;
  }

  let remaining = thumbImgs.filter((img) => !img.complete).length;

  if (remaining === 0) {
    preloadPageImagesAndTranscripts(cards);
    return;
  }

  const onSettled = () => {
    remaining--;
    if (remaining <= 0) preloadPageImagesAndTranscripts(cards);
  };

  for (const img of thumbImgs) {
    if (!img.complete) {
      img.addEventListener("load", onSettled, { once: true });
      img.addEventListener("error", onSettled, { once: true });
    }
  }
}

function openRandomCard() {
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

function triggerChaosIcon() {
  if (!randomCardIcon) return;

  randomCardButton.classList.add("is-chaos");
  randomCardIcon.classList.remove("ms-planeswalker");
  randomCardIcon.classList.add("ms-chaos");

  window.clearTimeout(randomIconResetTimer);
  randomIconResetTimer = window.setTimeout(() => {
    randomCardButton.classList.remove("is-chaos");
    randomCardIcon.classList.remove("ms-chaos");
    randomCardIcon.classList.add("ms-planeswalker");
  }, 1200);
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function sampleTags(max = 3) {
  const allTags = [...new Set(allCards.flatMap((card) => card.tags))];
  const count = Math.floor(Math.random() * (max + 1));
  const selected = new Set();

  while (selected.size < count && allTags.length > 0) {
    selected.add(randomFrom(allTags));
  }

  return selected;
}

function triggerChaosMode() {
  if (!allCards.length) return;

  triggerChaosIcon();

  const randomTheme = randomFrom(THEME_PREFERENCES);
  const randomPalette = randomFrom(ALL_PALETTES);
  themeController.setTheme(randomTheme, {
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

  topSearch.value = filters.search;
  sidebarSearch.value = filters.search;
  topSearchGhost.value = "";
  sidebarSearchGhost.value = "";
  fuzzySearchToggle.checked = filters.fuzzy;
  inlineAutocompleteToggle.checked = filters.inlineAutocomplete;
  viewModeSelect.value = displayState.viewMode;
  groupBySelect.value = displayState.groupBy;
  groupTagPickerWrap.classList.toggle("hidden", displayState.groupBy !== "tag");
  buildGroupTagOptions(allCards);
  syncTagFilterUI();

  applyFilters();
  renderGallery();
  scheduleStackActiveUpdate();

  showToast("Chaos unleashed.");
}

async function copyCurrentCardLink() {
  if (currentModalIndex < 0 || currentModalIndex >= filteredCards.length) return;

  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Link copied.");
  } catch {
    showToast("Copy failed.");
  }
}

function clearSavedPreferences() {
  localStorage.removeItem(STORAGE_KEY);

  filters.search = "";
  filters.tags.clear();
  filters.fuzzy = false;
  filters.inlineAutocomplete = true;

  displayState.viewMode = "grid";
  displayState.groupBy = "none";
  displayState.groupTag = "";

  paginationState.currentPage = 1;
  paginationState.pageSize = 20;
  paginationState.mode = "paginated";
  paginationState.infiniteLoadedCount = 20;

  themeController.setTheme("system", {
    silent: true,
    paletteOverride: "standard"
  });

  topSearch.value = "";
  sidebarSearch.value = "";
  topSearchGhost.value = "";
  sidebarSearchGhost.value = "";

  applyStoredPreferencesToUI();
  buildGroupTagOptions(allCards);
  syncTagFilterUI();
  hideAllSearchSuggestions();
  applyFilters();
  closeSettingsMenu();

  showToast("Preferences cleared.");
}

function clearAllFilters() {
  filters.search = "";
  filters.tags.clear();

  topSearch.value = "";
  sidebarSearch.value = "";
  topSearchGhost.value = "";
  sidebarSearchGhost.value = "";

  syncTagFilterUI();
  hideAllSearchSuggestions();
  applyFilters();
  tryOpenCardFromHash();
}

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

function renderTranscriptMarkdown(markdownText) {
  const rawHtml = marked.parse(markdownText, { breaks: true });
  const safeHtml = DOMPurify.sanitize(rawHtml);
  modalTranscript.innerHTML = enhanceManaSymbols(safeHtml);
}

function enhanceManaSymbols(html) {
  return html.replace(/\{([^}]+)\}/g, (_, rawSymbol) => {
    const symbol = rawSymbol.trim().toLowerCase();
    const classes = getManaClasses(symbol);

    if (!classes) return `{${escapeHtml(rawSymbol)}}`;

    return `<i class="${classes}" aria-label="${escapeHtml(rawSymbol.toUpperCase())}" title="${escapeHtml(rawSymbol.toUpperCase())}"></i>`;
  });
}

function getManaClasses(symbol) {
  const raw = symbol.replace(/\s+/g, "");

  const aliases = {
    t: "tap",
    q: "untap",
    planeswalk: "planeswalker"
  };

  const normalized = aliases[raw] || raw;

  const direct = new Set([
    "w", "u", "b", "r", "g", "c",
    "x", "y", "z",
    "tap", "untap",
    "chaos",
    "planeswalker"
  ]);

  if (direct.has(normalized)) {
    return normalized === "tap" || normalized === "untap" || normalized === "planeswalker"
      ? `ms ms-${normalized}`
      : `ms ms-${normalized} ms-cost`;
  }

  if (/^(0|[1-9]|10|11|12|13|14|15|16|17|18|19|20|100|1000000|infinity|1\/2)$/.test(normalized)) {
    const converted = normalized === "1/2" ? "1-2" : normalized;
    return `ms ms-${converted} ms-cost`;
  }

  if (/^[wubrgc]\/[wubrgc]$/.test(normalized)) {
    return `ms ms-${normalized.replace("/", "")} ms-cost`;
  }

  if (/^2\/[wubrg]$/.test(normalized)) {
    return `ms ms-${normalized.replace("/", "")} ms-cost`;
  }

  if (/^[wubrg]\/p$/.test(normalized)) {
    return `ms ms-${normalized.replace("/", "")} ms-cost`;
  }

  return null;
}

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}