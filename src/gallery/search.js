// ── gallery-search.js ─────────────────────────────────────────────────────────
// Search input management: suggestion list, keyboard navigation, and ghost-text
// inline autocomplete for both the top bar and sidebar search surfaces.

import { getTagLabel, matchesFilters, parseSearchQuery, escapeHtml } from "./utils.js";

export function createSearchManager({
  topSearch,
  topSearchGhost,
  topSearchSuggestions,
  sidebarSearch,
  sidebarSearchGhost,
  sidebarSearchSuggestions,
  filters,
  getFilteredCards,
  getAllCards,
  getActiveSearchSurface,
  setActiveSearchSurface,
  getSuggestionIndex,
  setSuggestionIndex,
  callbacks
}) {
  // ── Internal helpers ──────────────────────────────────────────────────────────

  function getActiveSearchElements() {
    return getActiveSearchSurface() === "sidebar"
      ? { input: sidebarSearch, ghost: sidebarSearchGhost, suggestions: null }
      : { input: topSearch, ghost: topSearchGhost, suggestions: topSearchSuggestions };
  }

  function clearInactiveAutocomplete() {
    if (getActiveSearchSurface() === "sidebar") {
      topSearchGhost.value = "";
    } else {
      sidebarSearchGhost.value = "";
    }
  }

  // ── Suggestions ───────────────────────────────────────────────────────────────

  function buildSuggestions(query) {
    const queryLower = query.toLowerCase();
    const parsed = parseSearchQuery(query);
    const allCards = getAllCards();
    const transcriptCache = callbacks.getTranscriptCache();

    const suggestions = [];

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

    const matches = allCards
      .filter((card) => matchesFilters(card, parsed, filters, transcriptCache))
      .slice(0, 6);

    for (const card of matches) {
      suggestions.push({
        kind: "card",
        value: card.displayName,
        title: card.displayName,
        meta: `${card.type} · ${card.tags.slice(0, 3).map(getTagLabel).join(" · ")}`,
        cardKey: card.id
      });
    }

    return suggestions.slice(0, 8);
  }

  function getBestCardSuggestion() {
    const query = filters.search.trim();
    if (!query) return null;
    if (query.includes(":") || /^\/.*\/[gimsuy]*$/.test(query)) return null;

    const normalized = query.toLowerCase();
    const filteredCards = getFilteredCards();
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
      cardKey: card.id
    };
  }

  function renderSearchSuggestions() {
    topSearchSuggestions.innerHTML = "";
    sidebarSearchSuggestions.innerHTML = "";
    sidebarSearchSuggestions.classList.add("hidden");

    if (getActiveSearchSurface() !== "top") {
      topSearchSuggestions.classList.add("hidden");
      return;
    }

    const query = filters.search.trim();
    const suggestions = buildSuggestions(query);

    setSuggestionIndex(-1);
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
    callbacks.applyFilters();
    getActiveSearchElements().input.blur();
  }

  function hideAllSearchSuggestions() {
    topSearchSuggestions.classList.add("hidden");
    sidebarSearchSuggestions.classList.add("hidden");
    topSearchSuggestions.innerHTML = "";
    sidebarSearchSuggestions.innerHTML = "";
    topSearchGhost.value = "";
    setSuggestionIndex(-1);
  }

  function updateSuggestionHighlight(items) {
    items.forEach((item, index) => {
      item.classList.toggle("is-active", index === getSuggestionIndex());
    });
  }

  // ── Input sync ────────────────────────────────────────────────────────────────

  function syncSearchInputsFromTop() {
    const value = topSearch.value;
    sidebarSearch.value = value;
    filters.search = value.trim();
    setActiveSearchSurface("top");
    callbacks.applyFilters();
  }

  function syncSearchInputsFromSidebar() {
    const value = sidebarSearch.value;
    topSearch.value = value;
    filters.search = value.trim();
    setActiveSearchSurface("sidebar");
    hideAllSearchSuggestions();
    callbacks.applyFilters();
  }

  // ── Keyboard handling ─────────────────────────────────────────────────────────

  function handleSearchKeydown(event) {
    setActiveSearchSurface(event.currentTarget === sidebarSearch ? "sidebar" : "top");

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
        callbacks.applyFilters();
        return;
      }
    }

    if (event.key === "ArrowDown" && hasSuggestionsOpen) {
      event.preventDefault();
      setSuggestionIndex(Math.min(getSuggestionIndex() + 1, items.length - 1));
      updateSuggestionHighlight(items);
      return;
    }

    if (event.key === "ArrowUp" && hasSuggestionsOpen) {
      event.preventDefault();
      setSuggestionIndex(Math.max(getSuggestionIndex() - 1, 0));
      updateSuggestionHighlight(items);
      return;
    }

    if (event.key === "Enter") {
      if (hasSuggestionsOpen && getSuggestionIndex() >= 0) {
        event.preventDefault();
        items[getSuggestionIndex()].click();
        return;
      }

      const bestCard = getBestCardSuggestion();
      if (bestCard) {
        event.preventDefault();
        callbacks.openModalByKey(bestCard.cardKey, true);
        hideAllSearchSuggestions();
        return;
      }
    }

    if (event.key === "Escape") {
      hideAllSearchSuggestions();
    }
  }

  return {
    renderSearchSuggestions,
    updateInlineAutocomplete,
    hideAllSearchSuggestions,
    handleSearchKeydown,
    syncSearchInputsFromTop,
    syncSearchInputsFromSidebar,
    getBestCardSuggestion,
    getActiveSearchElements
  };
}
