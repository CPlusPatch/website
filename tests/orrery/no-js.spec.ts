import { expect, test } from "../gallery/fixtures.ts";

/**
 * Without JavaScript the page says so, and doesn't show a loading state
 * that would never end.
 */
test.use({ javaScriptEnabled: false });

test("asks for JavaScript instead of loading", async ({ page }) => {
    await page.goto("/orbits/");

    await expect(page.locator(".orrery__notice")).toContainText(
        "Turn on JavaScript",
    );
    await expect(page.locator(".orrery__loading")).not.toBeVisible();
});
