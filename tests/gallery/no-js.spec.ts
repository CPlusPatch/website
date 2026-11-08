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

test("the Display menu changes the scheme and theme", async ({ page }) => {
    await page.goto("/gallery/");
    const background = () =>
        page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.getByRole("button", { name: "Display" }).click();
    const pick = (name: string, value: string) =>
        page
            .locator(`label:has(input[name="${name}"][value="${value}"])`)
            .click();
    await pick("scheme", "light");
    const light = await background();
    await pick("scheme", "dark");
    const dark = await background();
    expect(dark).not.toBe(light);

    await pick("theme", "nord");
    expect(await background()).not.toBe(dark);
});
