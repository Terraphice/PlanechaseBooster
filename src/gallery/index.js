// ── gallery-index.js ──────────────────────────────────────────────────────────
// Application entry point: fetches card data, enriches cards, wires all DOM
// events, and delegates to all other gallery and game modules.

import {
  enrichCard,
  sortCards,
  reconcileSelectedTags,
  matchesFilters,
  parseSearchQuery,
  getTagLabel,
  getTagToneClass,
  isTopTag
} from "./utils.js";

import {
  initToastManager,
  initThemeController
} from "./ui.js";

import {
  initDeck,
  getCardDeckCount,
  addCardToDeck,
  removeCardFromDeck,
  isDeckPanelOpen,
  closeDeckPanel,
  setModalCardKey,
  isGameActive,
  syncGameHash,
  showGameModeDialog,
  clearAllDecks,
  clearTutorialFlags,
  importProfileDecks,
  encodeProfileData,
  decodeProfileData,
  setPhenomenonAnimation,
  closeTopGameOverlay,
  setHellridingMode,
  setSmoothTravel,
  setBemEdgePlaceholders
} from "../deck/index.js";

import {
  STORAGE_KEY,
  filters,
  displayState,
  paginationState,
  preferences,
  initStateManager
} from "./state.js";

import { createRenderer } from "./render.js";
import { createSearchManager } from "./search.js";
import { createModalManager } from "./modal.js";
import { initChangelog } from "../changelog.js";

let allCards = [];
let filteredCards = [];
const transcriptCache = new Map();

// ── DOM references ────────────────────────────────────────────────────────────

const resultsCount = document.getElementById("results-count");
const activeFiltersEl = document.getElementById("active-filters");
const tagFilterList = document.getElementById("tag-filter-list");

const topSearch = document.getElementById("top-search");
const topSearchGhost = document.getElementById("top-search-ghost");
const topSearchSuggestions = document.getElementById("top-search-suggestions");

const sidebarSearch = document.getElementById("sidebar-search");
const sidebarSearchGhost = document.getElementById("sidebar-search-ghost");
const sidebarSearchSuggestions = document.getElementById("sidebar-search-suggestions");

const fuzzySearchToggle = document.getElementById("fuzzy-search-toggle");
const showHiddenToggle = document.getElementById("show-hidden-toggle");
const inlineAutocompleteToggle = document.getElementById("inline-autocomplete-toggle");
const phenomenonAnimationToggle = document.getElementById("phenomenon-animation-toggle");
const hellridingModeSelect = document.getElementById("hellriding-mode-select");
const smoothTravelToggle = document.getElementById("smooth-travel-toggle");
const bemEdgePlaceholdersToggle = document.getElementById("bem-edge-placeholders-toggle");

const sidebar = document.getElementById("sidebar");
const sidebarContent = document.getElementById("sidebar-content");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarLip = document.getElementById("sidebar-lip");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const randomCardButton = document.getElementById("random-card-button");
const playGameButton = document.getElementById("play-game-button");
const mainPanel = document.querySelector(".main-panel");
const topbarCopy = document.querySelector(".topbar .topbar-copy");

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
const settingsExportProfileButton = document.getElementById("settings-export-profile");
const settingsImportProfileButton = document.getElementById("settings-import-profile");
const themeToggleButton = document.getElementById("theme-toggle");

const confirmDialog = document.getElementById("confirm-dialog");
const confirmOkButton = document.getElementById("confirm-ok");
const confirmCancelButton = document.getElementById("confirm-cancel");

const modal = document.getElementById("card-modal");
const modalImageWrap = document.getElementById("modal-image-wrap");
const modalImage = document.getElementById("modal-image");
const modalFlipHint = document.getElementById("modal-flip-hint");
const modalName = document.getElementById("modal-card-name");
const modalType = document.getElementById("modal-card-type");
const modalTranscript = document.getElementById("modal-transcript");
const modalSourceLink = document.getElementById("modal-source-link");
const modalScryfallLink = document.getElementById("modal-scryfall-link");
const modalCloseButton = document.getElementById("modal-close");
const modalPrevButton = document.getElementById("modal-prev");
const modalNextButton = document.getElementById("modal-next");
const modalTagList = document.getElementById("modal-tag-list");
const modalCopyLinkButton = document.getElementById("modal-copy-link");
const gallery = document.getElementById("gallery");
const toastRegion = document.getElementById("toast-region");
const paginationControls = document.getElementById("pagination-controls");

// ── Toast and theme ───────────────────────────────────────────────────────────

const showToast = initToastManager(toastRegion);
const themeController = initThemeController({
  button: themeToggleButton,
  initialTheme: preferences.theme,
  initialPalette: preferences.themePalette,
  onChange(theme, palette) {
    stateManager.persistPreferences();
    const paletteLabel = palette === "standard" ? "" : ` ${capitalize(palette)}`;
    showToast(`Theme set to ${theme}${paletteLabel}.`);
  }
});

// ── State manager ─────────────────────────────────────────────────────────────

const stateManager = initStateManager({
  themeController,
  topSearch,
  sidebarSearch,
  topSearchGhost,
  sidebarSearchGhost,
  fuzzySearchToggle,
  showHiddenToggle,
  inlineAutocompleteToggle,
  phenomenonAnimationToggle,
  hellridingModeSelect,
  smoothTravelToggle,
  bemEdgePlaceholdersToggle,
  viewModeSelect,
  groupBySelect,
  groupTagPickerWrap
});

// ── Search surface state ──────────────────────────────────────────────────────

let activeSearchSurface = "top";
let suggestionIndex = -1;

// ── Renderer ──────────────────────────────────────────────────────────────────

const renderer = createRenderer({
  gallery,
  paginationControls,
  resultsCount,
  filters,
  displayState,
  paginationState,
  getFilteredCards: () => filteredCards,
  getTranscriptCache: () => transcriptCache,
  callbacks: {
    toggleTagFilter,
    openModalByKey: (key, updateHash) => modalManager.openModalByKey(key, updateHash),
    addCardToDeck,
    removeCardFromDeck,
    getCardDeckCount,
    isDeckPanelOpen,
    persistPreferences: () => stateManager.persistPreferences(),
    updateUrlFromState: (opts) => stateManager.updateUrlFromState(opts)
  }
});

const {
  renderGallery,
  renderActiveFilters,
  createTagChipElement,
  scheduleStackActiveUpdate,
  preloadCardImage,
} = renderer;

// ── Search manager ────────────────────────────────────────────────────────────

const searchManager = createSearchManager({
  topSearch,
  topSearchGhost,
  topSearchSuggestions,
  sidebarSearch,
  sidebarSearchGhost,
  sidebarSearchSuggestions,
  filters,
  getFilteredCards: () => filteredCards,
  getAllCards: () => allCards,
  getActiveSearchSurface: () => activeSearchSurface,
  setActiveSearchSurface: (s) => { activeSearchSurface = s; },
  getSuggestionIndex: () => suggestionIndex,
  setSuggestionIndex: (i) => { suggestionIndex = i; },
  callbacks: {
    applyFilters,
    openModalByKey: (key, updateHash) => modalManager.openModalByKey(key, updateHash),
    getTranscriptCache: () => transcriptCache
  }
});

const {
  renderSearchSuggestions,
  updateInlineAutocomplete,
  hideAllSearchSuggestions,
  handleSearchKeydown,
  syncSearchInputsFromTop,
  syncSearchInputsFromSidebar
} = searchManager;

// ── Modal manager ─────────────────────────────────────────────────────────────

const modalManager = createModalManager({
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
  filters,
  displayState,
  paginationState,
  getFilteredCards: () => filteredCards,
  getAllCards: () => allCards,
  getTranscriptCache: () => transcriptCache,
  callbacks: {
    setModalCardKey,
    createTagChipElement,
    renderGallery,
    sortCards,
    setFilteredCards: (cards) => { filteredCards = cards; },
    preloadCardImage,
    persistPreferences: () => stateManager.persistPreferences(),
    updateUrlFromState: (opts) => stateManager.updateUrlFromState(opts),
    themeController,
    syncChaosUI(chaosFilters, chaosDisplay) {
      topSearch.value = chaosFilters.search;
      sidebarSearch.value = chaosFilters.search;
      topSearchGhost.value = "";
      sidebarSearchGhost.value = "";
      fuzzySearchToggle.checked = chaosFilters.fuzzy;
      inlineAutocompleteToggle.checked = chaosFilters.inlineAutocomplete;
      viewModeSelect.value = chaosDisplay.viewMode;
      groupBySelect.value = chaosDisplay.groupBy;
      groupTagPickerWrap.classList.toggle("hidden", chaosDisplay.groupBy !== "tag");
      buildGroupTagOptions(allCards);
      syncTagFilterUI();
    },
    applyFilters,
    showToast,
    scheduleStackActiveUpdate
  }
});

const {
  openModalByKey,
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
  tryOpenCardFromHash,
  getCardKeyFromHash
} = modalManager;

// ── Init ──────────────────────────────────────────────────────────────────────

init();

async function init() {
  try {
    stateManager.readState();
    stateManager.applyStoredPreferencesToUI();

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
    applyFilters({ updateUrl: false, preservePage: true });
    tryOpenCardFromHash();

    initDeck({
      cards: allCards,
      showToast,
      onDeckChange: () => {
        const panelOpen = isDeckPanelOpen();
        gallery.classList.toggle("deck-mode", panelOpen);
        mainPanel?.classList.toggle("deck-panel-offset", panelOpen);
      }
    });
    setPhenomenonAnimation(filters.phenomenonAnimation);
    setHellridingMode(filters.hellridingMode);
    setSmoothTravel(filters.smoothTravel);
    setBemEdgePlaceholders(filters.bemEdgePlaceholders);

    initChangelog();

    prefetchAllTranscripts(allCards);
  } catch (error) {
    console.error(error);
    gallery.innerHTML = `<p class="empty-state">Could not load gallery data.</p>`;
    resultsCount.textContent = "";
  }
}

function prefetchAllTranscripts(cards) {
  const CONCURRENCY = 6;
  let index = 0;

  function next() {
    if (index >= cards.length) return;
    const card = cards[index++];

    if (transcriptCache.has(card.id)) { next(); return; }

    transcriptCache.set(card.id, null);
    fetch(card.transcriptPath)
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => {
        transcriptCache.set(card.id, text ? text.trim() : "");
        next();
      })
      .catch(() => {
        transcriptCache.set(card.id, "");
        next();
      });
  }

  for (let i = 0; i < CONCURRENCY; i++) next();
}

// ── Filters / state ───────────────────────────────────────────────────────────

function applyFilters({ updateUrl = true, preservePage = false } = {}) {
  const parsedQuery = parseSearchQuery(filters.search);

  filteredCards = allCards.filter((card) => matchesFilters(card, parsedQuery, filters, transcriptCache));
  sortCards(filteredCards);

  if (!preservePage) {
    paginationState.currentPage = 1;
    paginationState.infiniteLoadedCount = paginationState.pageSize;
  } else {
    const totalPages = Math.max(1, Math.ceil(filteredCards.length / paginationState.pageSize));
    paginationState.currentPage = Math.min(paginationState.currentPage, totalPages);
    paginationState.infiniteLoadedCount = paginationState.pageSize;
  }

  renderActiveFilters(parsedQuery, activeFiltersEl);
  renderGallery();
  renderSearchSuggestions();
  updateInlineAutocomplete();

  if (updateUrl) stateManager.updateUrlFromState();
}

// ── Tag filters ───────────────────────────────────────────────────────────────

function buildTagFilters(cards) {
  const allTags = [...new Set(cards.flatMap((card) => card.tags))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  const topTags = allTags.filter(isTopTag);
  const regularTags = allTags.filter((tag) => !isTopTag(tag) && tag.toLowerCase() !== "hidden");

  tagFilterList.innerHTML = "";

  for (const tag of topTags) tagFilterList.appendChild(createTagFilterChip(tag));

  if (topTags.length > 0 && regularTags.length > 0) {
    const divider = document.createElement("div");
    divider.className = "tag-filter-divider";
    divider.setAttribute("aria-hidden", "true");
    tagFilterList.appendChild(divider);
  }

  for (const tag of regularTags) tagFilterList.appendChild(createTagFilterChip(tag));

  syncTagFilterUI();
}

function createTagFilterChip(tag) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = getTagToneClass(tag, "tag-chip");
  button.textContent = getTagLabel(tag);
  button.dataset.tag = tag;
  button.addEventListener("click", () => toggleTagFilter(tag));
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
    stateManager.persistPreferences();
  }
}

function syncTagFilterUI() {
  const chips = [...tagFilterList.querySelectorAll(".tag-chip")];
  for (const chip of chips) {
    chip.classList.toggle("active", filters.tags.has(chip.dataset.tag));
  }
}

function toggleTagFilter(tag) {
  const currentKey = getCardKeyFromHash();

  if (filters.tags.has(tag)) filters.tags.delete(tag);
  else filters.tags.add(tag);

  syncTagFilterUI();
  applyFilters();

  if (!modal.classList.contains("hidden") && currentKey) {
    const matchingIndex = filteredCards.findIndex((card) => card.id === currentKey);
    if (matchingIndex === -1) { closeModal(false); return; }
    modalManager.renderModal(filteredCards[matchingIndex], false);
  }
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

// ── Sidebar ───────────────────────────────────────────────────────────────────

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

// ── Settings menu ─────────────────────────────────────────────────────────────

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

// ── Confirm dialog ────────────────────────────────────────────────────────────

function showClearPrefsConfirm() {
  closeSettingsMenu();
  confirmDialog?.classList.remove("hidden");
  document.body.classList.add("confirm-open");
}

function hideClearPrefsConfirm() {
  confirmDialog?.classList.add("hidden");
  document.body.classList.remove("confirm-open");
}

function executeClearAll() {
  hideClearPrefsConfirm();

  localStorage.removeItem(STORAGE_KEY);
  clearAllDecks();
  clearTutorialFlags();

  filters.search = "";
  filters.tags.clear();
  filters.fuzzy = false;
  filters.inlineAutocomplete = true;
  filters.showHidden = false;
  filters.hellridingMode = "risky";
  setHellridingMode("risky");
  filters.smoothTravel = true;
  setSmoothTravel(true);
  filters.bemEdgePlaceholders = false;
  setBemEdgePlaceholders(false);

  displayState.viewMode = "grid";
  displayState.groupBy = "none";
  displayState.groupTag = "";

  paginationState.currentPage = 1;
  paginationState.pageSize = 20;
  paginationState.mode = "paginated";
  paginationState.infiniteLoadedCount = 20;

  themeController.setTheme("system", { silent: true, paletteOverride: "standard" });

  topSearch.value = "";
  sidebarSearch.value = "";
  topSearchGhost.value = "";
  sidebarSearchGhost.value = "";

  stateManager.applyStoredPreferencesToUI();
  buildGroupTagOptions(allCards);
  syncTagFilterUI();
  hideAllSearchSuggestions();
  applyFilters();

  showToast("All preferences and decks cleared.");
}

// ── Profile import/export ─────────────────────────────────────────────────────

function exportProfile() {
  const prefsObj = {
    viewMode: displayState.viewMode,
    groupBy: displayState.groupBy,
    groupTag: displayState.groupTag,
    fuzzySearch: filters.fuzzy,
    inlineAutocomplete: filters.inlineAutocomplete,
    showHidden: filters.showHidden,
    theme: themeController.getTheme(),
    themePalette: themeController.getPalette(),
    pageSize: paginationState.pageSize,
    paginationMode: paginationState.mode,
    phenomenonAnimation: filters.phenomenonAnimation,
    hellridingMode: filters.hellridingMode,
    smoothTravel: filters.smoothTravel,
    bemEdgePlaceholders: filters.bemEdgePlaceholders
  };

  const seed = encodeProfileData(prefsObj);
  if (!seed) { showToast("Export failed."); return; }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(seed)
      .then(() => showToast("Profile seed copied to clipboard."))
      .catch(() => prompt("Copy your profile seed:", seed));
  } else {
    prompt("Copy your profile seed:", seed);
  }
  closeSettingsMenu();
}

function importProfile() {
  const seed = prompt("Paste a profile seed to import:");
  if (!seed?.trim()) return;

  const data = decodeProfileData(seed.trim());
  if (!data || data.v !== 1) { showToast("Invalid profile seed."); return; }

  if (data.p) {
    const p = data.p;
    if (["grid", "single", "stack", "list"].includes(p.viewMode)) displayState.viewMode = p.viewMode;
    if (["none", "tag"].includes(p.groupBy)) displayState.groupBy = p.groupBy;
    if (typeof p.groupTag === "string") displayState.groupTag = p.groupTag;
    if (typeof p.fuzzySearch === "boolean") filters.fuzzy = p.fuzzySearch;
    if (typeof p.inlineAutocomplete === "boolean") filters.inlineAutocomplete = p.inlineAutocomplete;
    if (typeof p.showHidden === "boolean") filters.showHidden = p.showHidden;
    if (typeof p.phenomenonAnimation === "boolean") {
      filters.phenomenonAnimation = p.phenomenonAnimation;
      setPhenomenonAnimation(filters.phenomenonAnimation);
    }
    if (["safe", "normal", "risky", "extreme"].includes(p.hellridingMode)) {
      filters.hellridingMode = p.hellridingMode;
      setHellridingMode(filters.hellridingMode);
    }
    if (typeof p.smoothTravel === "boolean") {
      filters.smoothTravel = p.smoothTravel;
      setSmoothTravel(filters.smoothTravel);
    }
    if (typeof p.bemEdgePlaceholders === "boolean") {
      filters.bemEdgePlaceholders = p.bemEdgePlaceholders;
      setBemEdgePlaceholders(filters.bemEdgePlaceholders);
    }
    if ([10, 20, 50, 100].includes(p.pageSize)) paginationState.pageSize = p.pageSize;
    if (["paginated", "infinite"].includes(p.paginationMode)) paginationState.mode = p.paginationMode;

    const validThemes = ["system", "dark", "light"];
    const validPalettes = ["standard", "gruvbox", "atom", "dracula", "solarized", "nord", "catppuccin", "scryfall"];
    const newTheme = validThemes.includes(p.theme) ? p.theme : "system";
    const newPalette = validPalettes.includes(p.themePalette) ? p.themePalette : "standard";
    themeController.setTheme(newTheme, { silent: true, paletteOverride: newPalette });
  }

  if (data.d) importProfileDecks(data.d);

  stateManager.persistPreferences();
  stateManager.applyStoredPreferencesToUI();
  buildGroupTagOptions(allCards);
  syncTagFilterUI();
  applyFilters();
  closeSettingsMenu();

  showToast("Profile imported.");
}

// ── Utility ───────────────────────────────────────────────────────────────────

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

// ── Events ────────────────────────────────────────────────────────────────────

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

    if (!insideTopSearch && !insideSidebarSearch) hideAllSearchSuggestions();
    if (!insideSettings) closeSettingsMenu();
  });

  topbarCopy?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  fuzzySearchToggle.addEventListener("change", () => {
    filters.fuzzy = fuzzySearchToggle.checked;
    stateManager.persistPreferences();
    applyFilters();
  });

  showHiddenToggle.addEventListener("change", () => {
    filters.showHidden = showHiddenToggle.checked;
    stateManager.persistPreferences();
    applyFilters();
  });

  inlineAutocompleteToggle.addEventListener("change", () => {
    filters.inlineAutocomplete = inlineAutocompleteToggle.checked;
    stateManager.persistPreferences();
    updateInlineAutocomplete();
    applyFilters();
  });

  phenomenonAnimationToggle?.addEventListener("change", () => {
    filters.phenomenonAnimation = phenomenonAnimationToggle.checked;
    setPhenomenonAnimation(filters.phenomenonAnimation);
    stateManager.persistPreferences();
  });

  hellridingModeSelect?.addEventListener("change", () => {
    filters.hellridingMode = hellridingModeSelect.value;
    setHellridingMode(filters.hellridingMode);
    stateManager.persistPreferences();
  });

  smoothTravelToggle?.addEventListener("change", () => {
    filters.smoothTravel = smoothTravelToggle.checked;
    setSmoothTravel(filters.smoothTravel);
    stateManager.persistPreferences();
  });

  bemEdgePlaceholdersToggle?.addEventListener("change", () => {
    filters.bemEdgePlaceholders = bemEdgePlaceholdersToggle.checked;
    setBemEdgePlaceholders(filters.bemEdgePlaceholders);
    stateManager.persistPreferences();
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
    stateManager.persistPreferences();
    renderGallery();
    scheduleStackActiveUpdate();
    stateManager.updateUrlFromState();
  });

  groupBySelect.addEventListener("change", () => {
    displayState.groupBy = groupBySelect.value;
    groupTagPickerWrap.classList.toggle("hidden", displayState.groupBy !== "tag");
    stateManager.persistPreferences();
    paginationState.currentPage = 1;
    paginationState.infiniteLoadedCount = paginationState.pageSize;
    renderGallery();
    scheduleStackActiveUpdate();
    stateManager.updateUrlFromState();
  });

  groupTagSelect.addEventListener("change", () => {
    displayState.groupTag = groupTagSelect.value;
    stateManager.persistPreferences();
    paginationState.currentPage = 1;
    paginationState.infiniteLoadedCount = paginationState.pageSize;
    renderGallery();
    scheduleStackActiveUpdate();
    stateManager.updateUrlFromState();
  });

  sidebarToggle.addEventListener("click", closeSidebar);
  sidebarLip.addEventListener("click", toggleSidebar);
  sidebarBackdrop.addEventListener("click", closeSidebar);

  settingsMenuToggle.addEventListener("click", toggleSettingsMenu);
  settingsClearPreferencesButton.addEventListener("click", showClearPrefsConfirm);
  settingsContactDeveloperLink.addEventListener("click", closeSettingsMenu);
  settingsExportProfileButton?.addEventListener("click", exportProfile);
  settingsImportProfileButton?.addEventListener("click", importProfile);
  confirmOkButton?.addEventListener("click", executeClearAll);
  confirmCancelButton?.addEventListener("click", hideClearPrefsConfirm);
  confirmDialog?.addEventListener("click", (event) => {
    if (event.target === confirmDialog) hideClearPrefsConfirm();
  });

  randomCardButton.addEventListener("click", (event) => {
    if (getSuppressRandomClick()) {
      clearSuppressRandomClick();
      event.preventDefault();
      return;
    }
    if (event.altKey) {
      event.preventDefault();
      modalManager.triggerChaosMode();
      return;
    }
    openRandomCard();
  });

  randomCardButton.addEventListener("pointerdown", handleRandomPointerDown);
  randomCardButton.addEventListener("pointerup", clearRandomLongPress);
  randomCardButton.addEventListener("pointercancel", clearRandomLongPress);
  randomCardButton.addEventListener("pointerleave", clearRandomLongPress);

  playGameButton?.addEventListener("click", () => { showGameModeDialog(); });

  modal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
      closeModal();
    }
  });

  modalCloseButton.addEventListener("click", closeModal);
  modalPrevButton.addEventListener("click", showPreviousCard);
  modalNextButton.addEventListener("click", showNextCard);
  modalCopyLinkButton.addEventListener("click", copyCurrentCardLink);

  modalImageWrap?.addEventListener("click", flipModalImage);

  modalTagList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const tag = target.dataset.tag;
    if (!tag) return;
    event.preventDefault();
    event.stopPropagation();
    toggleTagFilter(tag);
  });

  activeFiltersEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const tag = target.dataset.tag;
    if (!tag) return;
    event.preventDefault();
    toggleTagFilter(tag);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (confirmDialog && !confirmDialog.classList.contains("hidden")) {
        hideClearPrefsConfirm();
        return;
      }

      if (isGameActive()) {
        if (closeTopGameOverlay()) return;
        return;
      }

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

      if (isDeckPanelOpen()) {
        closeDeckPanel();
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
      if (!typing) toggleSidebar();
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
    if (window.location.hash === "#play" || (!window.location.hash && isGameActive())) {
      syncGameHash();
      return;
    }

    const key = getCardKeyFromHash();

    if (!key) {
      if (!modal.classList.contains("hidden")) closeModal(false);
      return;
    }

    openModalByKey(key, false);
  });

  window.addEventListener("popstate", () => {
    syncGameHash();

    stateManager.readState();
    filters.tags = reconcileSelectedTags(filters.tags, allCards);

    if (displayState.groupTag) {
      displayState.groupTag = reconcileSelectedTags(new Set([displayState.groupTag]), allCards).values().next().value || "";
    }

    stateManager.applyStoredPreferencesToUI();
    buildGroupTagOptions(allCards);
    syncTagFilterUI();
    applyFilters({ updateUrl: false, preservePage: true });
    tryOpenCardFromHash();
  });

  window.addEventListener("scroll", scheduleStackActiveUpdate, { passive: true });
  window.addEventListener("resize", scheduleStackActiveUpdate);
}
