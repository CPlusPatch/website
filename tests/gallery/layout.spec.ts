import { PREVIEW_WIDTHS } from "../../src/gallery/widths.ts";
import { expect, test } from "./fixtures.ts";
import { stories } from "./stories.ts";

/**
 * No story is wider than the page at any of the gallery's preview widths:
 * the page never scrolls sideways. A story that must be wider scrolls
 * inside itself.
 */
const WIDTHS = PREVIEW_WIDTHS.flatMap((w) =>
    "width" in w ? [{ id: w.id, px: Number.parseFloat(w.width) * 16 }] : [],
);

for (const story of stories) {
    test(story.id, async ({ page }) => {
        await page.goto(story.path);
        for (const { id, px } of WIDTHS) {
            await page.setViewportSize({ width: px, height: 800 });
            const over = await page.evaluate(() => {
                const width = document.documentElement.clientWidth;
                if (document.documentElement.scrollWidth <= width) return [];
                // The outermost boxes that stick out, outside any box that
                // scrolls or clips them, to say where to look.
                const out = (el: Element) =>
                    el.getBoundingClientRect().right > width + 0.5;
                const contained = (el: Element) => {
                    for (
                        let up = el.parentElement;
                        up?.id !== "main";
                        up = up?.parentElement ?? null
                    ) {
                        if (!up) return false;
                        if (getComputedStyle(up).overflowX !== "visible")
                            return true;
                    }
                    return false;
                };
                const culprits = [
                    ...document.querySelectorAll("#main *"),
                ].filter(
                    (el) =>
                        out(el) &&
                        !contained(el) &&
                        !(
                            el.parentElement &&
                            el.parentElement.id !== "main" &&
                            out(el.parentElement)
                        ),
                );
                const named = culprits
                    .slice(0, 3)
                    .map((el) => el.className || el.tagName);
                return named.length ? named : ["the page"];
            });
            expect(over, `at ${id} (${px}px)`).toEqual([]);
        }
    });
}
