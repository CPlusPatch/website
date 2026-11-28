import { PREVIEW_WIDTHS } from "../../src/gallery/widths.ts";
import { expect, test } from "./fixtures.ts";
import { stories } from "./stories.ts";

/**
 * No story is wider than the page at any of the gallery's preview widths:
 * the page never scrolls sideways. A story that must be wider scrolls
 * inside itself.
 */
const WIDTHS = PREVIEW_WIDTHS.map((w) => ({
    id: w.id,
    px: Number.parseFloat(w.width) * 16,
}));

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

/** Stories known to hold a button with an icon and a one-line label. */
const MEASURED_ICON_LABELS = new Set([
    "button-variant/default",
    "button-size/icon-end",
]);

/**
 * An icon in a button is centred on its label's capital letters, not on the
 * line box, which carries the font's empty space below the baseline.
 */
for (const story of stories) {
    test(`${story.id} centres a button's icon on its label's capitals`, async ({
        page,
    }) => {
        await page.goto(story.path);
        const off = await page.evaluate(() => {
            const canvas = document.createElement("canvas").getContext("2d");
            if (!canvas) throw new Error("no canvas");
            const results: string[] = [];
            let checked = 0;
            for (const button of document.querySelectorAll(
                ".button:not([aria-busy='true'])",
            )) {
                const svg = button.querySelector(":scope > svg");
                const text = [...button.childNodes].find(
                    (node) =>
                        node.nodeType === Node.TEXT_NODE &&
                        node.textContent?.trim(),
                );
                if (!svg || !text) continue;

                const range = document.createRange();
                range.selectNodeContents(text);
                // The text's content area, which starts at the font's ascent.
                const lines = range.getClientRects();
                // The icon sits beside the whole block of a wrapped label.
                const first = lines[0];
                if (lines.length !== 1 || !first) continue;
                const top = first.top;
                const style = getComputedStyle(button);
                const size = Number.parseFloat(style.fontSize);
                canvas.font = style.font;
                // Layout rounds the ascent like this, and the range's top includes it.
                const ascent = canvas.measureText("H").fontBoundingBoxAscent;
                // Canvas rounds a glyph's height to whole pixels, so measure it large and scale it.
                canvas.font = `${style.fontWeight} 1000px ${style.fontFamily}`;
                const capHeight =
                    (canvas.measureText("H").actualBoundingBoxAscent / 1000) *
                    size;
                const cap = top + ascent - capHeight / 2;
                const box = svg.getBoundingClientRect();
                const icon = box.top + box.height / 2;
                checked += 1;
                if (Math.abs(icon - cap) > 0.5) {
                    results.push(
                        `${button.className}: icon ${icon.toFixed(2)}, capitals ${cap.toFixed(2)}`,
                    );
                }
            }
            return { results, checked };
        });
        expect(off.results).toEqual([]);
        // Guards against the selectors above matching nothing.
        if (MEASURED_ICON_LABELS.has(story.id)) {
            expect(off.checked).toBeGreaterThan(0);
        }
    });
}
