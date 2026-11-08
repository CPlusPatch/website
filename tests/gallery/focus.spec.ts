import { expect, test } from "./fixtures.ts";
import { stories } from "./stories.ts";

/**
 * Everything in a story that Tab reaches shows that it has focus. Shows
 * means an outline, shadow or border changes when focus arrives: on the
 * element, on the boxes around it (a hidden radio's label), or inside it
 * (a button whose ring is on its body), or on their ::before or ::after
 * (a link that covers its card).
 */
const PRESSES = 40;

for (const story of stories) {
    test(story.id, async ({ page }) => {
        await page.goto(story.path);
        await page.locator("#main").evaluate((main) => {
            main.tabIndex = -1;
            main.focus();
        });
        const unseen: string[] = [];
        for (let i = 0; i < PRESSES; i++) {
            await page.keyboard.press("Tab");
            const seen = await page.evaluate(() => {
                const el = document.activeElement as HTMLElement | null;
                if (!el?.closest("#main") || el.id === "main") return null;
                const boxes: Element[] = [el, ...el.querySelectorAll("*")];
                for (
                    let up = el.parentElement;
                    up && up.id !== "main" && boxes.length < 400;
                    up = up.parentElement
                ) {
                    boxes.push(up);
                }
                const looks = () =>
                    boxes
                        .flatMap((box) =>
                            [undefined, "::before", "::after"].map((pseudo) => {
                                const s = getComputedStyle(box, pseudo);
                                return `${s.outline} ${s.boxShadow} ${s.borderColor}`;
                            }),
                        )
                        .join("|");
                const focused = looks();
                el.blur();
                const blurred = looks();
                el.focus();
                return focused === blurred ? el.outerHTML.slice(0, 120) : "";
            });
            if (seen === null) break;
            if (seen) unseen.push(seen);
        }
        expect(unseen).toEqual([]);
    });
}
