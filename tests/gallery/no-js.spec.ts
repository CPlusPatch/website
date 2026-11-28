import { expect, test } from "./fixtures.ts";
import { stories } from "./stories.ts";

/**
 * Without JavaScript, every story still shows something, keeps hidden what
 * its markup hides (the controls a script reveals: a class setting
 * `display` beats the bare `[hidden]` rule), and its <details> still open.
 */
test.use({ javaScriptEnabled: false });

for (const story of stories) {
    test(story.id, async ({ page }) => {
        await page.goto(story.path);
        const preview = page.locator("#main .story-preview");
        const box = await preview.boundingBox();
        expect(box?.width, "story has width").toBeGreaterThan(0);
        expect(box?.height, "story has height").toBeGreaterThan(0);

        const shown = await preview.evaluate((root) =>
            [...root.querySelectorAll("[hidden]")]
                .filter((element) => element.checkVisibility())
                .map((element) => element.outerHTML.slice(0, 120)),
        );
        expect(shown, "[hidden] elements that show").toEqual([]);

        // Handles, not locators: opening one changes which match
        for (const summary of await preview
            .locator("details:not([open]) > summary")
            .elementHandles()) {
            if (!(await summary.isVisible())) continue;
            await summary.click();
            expect(
                await summary.evaluate((s) =>
                    s.parentElement?.hasAttribute("open"),
                ),
                "a <details> opens",
            ).toBe(true);
        }
    });
}

test("the scheme switch changes the page's colours", async ({ page }) => {
    await page.goto("/gallery/");
    const background = () =>
        page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    const pick = (value: string) =>
        page
            .locator("header")
            .getByRole("group", { name: "Page colours" })
            .locator(`label:has(input[value="${value}"])`)
            .click();
    await pick("light");
    const light = await background();
    await pick("dark");
    expect(await background()).not.toBe(light);
});

test("the index shows every component, and no filter", async ({ page }) => {
    await page.goto("/gallery/");
    await expect(page.locator(".gallery-filter")).toBeHidden();
    await expect(page.locator(".gallery-index__empty")).toBeHidden();
    const cards = page.locator(".gallery-card");
    await expect(page.locator(".gallery-card:visible")).toHaveCount(
        await cards.count(),
    );
});

test("a story link in the list loads its page into the stage", async ({
    page,
}) => {
    await page.goto("/gallery/buttons/");
    await page
        .getByRole("navigation", { name: "Stories" })
        .getByRole("link", { name: "sm", exact: true })
        .click();
    await expect(page.locator('iframe[name="stage"]')).toHaveCount(1);
    await expect
        .poll(() => page.frames().map((f) => new URL(f.url()).pathname))
        .toContain("/gallery/story/button-size/sm/");
    await expect(page).toHaveURL(/\/gallery\/buttons\/$/);
});
