// tests/e2e/gallery.spec.js
// Playwright E2E tests for the Planar Atlas gallery page.
// Validates that the page loads, cards render, search works, and the modal opens.

import { test, expect } from "@playwright/test";

test.describe("Gallery", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#gallery", { state: "attached" });
  });

  test("page loads with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Planar Atlas/);
  });

  test("gallery renders card elements", async ({ page }) => {
    // Wait for cards to appear (they load asynchronously via fetch)
    const gallery = page.locator("#gallery");
    await expect(gallery).toBeVisible();

    // Cards should render within the gallery host
    const cards = gallery.locator(".card-item, .card-wrap, .grid-item, img");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test("sidebar search input is present", async ({ page }) => {
    const searchInput = page.locator("#sidebar-search");
    await expect(searchInput).toBeAttached();
  });

  test("theme button exists and is interactive", async ({ page }) => {
    const themeBtn = page.locator("#theme-toggle");
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    // Theme should change — the button text cycles between ◐, ☾, ☀
    const btnText = await themeBtn.textContent();
    expect(["◐", "☾", "☀"].some((icon) => btnText.includes(icon))).toBeTruthy();
  });

  test("deck button is visible", async ({ page }) => {
    const deckBtn = page.locator("#deck-button");
    await expect(deckBtn).toBeVisible();
  });

  test("no JavaScript errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("card modal opens on card click", async ({ page }) => {
    // Wait for gallery to populate
    const firstCard = page.locator("#gallery img").first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });

    await firstCard.click();

    // Modal should become visible
    const modal = page.locator("#card-modal");
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });

  test("sidebar can be toggled", async ({ page }) => {
    const sidebar = page.locator("#sidebar");
    const lip = page.locator("#sidebar-lip");

    await expect(sidebar).toBeAttached();
    await expect(lip).toBeVisible();

    // Click lip to expand sidebar
    await lip.click();

    // Sidebar should no longer be collapsed
    await expect(sidebar).not.toHaveClass(/collapsed/, { timeout: 3000 });
  });
});
