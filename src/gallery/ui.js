// ── gallery-ui.js ─────────────────────────────────────────────────────────────
// ThemeController (palette and mode cycling) and ToastManager (ephemeral
// notification toasts).

const STANDARD_THEME_ORDER = ["system", "dark", "light"];
const HIDDEN_PALETTE_ORDER = ["standard", "gruvbox", "atom", "dracula", "solarized", "nord", "catppuccin", "scryfall"];
const THEME_ICONS = {
  system: "◐",
  dark: "☾",
  light: "☀"
};
const THEME_LABELS = {
  system: "System",
  dark: "Dark",
  light: "Light"
};

function isAltPaletteEvent(event) {
  return Boolean(event?.altKey);
}

export function initToastManager(container) {
  let currentToast = null;
  let hideTimer = null;
  let removeTimer = null;

  return function showToast(message, duration = 1400) {
    clearTimeout(hideTimer);
    clearTimeout(removeTimer);

    if (currentToast) {
      currentToast.remove();
      currentToast = null;
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    currentToast = toast;

    hideTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");

      removeTimer = window.setTimeout(() => {
        if (toast === currentToast) currentToast = null;
        toast.remove();
      }, 180);
    }, duration);
  };
}

export function initThemeController({
  button,
  initialTheme = "system",
  initialPalette = "standard",
  onChange = () => {}
}) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const glyph = button.querySelector(".theme-toggle-glyph");

  let theme = STANDARD_THEME_ORDER.includes(initialTheme) ? initialTheme : "system";
  let palette = HIDDEN_PALETTE_ORDER.includes(initialPalette) ? initialPalette : "standard";
  let suppressClick = false;
  let longPressTimer = null;
  let longPressFired = false;

  function resolveTheme(preference) {
    return preference === "system" ? (media.matches ? "dark" : "light") : preference;
  }

  function getAnnouncementLabel() {
    const themeLabel = THEME_LABELS[theme];
    if (palette === "standard") return themeLabel;
    return `${themeLabel} · ${palette[0].toUpperCase()}${palette.slice(1)}`;
  }

  function applyTheme({ animate = false } = {}) {
    document.documentElement.dataset.theme = resolveTheme(theme);
    document.documentElement.dataset.themePreference = theme;
    document.documentElement.dataset.palette = palette;

    button.dataset.mode = theme;
    button.dataset.palette = palette;
    button.setAttribute(
      "aria-label",
      `Theme: ${getAnnouncementLabel()}. Click to cycle dark/light mode.`
    );
    button.title = getAnnouncementLabel();

    if (!glyph) return;

    if (animate) {
      button.classList.add("is-changing");
      window.setTimeout(() => {
        glyph.textContent = THEME_ICONS[theme];
        button.classList.remove("is-changing");
      }, 90);
    } else {
      glyph.textContent = THEME_ICONS[theme];
    }
  }

  function setTheme(nextTheme, {
    animate = false,
    silent = false,
    paletteOverride = palette
  } = {}) {
    theme = STANDARD_THEME_ORDER.includes(nextTheme) ? nextTheme : "system";
    palette = HIDDEN_PALETTE_ORDER.includes(paletteOverride) ? paletteOverride : "standard";
    applyTheme({ animate });
    if (!silent) onChange(theme, palette);
  }

  function cycleStandardTheme() {
    const currentIndex = STANDARD_THEME_ORDER.indexOf(theme);
    const nextTheme = STANDARD_THEME_ORDER[(currentIndex + 1) % STANDARD_THEME_ORDER.length];
    setTheme(nextTheme, {
      animate: true,
      paletteOverride: "standard"
    });
  }

  function cycleAlternatePalette() {
    const currentIndex = HIDDEN_PALETTE_ORDER.indexOf(palette);
    const nextPalette = HIDDEN_PALETTE_ORDER[(currentIndex + 1) % HIDDEN_PALETTE_ORDER.length];
    setTheme(theme, {
      animate: true,
      paletteOverride: nextPalette
    });
  }

  function handleButtonClick(event) {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }

    if (isAltPaletteEvent(event)) {
      event.preventDefault();
      cycleAlternatePalette();
      return;
    }

    cycleStandardTheme();
  }

  function clearLongPressTimer() {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handlePointerDown(event) {
    if (event.pointerType === "mouse") return;
    longPressFired = false;
    clearLongPressTimer();

    longPressTimer = window.setTimeout(() => {
      longPressFired = true;
      suppressClick = true;
      cycleAlternatePalette();
    }, 650);
  }

  function handlePointerUp() {
    clearLongPressTimer();
  }

  function handlePointerCancel() {
    clearLongPressTimer();
  }

  button.addEventListener("click", handleButtonClick);
  button.addEventListener("pointerdown", handlePointerDown);
  button.addEventListener("pointerup", handlePointerUp);
  button.addEventListener("pointercancel", handlePointerCancel);
  button.addEventListener("pointerleave", handlePointerCancel);

  media.addEventListener?.("change", () => {
    if (theme === "system") {
      applyTheme();
    }
  });

  applyTheme();

  return {
    getTheme() {
      return theme;
    },
    getPalette() {
      return palette;
    },
    getResolvedTheme() {
      return resolveTheme(theme);
    },
    setTheme(nextTheme, options = {}) {
      setTheme(nextTheme, options);
    }
  };
}