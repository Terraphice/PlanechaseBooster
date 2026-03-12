// ── changelog.js ──────────────────────────────────────────────────────────────
// Fetches the latest GitHub release and shows a "What's New" panel once per
// release version. The last-seen version is persisted in localStorage.

const LAST_SEEN_KEY = "planar-atlas-last-seen-version";
const RELEASES_API = "https://api.github.com/repos/Terraphice/PlanarAtlas/releases/latest";

export function initChangelog() {
  const overlay = document.getElementById("changelog-overlay");
  const backdrop = document.getElementById("changelog-backdrop");
  const closeBtn = document.getElementById("changelog-close");
  const dismissBtn = document.getElementById("changelog-dismiss");
  const versionEl = document.getElementById("changelog-version");
  const bodyEl = document.getElementById("changelog-body");

  if (!overlay || !bodyEl) return;

  function closeChangelog() {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("changelog-open");
  }

  function dismiss(version) {
    try { localStorage.setItem(LAST_SEEN_KEY, version); } catch { /* ignore */ }
    closeChangelog();
  }

  closeBtn?.addEventListener("click", () => {
    const version = versionEl?.dataset.version || "";
    if (version) dismiss(version);
    else closeChangelog();
  });
  dismissBtn?.addEventListener("click", () => {
    const version = versionEl?.dataset.version || "";
    if (version) dismiss(version);
    else closeChangelog();
  });
  backdrop?.addEventListener("click", closeChangelog);
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeChangelog();
  });

  fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((release) => {
      const tag = release.tag_name || "";
      const version = tag.startsWith("v") ? tag.slice(1) : tag;
      if (!version) return;

      const lastSeen = (() => { try { return localStorage.getItem(LAST_SEEN_KEY); } catch { return null; } })();
      if (lastSeen === version) return;

      const rawBody = release.body || "No release notes available.";
      const safeHtml = (typeof DOMPurify !== "undefined" && typeof marked !== "undefined")
        ? DOMPurify.sanitize(marked.parse(rawBody))
        : escapeHtml(rawBody);

      if (versionEl) {
        versionEl.textContent = tag;
        versionEl.dataset.version = version;
      }
      bodyEl.innerHTML = safeHtml;

      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("changelog-open");
      dismissBtn?.focus();
    })
    .catch(() => {
      // Silently fail if GitHub API is unreachable (offline, rate-limited, no releases)
    });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
