import { expect, showAll, test } from "./fixtures.ts";
import { groups } from "./stories.ts";

/**
 * Every story loads without errors: nothing in the console, nothing thrown,
 * no request of its own failing. A group at a time, all of it on screen,
 * given a moment after load for the scripts that start on a timer or when
 * they're scrolled to. To find the story at fault, open it alone, at
 * /gallery/story/<group>/<story>/.
 */
for (const group of groups) {
    test(group.id, async ({ page, problems }) => {
        await page.goto(group.path);
        await showAll(page);
        await page.waitForTimeout(500);
        expect(problems).toEqual([]);
    });
}
