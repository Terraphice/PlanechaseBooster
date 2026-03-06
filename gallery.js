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

const clearTypeFiltersButton = document.getElementById("clear-type-filters");
const clearStatusFiltersButton = document.getElementById("clear-status-filters");
const clearTagFiltersButton = document.getElementById("clear-tag-filters");
const clearAllFiltersButton = document.getElementById("clear-all-filters");

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

const filters = {
  search: "",
  types: new Set(),
  statuses: new Set(),
  tags: new Set()
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
    transcriptPath: `transcripts/cards/${card.folder}/${key}.txt`,
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

  sidebarToggle.addEventListener("click", toggleSidebar);
  topbarSidebarToggle.addEventListener("click", toggleSidebar);
  sidebarBackdrop.addEventListener("click", closeSidebar);

  modal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
      closeModal();
    }
  });

  modalCloseButton.addEventListener("click", closeModal);
  modalPrevButton.addEventListener("click", showPreviousCard);
  modalNextButton.addEventListener("click", showNextCard);

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
  filters.search = value.trim().toLowerCase();
  applyFilters();
}

function syncSearchInputsFromSidebar() {
  const value = sidebarSearch.value;
  topSearch.value = value;
  filters.search = value.trim().toLowerCase();
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
      if (filters.tags.has(tag)) {
        filters.tags.delete(tag);
      } else {
        filters.tags.add(tag);
      }
      syncTagFilterUI();
      applyFilters();
    });

    tagFilterList.appendChild(button);
  }
}

function syncTagFilterUI() {
  const chips = [...tagFilterList.querySelectorAll(".tag-chip")];
  for (const chip of chips) {
    chip.classList.toggle("active", filters.tags.has(chip.dataset.tag));
  }
}

function applyFilters() {
  filteredCards = allCards.filter(matchesFilters);

  filteredCards.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    return a.displayName.localeCompare(b.displayName, undefined, {
      numeric: true,
      sensitivity: "base"
    });
  });

  renderActiveFilters();
  renderGallery();
}

function matchesFilters(card) {
  if (filters.search) {
    const haystack = [
      card.displayName,
      card.type,
      card.status,
      ...card.tags
    ].join(" ").toLowerCase();

    if (!haystack.includes(filters.search)) {
      return false;
    }
  }

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

  return true;
}

function renderGallery() {
  gallery.innerHTML = "";
  resultsCount.textContent = `${filteredCards.length} ${filteredCards.length === 1 ? "card" : "cards"}`;

  if (filteredCards.length === 0) {
    gallery.innerHTML = `<p class="empty-state">No cards match the current filters.</p>`;
    return;
  }

  for (const card of filteredCards) {
    const cardButton = document.createElement("button");
    cardButton.type = "button";
    cardButton.className = "card-link";
    cardButton.setAttribute("aria-label", `Open viewer for ${card.displayName}`);

    const badgeText = card.status === "complete" ? "Complete" : "WIP";
    const badgeClass = card.status === "complete" ? "card-badge-complete" : "card-badge-wip";

    const visibleTags = card.tags.slice(0, 4);
    const tagMarkup = visibleTags
      .map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`)
      .join("");

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
          <div class="card-tags">${tagMarkup}</div>
        </div>
      </article>
    `;

    cardButton.addEventListener("click", () => openModalByKey(card.key, true));
    gallery.appendChild(cardButton);
  }
}

function renderActiveFilters() {
  const pills = [];

  if (filters.search) pills.push(`Search: ${filters.search}`);
  for (const type of filters.types) pills.push(`Type: ${type}`);
  for (const status of filters.statuses) pills.push(`Status: ${status === "complete" ? "Complete" : "WIP"}`);
  for (const tag of filters.tags) pills.push(`Tag: ${tag}`);

  activeFilters.innerHTML = pills
    .map((pill) => `<span class="active-filter-pill">${escapeHtml(pill)}</span>`)
    .join("");
}

function openModalByKey(cardKey, updateHash = true) {
  let index = filteredCards.findIndex((card) => card.key === cardKey);

  if (index === -1) {
    const cardInAll = allCards.find((card) => card.key === cardKey);
    if (!cardInAll) return;

    if (!filteredCards.some((card) => card.key === cardKey)) {
      filteredCards = [...allCards];
      filteredCards.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return a.displayName.localeCompare(b.displayName, undefined, {
          numeric: true,
          sensitivity: "base"
        });
      });
      renderGallery();
    }

    index = filteredCards.findIndex((card) => card.key === cardKey);
    if (index === -1) return;
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

  modalBadge.textContent = card.status === "complete" ? "Complete" : "WIP";
  modalBadge.className = `modal-status-badge ${card.status === "complete" ? "complete" : "incomplete"}`;

  modalTagList.innerHTML = card.tags
    .map((tag) => `<span class="modal-tag">${escapeHtml(tag)}</span>`)
    .join("");

  modalTranscript.textContent = "Loading transcript…";

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  updateModalNavButtons();

  if (updateHash) {
    updateUrlForCard(card);
  }

  try {
    const response = await fetch(card.transcriptPath, { cache: "no-store" });
    if (!response.ok) throw new Error("Transcript not found");

    const transcript = await response.text();
    modalTranscript.textContent = transcript.trim() || "No transcript available.";
  } catch {
    modalTranscript.textContent = "No transcript available.";
  }
}

function closeModal(updateHash = true) {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  modalImage.src = "";
  modalImage.alt = "";
  modalSourceLink.href = "#";
  modalTranscript.textContent = "No transcript available.";
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

function clearAllFilters() {
  filters.search = "";
  filters.types.clear();
  filters.statuses.clear();
  filters.tags.clear();

  topSearch.value = "";
  sidebarSearch.value = "";

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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}