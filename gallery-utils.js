export function loadPreferences(storageKey) {
  const defaults = {
    viewMode: "grid",
    groupBy: "none",
    groupTag: "",
    fuzzySearch: false,
    inlineAutocomplete: true,
    showHidden: false,
    theme: "system",
    themePalette: "standard",
    pageSize: 20,
    paginationMode: "paginated"
  };

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    return {
      viewMode: ["grid", "single", "stack"].includes(parsed.viewMode) ? parsed.viewMode : defaults.viewMode,
      groupBy: ["none", "tag"].includes(parsed.groupBy) ? parsed.groupBy : defaults.groupBy,
      groupTag: typeof parsed.groupTag === "string" ? parsed.groupTag : defaults.groupTag,
      fuzzySearch: Boolean(parsed.fuzzySearch),
      inlineAutocomplete: parsed.inlineAutocomplete === undefined ? defaults.inlineAutocomplete : Boolean(parsed.inlineAutocomplete),
      showHidden: Boolean(parsed.showHidden),
      theme: ["system", "dark", "light"].includes(parsed.theme) ? parsed.theme : defaults.theme,
      themePalette: ["standard", "gruvbox", "atom", "dracula", "solarized", "nord", "catppuccin", "scryfall"].includes(parsed.themePalette)
        ? parsed.themePalette
        : defaults.themePalette,
      pageSize: [10, 20, 50, 100].includes(parsed.pageSize) ? parsed.pageSize : defaults.pageSize,
      paginationMode: ["paginated", "infinite"].includes(parsed.paginationMode) ? parsed.paginationMode : defaults.paginationMode
    };
  } catch {
    return defaults;
  }
}

export function savePreferences(storageKey, displayState, filters, theme = "system", themePalette = "standard", paginationState = {}) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        viewMode: displayState.viewMode,
        groupBy: displayState.groupBy,
        groupTag: displayState.groupTag,
        fuzzySearch: filters.fuzzy,
        inlineAutocomplete: filters.inlineAutocomplete,
        showHidden: filters.showHidden,
        theme,
        themePalette,
        pageSize: paginationState.pageSize ?? 20,
        paginationMode: paginationState.mode ?? "paginated"
      })
    );
  } catch {
    // ignore storage failures
  }
}

export function getCardKey(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

export function getDisplayName(filename) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const withoutTypePrefix = withoutExtension.replace(/^(Plane|Phenomenon)[-_ ]+/i, "");
  return withoutTypePrefix.replace(/[_-]+/g, " ").trim();
}

export function getCardType(tags) {
  if (tags.includes("plane")) return "Plane";
  if (tags.includes("phenomenon")) return "Phenomenon";
  return "Unknown";
}

export function enrichCard(card) {
  const tags = Array.isArray(card.tags)
    ? card.tags
        .filter(Boolean)
        .map((tag) => String(tag).trim())
        .filter(Boolean)
    : [];

  const normalizedTags = tags.map((tag) => tag.toLowerCase());

  const folder = card.folder || "complete";
  return {
    ...card,
    key: getCardKey(card.file),
    displayName: getDisplayName(card.file),
    imagePath: `images/cards/${folder}/${card.file}`,
    thumbPath: `images/thumb/${getCardKey(card.file)}.webp`,
    transcriptPath: `transcripts/cards/${folder}/${getCardKey(card.file)}.md`,
    tags,
    normalizedTags,
    type: getCardType(normalizedTags)
  };
}

export function sortCards(cards) {
  cards.sort((a, b) => {
    const nameCompare = a.displayName.localeCompare(b.displayName, undefined, {
      numeric: true,
      sensitivity: "base"
    });

    if (nameCompare !== 0) return nameCompare;
    return a.type.localeCompare(b.type, undefined, { sensitivity: "base" });
  });
}

export function reconcileSelectedTags(selectedTags, cards) {
  const canonicalByLower = new Map();

  for (const tag of cards.flatMap((card) => card.tags)) {
    const lower = tag.toLowerCase();
    if (!canonicalByLower.has(lower)) {
      canonicalByLower.set(lower, tag);
    }
  }

  return new Set(
    [...selectedTags]
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .map((tag) => canonicalByLower.get(tag.toLowerCase()) || tag)
  );
}

export function readUrlState(filters, displayState, paginationState = null) {
  const params = new URLSearchParams(window.location.search);

  filters.search = params.get("q") || "";

  const tagValues = [
    ...params.getAll("tag"),
    ...params.getAll("type")
  ];

  filters.tags = new Set(
    tagValues
      .map((value) => String(value).trim())
      .filter(Boolean)
  );

  const view = params.get("view");
  if (["grid", "single", "stack"].includes(view)) {
    displayState.viewMode = view;
  }

  const groupBy = params.get("groupBy");
  if (["none", "tag"].includes(groupBy)) {
    displayState.groupBy = groupBy;
  }

  if (params.has("groupTag")) {
    displayState.groupTag = params.get("groupTag") || "";
  }

  if (paginationState && params.has("page")) {
    const page = parseInt(params.get("page"), 10);
    if (!isNaN(page) && page >= 1) {
      paginationState.currentPage = page;
    }
  }
}

export function writeUrlState(filters, displayState, { push = false, paginationState = null } = {}) {
  const params = new URLSearchParams();

  if (filters.search) {
    params.set("q", filters.search);
  }

  for (const tag of [...filters.tags].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))) {
    params.append("tag", tag);
  }

  if (displayState.viewMode !== "grid") {
    params.set("view", displayState.viewMode);
  }

  if (displayState.groupBy !== "none") {
    params.set("groupBy", displayState.groupBy);
  }

  if (displayState.groupTag) {
    params.set("groupTag", displayState.groupTag);
  }

  if (paginationState && paginationState.mode === "paginated" && paginationState.currentPage > 1) {
    params.set("page", String(paginationState.currentPage));
  }

  const query = params.toString();
  const hash = window.location.hash || "";
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${hash}`;

  if (push) {
    history.pushState(null, "", url);
  } else {
    history.replaceState(null, "", url);
  }
}

export function matchesFilters(card, parsedQuery, filters, transcriptCache = null) {
  if (!filters.showHidden && !parsedQuery.showHidden && isHiddenCard(card.normalizedTags)) {
    return false;
  }

  if (filters.tags.size > 0) {
    for (const tag of filters.tags) {
      if (!card.normalizedTags.includes(tag.toLowerCase())) {
        return false;
      }
    }
  }

  return matchesParsedQuery(card, parsedQuery, filters, transcriptCache);
}

export function matchesParsedQuery(card, parsedQuery, filters, transcriptCache = null) {
  const haystack = [
    card.displayName,
    card.type,
    ...card.normalizedTags
  ].join(" ").toLowerCase();

  if (parsedQuery.regex) {
    if (!parsedQuery.regex.test(haystack)) {
      return false;
    }
  }

  for (const term of parsedQuery.textTerms) {
    const termLower = term.toLowerCase();

    if (filters.fuzzy) {
      if (!fuzzyIncludes(haystack, termLower)) {
        return false;
      }
    } else if (!haystack.includes(termLower)) {
      return false;
    }
  }

  for (const term of parsedQuery.negTextTerms) {
    const termLower = term.toLowerCase();

    if (filters.fuzzy) {
      if (fuzzyIncludes(haystack, termLower)) {
        return false;
      }
    } else if (haystack.includes(termLower)) {
      return false;
    }
  }

  for (const value of parsedQuery.nameTerms) {
    const candidate = card.displayName.toLowerCase();
    if (filters.fuzzy) {
      if (!fuzzyIncludes(candidate, value)) return false;
    } else if (!candidate.includes(value)) {
      return false;
    }
  }

  for (const value of parsedQuery.negNameTerms) {
    const candidate = card.displayName.toLowerCase();
    if (filters.fuzzy) {
      if (fuzzyIncludes(candidate, value)) return false;
    } else if (candidate.includes(value)) {
      return false;
    }
  }

  for (const value of parsedQuery.tagTerms) {
    if (!card.normalizedTags.includes(value)) {
      return false;
    }
  }

  for (const value of parsedQuery.negTagTerms) {
    if (card.normalizedTags.includes(value)) {
      return false;
    }
  }

  if (parsedQuery.oracleTerms.length > 0 || parsedQuery.negOracleTerms.length > 0) {
    const cached = transcriptCache ? transcriptCache.get(card.key) : null;
    const cardText = (typeof cached === "string" ? cached : "").toLowerCase();

    for (const value of parsedQuery.oracleTerms) {
      if (filters.fuzzy) {
        if (!fuzzyIncludes(cardText, value)) return false;
      } else if (!cardText.includes(value)) {
        return false;
      }
    }

    for (const value of parsedQuery.negOracleTerms) {
      if (filters.fuzzy) {
        if (fuzzyIncludes(cardText, value)) return false;
      } else if (cardText.includes(value)) {
        return false;
      }
    }
  }

  return true;
}

export function parseSearchQuery(rawQuery) {
  const parsed = {
    textTerms: [],
    negTextTerms: [],
    nameTerms: [],
    negNameTerms: [],
    tagTerms: [],
    negTagTerms: [],
    oracleTerms: [],
    negOracleTerms: [],
    regex: null,
    regexSource: null,
    showHidden: false
  };

  if (!rawQuery) return parsed;

  const regexMatch = rawQuery.match(/^\/(.+)\/([gimsuy]*)$/);
  if (regexMatch) {
    try {
      parsed.regex = new RegExp(regexMatch[1], regexMatch[2]);
      parsed.regexSource = rawQuery;
    } catch {
      parsed.regex = null;
      parsed.regexSource = null;
    }
  }

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

      if (field === "tag" || field === "type" || field === "t") {
        (negated ? parsed.negTagTerms : parsed.tagTerms).push(value);
        continue;
      }

      if (field === "name" || field === "n") {
        (negated ? parsed.negNameTerms : parsed.nameTerms).push(value);
        continue;
      }

      if (field === "oracle" || field === "o" || field === "text") {
        (negated ? parsed.negOracleTerms : parsed.oracleTerms).push(value);
        continue;
      }

      if (field === "show" && value === "hidden" && !negated) {
        parsed.showHidden = true;
        continue;
      }
    }

    if (!/^\/(.+)\/([gimsuy]*)$/.test(token)) {
      (negated ? parsed.negTextTerms : parsed.textTerms).push(token.toLowerCase());
    }
  }

  return parsed;
}

export function fuzzyIncludes(haystack, needle) {
  if (!needle) return true;
  if (haystack.includes(needle)) return true;

  const threshold = getFuzzyThreshold(needle.length);
  const words = haystack.split(/\s+/);

  for (const word of words) {
    if (levenshteinDistance(word, needle) <= threshold) {
      return true;
    }
  }

  const joined = haystack.replace(/\s+/g, " ");
  const slices = createCandidateSlices(joined, needle.length);

  for (const slice of slices) {
    if (levenshteinDistance(slice, needle) <= threshold) {
      return true;
    }
  }

  return false;
}

export function createCandidateSlices(text, needleLength) {
  const results = [];
  const min = Math.max(1, needleLength - 2);
  const max = needleLength + 2;

  for (let size = min; size <= max; size += 1) {
    for (let i = 0; i <= text.length - size; i += 1) {
      results.push(text.slice(i, i + size));
    }
  }

  return results;
}

export function getFuzzyThreshold(length) {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 8) return 2;
  return 3;
}

export function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

export function isTopTag(tag) {
  return String(tag).startsWith(":top:");
}

export function isHiddenCard(normalizedTags) {
  return normalizedTags.includes("hidden");
}

export function stripTopPrefix(tag) {
  return isTopTag(tag) ? String(tag).slice(5) : String(tag);
}

export function parseBadgeTag(tag) {
  const parts = stripTopPrefix(String(tag)).split(":");
  if (parts.length < 4 || parts[0] !== "badge") return null;

  const corner = parts[1];
  const color = parts[2];
  const label = parts.slice(3).join(":");

  if (!["tl", "tr", "bl", "br"].includes(corner)) return null;
  if (!["green", "amber", "blue", "red", "purple", "gray"].includes(color)) return null;
  if (!label) return null;

  return { raw: tag, corner, color, label };
}

export function getBadgeTags(tags) {
  return tags.map(parseBadgeTag).filter(Boolean);
}

export function getTagLabel(tag) {
  const stripped = stripTopPrefix(tag);
  const badge = parseBadgeTag(stripped);
  return badge ? badge.label : stripped;
}

export function getTagToneClass(tag, baseClass) {
  const stripped = stripTopPrefix(tag);
  const badge = parseBadgeTag(stripped);
  return badge ? `${baseClass} tone-${badge.color}` : baseClass;
}

export function stripQuotes(value) {
  return value.replace(/^"(.*)"$/, "$1").trim();
}

export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}