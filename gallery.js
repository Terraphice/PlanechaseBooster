let allCards = [];
let filteredCards = [];
let currentModalIndex = -1;
let cardMetadata = {};

const gallery = document.getElementById("gallery");
const resultsCount = document.getElementById("results-count");
const activeFilters = document.getElementById("active-filters");
const tagFilterList = document.getElementById("tag-filter-list");

const topSearch = document.getElementById("top-search");
const sidebarSearch = document.getElementById("sidebar-search");
const typeFilterInputs = [...document.querySelectorAll(".type-filter")];
const statusFilterInputs = [...document.querySelectorAll(".status-filter")];

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const topbarSidebarToggle = document.getElementById("topbar-sidebar-toggle");
const randomCardButton = document.getElementById("random-card-button");

const clearTypeFiltersButton = document.getElementById("clear-type-filters");
const clearStatusFiltersButton = document.getElementById("clear-status-filters");
const clearTagFiltersButton = document.getElementById("clear-tag-filters");
const clearAllFiltersButton = document.getElementById("clear-all-filters");

const viewModeSelect = document.getElementById("view-mode-select");
const groupBySelect = document.getElementById("group-by-select");
const groupTagPickerWrap = document.getElementById("group-tag-picker-wrap");
const groupTagSelect = document.getElementById("group-tag-select");

const modal = document.getElementById("card-modal");
const modalImage = document.getElementById("modal-image");
const modalName = document.getElementById("modal-card-name");
const modalType = document.getElementById("modal-card-type");
const modalBadge = document.getElementById("modal-card-badge");
const modalTranscript = document.getElementById("modal-transcript");
const modalSourceLink = document.getElementById("modal-source-link");
const modalCloseButton = document.getElementById("modal-close");
const modalPrevButton = document.getElementById("modal-prev");
const modalNextButton = document.getElementById("modal-next");
const modalTagList = document.getElementById("modal-tag-list");
const modalCopyLinkButton = document.getElementById("modal-copy-link");

const filters = {
  search: "",
  types: new Set(),
  statuses: new Set(),
  tags: new Set()
};

const displayState = {
  viewMode: "grid",
  groupBy: "none",
  groupTag: ""
};

init();

async function init() {
  try {
    const [cardsResponse, metadataResponse] = await Promise.allSettled([
      fetch("cards.json"),
      fetch("cardData.json")
    ]);

    if (cardsResponse.status !== "fulfilled" || !cardsResponse.value.ok) {
      throw new Error("Failed to load cards.json");
    }

    const rawCards = await cardsResponse.value.json();

    if (metadataResponse.status === "fulfilled" && metadataResponse.value.ok) {
      cardMetadata = await metadataResponse.value.json();
    } else {
      cardMetadata = {};
    }

    allCards = rawCards.map(enrichCard);
    buildTagFilters(allCards);
    buildGroupTagOptions(allCards);
    bindEvents();
    applyFilters();
    tryOpenCardFromHash();
  } catch (error) {
    console.error(error);
    gallery.innerHTML = `<p class="empty-state">Could not load gallery data.</p>`;
    resultsCount.textContent = "";
  }
}

function enrichCard(card) {
  const key = getCardKey(card.file);
  const metadata = cardMetadata[key] || {};
  const tags = Array.isArray(metadata.tags)
    ? metadata.tags
        .filter(Boolean)
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean)
    : [];

  return {
    ...card,
    key,
    displayName: getDisplayName(card.file),
    imagePath: `images/cards/${card.folder}/${card.file}`,
    transcriptPathMd: `transcripts/cards/${card.folder}/${key}.md`,
    transcriptPathTxt: `transcripts/cards/${card.folder}/${key}.txt`,
    status: card.folder,
    tags
  };
}

function bindEvents() {
  topSearch.addEventListener("input", syncSearchInputsFromTop);
  sidebarSearch.addEventListener("input", syncSearchInputsFromSidebar);

  typeFilterInputs.forEach((input) => {
    input.addEventListener("change", () => {
      toggleSetValue(filters.types, input.value, input.checked);
      applyFilters();
    });
  });

  statusFilterInputs.forEach((input) => {
    input.addEventListener("change", () => {
      toggleSetValue(filters.statuses, input.value, input.checked);
      applyFilters();
    });
  });

  clearTypeFiltersButton.addEventListener("click", () => {
    filters.types.clear();
    typeFilterInputs.forEach((input) => {
      input.checked = false;
    });
    applyFilters();
  });

  clearStatusFiltersButton.addEventListener("click", () => {
    filters.statuses.clear();
    statusFilterInputs.forEach((input) => {
      input.checked = false;
    });
    applyFilters();
  });

  clearTagFiltersButton.addEventListener("click", () => {
    filters.tags.clear();
    syncTagFilterUI();
    applyFilters();
  });

  clearAllFiltersButton.addEventListener("click", clearAllFilters);

  viewModeSelect.addEventListener("change", () => {
    displayState.viewMode = viewModeSelect.value;
    renderGallery();
  });

  groupBySelect.addEventListener("change", () => {
    displayState.groupBy = groupBySelect.value;
    groupTagPickerWrap.classList.toggle("hidden", displayState.groupBy !== "tag");
    renderGallery();
  });

  groupTagSelect.addEventListener("change", () => {
    displayState.groupTag = groupTagSelect.value;
    renderGallery();
  });

  sidebarToggle.addEventListener("click", toggleSidebar);
  topbarSidebarToggle.addEventListener("click", toggleSidebar);
  sidebarBackdrop.addEventListener("click", closeSidebar);

  randomCardButton.addEventListener("click", openRandomCard);

  modal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
      closeModal();
    }
  });

  modalCloseButton.addEventListener("click", closeModal);
  modalPrevButton.addEventListener("click", showPreviousCard);
  modalNextButton.addEventListener("click", showNextCard);
  modalCopyLinkButton.addEventListener("click", copyCurrentCardLink);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
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

    if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (!modal.classList.contains("hidden")) {
        event.preventDefault();
        showNextCard();
      }
    }

    if (event.key.toLowerCase() === "p" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (!modal.classList.contains("hidden")) {
        event.preventDefault();
        showPreviousCard();
      }
    }

    if (modal.classList.contains("hidden")) return;

    if (event.key === "ArrowLeft") showPreviousCard();
    if (event.key === "ArrowRight") showNextCard();
  });

  window.addEventListener("hashchange", () => {
    const key = getCardKeyFromHash();

    if (!key) {
      if (!modal.classList.contains("hidden")) {
        closeModal(false);
      }
      return;
    }

    openModalByKey(key, false);
  });
}

function syncSearchInputsFromTop() {
  const value = topSearch.value;
  sidebarSearch.value = value;
  filters.search = value.trim();
  applyFilters();
}

function syncSearchInputsFromSidebar() {
  const value = sidebarSearch.value;
  topSearch.value = value;
  filters.search = value.trim();
  applyFilters();
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
}

function toggleSidebar() {
  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function buildTagFilters(cards) {
  const tags = [...new Set(cards.flatMap((card) => card.tags))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  tagFilterList.innerHTML = "";

  for (const tag of tags) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-chip";
    button.textContent = tag;
    button.dataset.tag = tag;

    button.addEventListener("click", () => {
      toggleTagFilter(tag);
    });

    tagFilterList.appendChild(button);
  }
}

function buildGroupTagOptions(cards) {
  const tags = [...new Set(cards.flatMap((card) => card.tags))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  groupTagSelect.innerHTML = `<option value="">Choose a tag...</option>`;

  for (const tag of tags) {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    groupTagSelect.appendChild(option);
  }
}

function syncTagFilterUI() {
  const chips = [...tagFilterList.querySelectorAll(".tag-chip")];
  for (const chip of chips) {
    chip.classList.toggle("active", filters.tags.has(chip.dataset.tag));
  }
}

function toggleTagFilter(tag) {
  const wasModalOpen = !modal.classList.contains("hidden");
  const currentCardKey =
    wasModalOpen &&
    currentModalIndex >= 0 &&
    currentModalIndex < filteredCards.length
      ? filteredCards[currentModalIndex].key
      : getCardKeyFromHash();

  if (filters.tags.has(tag)) {
    filters.tags.delete(tag);
  } else {
    filters.tags.add(tag);
  }

  syncTagFilterUI();
  applyFilters();

  if (!wasModalOpen || !currentCardKey) {
    return;
  }

  const matchingIndex = filteredCards.findIndex((card) => card.key === currentCardKey);

  if (matchingIndex === -1) {
    closeModal(false);
    return;
  }

  currentModalIndex = matchingIndex;
  renderModal(filteredCards[currentModalIndex], false);
}

function applyFilters() {
  const parsedQuery = parseSearchQuery(filters.search);

  filteredCards = allCards.filter((card) => matchesFilters(card, parsedQuery));

  filteredCards.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    return a.displayName.localeCompare(b.displayName, undefined, {
      numeric: true,
      sensitivity: "base"
    });
  });

  renderActiveFilters(parsedQuery);
  renderGallery();
}

function matchesFilters(card, parsedQuery) {
  if (filters.types.size > 0 && !filters.types.has(card.type)) {
    return false;
  }

  if (filters.statuses.size > 0 && !filters.statuses.has(card.status)) {
    return false;
  }

  if (filters.tags.size > 0) {
    for (const tag of filters.tags) {
      if (!card.tags.includes(tag)) {
        return false;
      }
    }
  }

  if (!matchesParsedQuery(card, parsedQuery)) {
    return false;
  }

  return true;
}

function matchesParsedQuery(card, parsedQuery) {
  const haystack = [
    card.displayName,
    card.type,
    normalizeStatusLabel(card.status),
    ...card.tags
  ].join(" ").toLowerCase();

  for (const term of parsedQuery.textTerms) {
    if (!haystack.includes(term)) {
      return false;
    }
  }

  for (const term of parsedQuery.negTextTerms) {
    if (haystack.includes(term)) {
      return false;
    }
  }

  for (const value of parsedQuery.nameTerms) {
    if (!card.displayName.toLowerCase().includes(value)) {
      return false;
    }
  }

  for (const value of parsedQuery.negNameTerms) {
    if (card.displayName.toLowerCase().includes(value)) {
      return false;
    }
  }

  for (const value of parsedQuery.typeTerms) {
    if (card.type.toLowerCase() !== value) {
      return false;
    }
  }

  for (const value of parsedQuery.negTypeTerms) {
    if (card.type.toLowerCase() === value) {
      return false;
    }
  }

  for (const value of parsedQuery.statusTerms) {
    if (normalizeStatusLabel(card.status) !== value) {
      return false;
    }
  }

  for (const value of parsedQuery.negStatusTerms) {
    if (normalizeStatusLabel(card.status) === value) {
      return false;
    }
  }

  for (const value of parsedQuery.tagTerms) {
    if (!card.tags.includes(value)) {
      return false;
    }
  }

  for (const value of parsedQuery.negTagTerms) {
    if (card.tags.includes(value)) {
      return false;
    }
  }

  return true;
}

function parseSearchQuery(rawQuery) {
  const parsed = {
    textTerms: [],
    negTextTerms: [],
    nameTerms: [],
    negNameTerms: [],
    typeTerms: [],
    negTypeTerms: [],
    statusTerms: [],
    negStatusTerms: [],
    tagTerms: [],
    negTagTerms: []
  };

  if (!rawQuery) return parsed;

  const tokens = rawQuery.match(/"[^"]+"|\S+/g) || [];

  for (let token of tokens) {
    let negated = false;

    if (token.startsWith("-")) {
      negated = true;
      token = token.slice(1);
    }

    token = stripQuotes(token);
    if (!token) continue;

    const colonIndex = token.indexOf(":");
    if (colonIndex > 0) {
      const field = token.slice(0, colonIndex).toLowerCase();
      const value = stripQuotes(token.slice(colonIndex + 1)).toLowerCase().trim();
      if (!value) continue;

      if (field === "type" || field === "t") {
        (negated ? parsed.negTypeTerms : parsed.typeTerms).push(value);
        continue;
      }

      if (field === "status" || field === "s") {
        const normalized = normalizeQueryStatus(value);
        if (normalized) {
          (negated ? parsed.negStatusTerms : parsed.statusTerms).push(normalized);
        }
        continue;
      }

      if (field === "tag") {
        (negated ? parsed.negTagTerms : parsed.tagTerms).push(value);
        continue;
      }

      if (field === "name") {
        (negated ? parsed.negNameTerms : parsed.nameTerms).push(value);
        continue;
      }
    }

    (negated ? parsed.negTextTerms : parsed.textTerms).push(token.toLowerCase());
  }

  return parsed;
}

function renderGallery() {
  gallery.innerHTML = "";
  resultsCount.textContent = `${filteredCards.length} ${filteredCards.length === 1 ? "card" : "cards"}`;

  if (filteredCards.length === 0) {
    gallery.innerHTML = `<p class="empty-state">No cards match the current filters.</p>`;
    return;
  }

  if (displayState.groupBy === "none") {
    const wrapper = document.createElement("div");
    wrapper.className = displayState.viewMode === "single" ? "single-card-layout" : "card-grid";

    for (const card of filteredCards) {
      const element = createCardElement(card);
      if (displayState.viewMode === "single") {
        element.classList.add("single-card-item");
      }
      wrapper.appendChild(element);
    }

    gallery.appendChild(wrapper);
    return;
  }

  const grouped = groupCards(filteredCards, displayState.groupBy, displayState.groupTag);
  const groupsWrap = document.createElement("div");
  groupsWrap.className = "result-groups";

  for (const group of grouped) {
    if (!group.cards.length) continue;

    const section = document.createElement("section");
    section.className = "result-group";

    const inner = document.createElement("div");
    inner.className = displayState.viewMode === "single"
      ? "single-card-layout result-group-body"
      : "card-grid result-group-body";

    for (const card of group.cards) {
      const element = createCardElement(card);
      if (displayState.viewMode === "single") {
        element.classList.add("single-card-item");
      }
      inner.appendChild(element);
    }

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
}

function groupCards(cards, mode, selectedTag) {
  const groups = new Map();

  if (mode === "type") {
    for (const card of cards) {
      addCardToGroup(groups, card.type, card);
    }
  } else if (mode === "status") {
    for (const card of cards) {
      addCardToGroup(groups, card.status === "complete" ? "Complete" : "WIP", card);
    }
  } else if (mode === "tag") {
    if (!selectedTag) {
      addCardToGroup(groups, "Ungrouped", ...cards);
    } else {
      addCardToGroup(groups, `Has tag: ${selectedTag}`, ...cards.filter((card) => card.tags.includes(selectedTag)));
      addCardToGroup(groups, `Missing tag: ${selectedTag}`, ...cards.filter((card) => !card.tags.includes(selectedTag)));
    }
  }

  return [...groups.entries()].map(([label, groupCards]) => ({
    label,
    cards: groupCards
  }));
}

function addCardToGroup(map, label, ...cards) {
  if (!map.has(label)) {
    map.set(label, []);
  }
  map.get(label).push(...cards);
}

function createCardElement(card) {
  const cardButton = document.createElement("button");
  cardButton.type = "button";
  cardButton.className = "card-link";
  cardButton.setAttribute("aria-label", `Open viewer for ${card.displayName}`);

  const badgeText = card.status === "complete" ? "Complete" : "WIP";
  const badgeClass = card.status === "complete" ? "card-badge-complete" : "card-badge-wip";

  const tagsContainer = document.createElement("div");
  tagsContainer.className = "card-tags";

  cardButton.innerHTML = `
    <article class="card">
      <div class="card-badge ${badgeClass}">${badgeText}</div>
      <div class="card-image-wrap">
        <img class="card-image" src="${card.imagePath}" alt="${escapeHtml(card.displayName)}" loading="lazy" />
      </div>
      <div class="card-footer">
        <div class="card-name-row">
          <h3 class="card-name">${escapeHtml(card.displayName)}</h3>
          <div class="card-type">${card.type}</div>
        </div>
      </div>
    </article>
  `;

  const footer = cardButton.querySelector(".card-footer");
  footer.appendChild(tagsContainer);

  for (const tag of card.tags.slice(0, 4)) {
    const tagElement = createInteractiveTag(tag, "card-tag");
    tagsContainer.appendChild(tagElement);
  }

  cardButton.addEventListener("click", () => openModalByKey(card.key, true));
  return cardButton;
}

function createInteractiveTag(tag, className = "card-tag") {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = tag;
  element.classList.toggle("active", filters.tags.has(tag));

  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleTagFilter(tag);
  });

  return element;
}

function renderActiveFilters(parsedQuery) {
  activeFilters.innerHTML = "";

  const pillData = [];

  if (filters.search) {
    pillData.push({ label: `Search: ${filters.search}`, removable: false });
  }

  for (const type of filters.types) {
    pillData.push({ label: `Type: ${type}`, removable: false });
  }

  for (const status of filters.statuses) {
    pillData.push({
      label: `Status: ${status === "complete" ? "Complete" : "WIP"}`,
      removable: false
    });
  }

  for (const tag of filters.tags) {
    pillData.push({
      label: `Tag: ${tag}`,
      removable: true,
      tag
    });
  }

  for (const value of parsedQuery.typeTerms) pillData.push({ label: `type:${value}`, removable: false });
  for (const value of parsedQuery.negTypeTerms) pillData.push({ label: `-type:${value}`, removable: false });
  for (const value of parsedQuery.statusTerms) pillData.push({ label: `status:${value}`, removable: false });
  for (const value of parsedQuery.negStatusTerms) pillData.push({ label: `-status:${value}`, removable: false });
  for (const value of parsedQuery.tagTerms) pillData.push({ label: `tag:${value}`, removable: false });
  for (const value of parsedQuery.negTagTerms) pillData.push({ label: `-tag:${value}`, removable: false });
  for (const value of parsedQuery.nameTerms) pillData.push({ label: `name:${value}`, removable: false });
  for (const value of parsedQuery.negNameTerms) pillData.push({ label: `-name:${value}`, removable: false });

  for (const pill of pillData) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "active-filter-pill";
    element.textContent = pill.removable ? `${pill.label} ×` : pill.label;

    if (pill.removable) {
      element.classList.add("active-filter-pill-removable");
      element.addEventListener("click", () => {
        toggleTagFilter(pill.tag);
      });
    } else {
      element.disabled = true;
    }

    activeFilters.appendChild(element);
  }
}

async function renderModal(card, updateHash = true) {
  modalImage.src = card.imagePath;
  modalImage.alt = card.displayName;
  modalName.textContent = card.displayName;
  modalType.textContent = card.type;
  modalSourceLink.href = card.imagePath;

  modalBadge.textContent = card.status === "complete" ? "Complete" : "WIP";
  modalBadge.className = `modal-status-badge ${card.status === "complete" ? "complete" : "incomplete"}`;

  modalTagList.innerHTML = "";
  for (const tag of card.tags) {
    modalTagList.appendChild(createInteractiveTag(tag, "modal-tag"));
  }

  modalTranscript.innerHTML = "Loading transcript…";

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  updateModalNavButtons();

  if (updateHash) {
    updateUrlForCard(card);
  }

  preloadAdjacentImages();

  try {
    let response = await fetch(card.transcriptPathMd, { cache: "no-store" });

    if (!response.ok) {
      response = await fetch(card.transcriptPathTxt, { cache: "no-store" });
    }

    if (!response.ok) throw new Error("Transcript not found");

    const transcript = await response.text();
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

  if (updateHash) {
    clearCardHash();
  }
}

function showPreviousCard() {
  if (currentModalIndex <= 0) return;
  currentModalIndex -= 1;
  const card = filteredCards[currentModalIndex];
  renderModal(card, true);
}

function showNextCard() {
  if (currentModalIndex >= filteredCards.length - 1) return;
  currentModalIndex += 1;
  const card = filteredCards[currentModalIndex];
  renderModal(card, true);
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

function openRandomCard() {
  if (!filteredCards.length) return;
  const randomIndex = Math.floor(Math.random() * filteredCards.length);
  const card = filteredCards[randomIndex];
  openModalByKey(card.key, true);
}

async function copyCurrentCardLink() {
  if (currentModalIndex < 0 || currentModalIndex >= filteredCards.length) return;

  const card = filteredCards[currentModalIndex];
  const url = `${window.location.origin}${window.location.pathname}#card=${encodeURIComponent(card.key)}`;

  try {
    await navigator.clipboard.writeText(url);
    const original = modalCopyLinkButton.textContent;
    modalCopyLinkButton.textContent = "Copied!";
    setTimeout(() => {
      modalCopyLinkButton.textContent = original;
    }, 1200);
  } catch {
    const original = modalCopyLinkButton.textContent;
    modalCopyLinkButton.textContent = "Copy failed";
    setTimeout(() => {
      modalCopyLinkButton.textContent = original;
    }, 1200);
  }
}

function clearAllFilters() {
  filters.search = "";
  filters.types.clear();
  filters.statuses.clear();
  filters.tags.clear();

  topSearch.value = "";
  sidebarSearch.value = "";
  viewModeSelect.value = "grid";
  groupBySelect.value = "none";
  groupTagSelect.value = "";
  displayState.viewMode = "grid";
  displayState.groupBy = "none";
  displayState.groupTag = "";
  groupTagPickerWrap.classList.add("hidden");

  typeFilterInputs.forEach((input) => {
    input.checked = false;
  });

  statusFilterInputs.forEach((input) => {
    input.checked = false;
  });

  syncTagFilterUI();
  applyFilters();
  tryOpenCardFromHash();
}

function getCardKey(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

function getDisplayName(filename) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const withoutTypePrefix = withoutExtension.replace(/^(Plane|Phenomenon)[-_ ]+/i, "");
  return withoutTypePrefix.replace(/[_-]+/g, " ").trim();
}

function updateUrlForCard(card) {
  const hash = `#card=${encodeURIComponent(card.key)}`;
  if (window.location.hash !== hash) {
    history.pushState(null, "", hash);
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

function toggleSetValue(setObject, value, enabled) {
  if (enabled) setObject.add(value);
  else setObject.delete(value);
}

function renderTranscriptMarkdown(markdownText) {
  const rawHtml = marked.parse(markdownText, {
    breaks: true
  });

  const safeHtml = DOMPurify.sanitize(rawHtml);
  modalTranscript.innerHTML = enhanceManaSymbols(safeHtml);
}

function enhanceManaSymbols(html) {
  return html.replace(/\{([^}]+)\}/g, (_, rawSymbol) => {
    const symbol = rawSymbol.trim().toLowerCase();
    const classes = getManaClasses(symbol);

    if (!classes) {
      return `{${escapeHtml(rawSymbol)}}`;
    }

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

function normalizeQueryStatus(value) {
  if (value === "complete") return "complete";
  if (value === "wip") return "wip";
  if (value === "incomplete") return "wip";
  return value;
}

function normalizeStatusLabel(status) {
  return status === "complete" ? "complete" : "wip";
}

function stripQuotes(value) {
  return value.replace(/^"(.*)"$/, "$1").trim();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}