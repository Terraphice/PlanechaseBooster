import { loadPreferences, savePreferences, readUrlState, writeUrlState } from "./utils.js";

export const STORAGE_KEY = "planechaseGalleryPreferences.v2";

export const preferences = loadPreferences(STORAGE_KEY);

export const filters = {
  search: "",
  tags: new Set(),
  fuzzy: preferences.fuzzySearch,
  inlineAutocomplete: preferences.inlineAutocomplete,
  showHidden: preferences.showHidden,
  phenomenonAnimation: preferences.phenomenonAnimation,
  riskyHellriding: preferences.riskyHellriding,
  smoothTravel: preferences.smoothTravel,
  bemEdgePlaceholders: preferences.bemEdgePlaceholders
};

export const displayState = {
  viewMode: preferences.viewMode,
  groupBy: preferences.groupBy,
  groupTag: preferences.groupTag
};

export const paginationState = {
  currentPage: 1,
  pageSize: preferences.pageSize,
  mode: preferences.paginationMode,
  infiniteLoadedCount: preferences.pageSize
};

export function initStateManager({ themeController, topSearch, sidebarSearch, topSearchGhost, sidebarSearchGhost, fuzzySearchToggle, showHiddenToggle, inlineAutocompleteToggle, phenomenonAnimationToggle, riskyHellridingToggle, smoothTravelToggle, bemEdgePlaceholdersToggle, viewModeSelect, groupBySelect, groupTagPickerWrap }) {
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
    writeUrlState(filters, displayState, { ...options, paginationState });
  }

  function readState() {
    readUrlState(filters, displayState, paginationState);
  }

  function applyStoredPreferencesToUI() {
    viewModeSelect.value = displayState.viewMode;
    groupBySelect.value = displayState.groupBy;
    fuzzySearchToggle.checked = filters.fuzzy;
    showHiddenToggle.checked = filters.showHidden;
    inlineAutocompleteToggle.checked = filters.inlineAutocomplete;
    if (phenomenonAnimationToggle) phenomenonAnimationToggle.checked = filters.phenomenonAnimation;
    if (riskyHellridingToggle) riskyHellridingToggle.checked = filters.riskyHellriding;
    if (smoothTravelToggle) smoothTravelToggle.checked = filters.smoothTravel;
    if (bemEdgePlaceholdersToggle) bemEdgePlaceholdersToggle.checked = filters.bemEdgePlaceholders;
    topSearch.value = filters.search;
    sidebarSearch.value = filters.search;
    topSearchGhost.value = "";
    sidebarSearchGhost.value = "";
    groupTagPickerWrap.classList.toggle("hidden", displayState.groupBy !== "tag");
  }

  return { persistPreferences, updateUrlFromState, readState, applyStoredPreferencesToUI };
}
