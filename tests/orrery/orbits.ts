import { expect, type Page } from "@playwright/test";

/**
 * Opens /orbits/ and waits until the loading state is gone and the cards
 * take clicks (they're inert until the first frames are in).
 */
export const openOrbits = async (page: Page) => {
    await page.goto("/orbits/");
    // The app gives up waiting for its assets after 8 s, and WebGL runs in software here
    await expect(page.locator(".orrery__loading")).toHaveCount(0, {
        timeout: 20_000,
    });
    await expect(page.locator(".orrery__panel--top")).toBeVisible();
    await expect(page.locator(".orrery__panel[inert]")).toHaveCount(0);
};

/** Selects a body with the search, the way a person would: `/`, a name, Enter. */
export const selectBody = async (page: Page, name: string) => {
    await page.keyboard.press("/");
    await page.getByRole("combobox", { name: "Find a body" }).fill(name);
    await page.keyboard.press("Enter");
    await expect(
        page
            .getByRole("region", { name: "Selected body" })
            .getByRole("heading", { name, level: 2 }),
    ).toBeVisible();
};
