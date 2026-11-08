import type { Page } from "@playwright/test";
import { expect, showAll, test } from "./fixtures.ts";
import { groups, tagged } from "./stories.ts";

/**
 * Stories hold still when asked to, and say so when they won't. A group at
 * a time, all of it on screen, each story judged by its own cell.
 *
 * With reduced motion (the config's default), every story is still: no CSS
 * animation left running, and nothing in it changing a moment later. That
 * catches the JS-driven ones too (a count-up, autoplay), which
 * getAnimations() can't see.
 *
 * With motion on, a story that isn't tagged `animated` settles after its
 * entrance: the promise screenshot tests rely on.
 */
interface Look {
    running: string[];
    html: string;
    playing: boolean[];
}

/** Each story's cell as it is now, by story id; "page" for anything else. */
const look = (page: Page) =>
    page.evaluate(() => {
        const looks: Record<string, Look> = {};
        const at = (id: string) => {
            looks[id] ??= { running: [], html: "", playing: [] };
            return looks[id];
        };
        for (const cell of document.querySelectorAll<HTMLElement>(
            "[data-story]",
        )) {
            const story = at(cell.dataset.story ?? "");
            story.html = cell.innerHTML;
            story.playing = [...cell.querySelectorAll("video")].map(
                (v) => v.paused,
            );
        }
        for (const animation of document.getAnimations()) {
            if (animation.playState !== "running") continue;
            const target = (animation.effect as KeyframeEffect | null)?.target;
            const cell = target?.closest<HTMLElement>("[data-story]");
            const name =
                (animation as CSSAnimation).animationName ??
                (animation as CSSTransition).transitionProperty;
            at(cell?.dataset.story ?? "page").running.push(
                `${name} on ${target?.className || target?.tagName}`,
            );
        }
        return looks;
    });

/** What moved, between two looks a moment apart, in the given stories. */
const moved = (
    first: Record<string, Look>,
    second: Record<string, Look>,
    ids: string[],
) =>
    ids.flatMap((id) => {
        const [a, b] = [first[id], second[id]];
        if (!a || !b) return [];
        return [
            ...a.running.map((r) => `${id}: still running ${r}`),
            ...(a.html === b.html ? [] : [`${id}: changed after load`]),
            ...(`${a.playing}` === `${b.playing}`
                ? []
                : [`${id}: video started or stopped`]),
        ];
    });

for (const group of groups) {
    const ids = group.stories.map((story) => story.id);
    test(`${group.id} reduced`, async ({ page }) => {
        await page.goto(group.path);
        await showAll(page);
        await page.waitForTimeout(750);
        const first = await look(page);
        await page.waitForTimeout(1000);
        const second = await look(page);
        expect(moved(first, second, [...ids, "page"])).toEqual([]);
    });

    const still = group.stories
        .filter((story) => !tagged(story, "animated"))
        .map((story) => story.id);
    if (!still.length) continue;
    test(`${group.id} settles`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.goto(group.path);
        await showAll(page);
        await page.waitForTimeout(750);
        const first = await look(page);
        await page.waitForTimeout(1000);
        const second = await look(page);
        expect(moved(first, second, still)).toEqual([]);
    });
}
