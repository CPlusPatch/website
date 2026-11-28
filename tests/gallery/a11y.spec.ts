import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures.ts";
import { groups } from "./stories.ts";

/**
 * Every story passes axe in light and dark, and in two themes whose colours
 * stray furthest from the default. A group at a time: each run covers the
 * group's stories and nothing of the gallery around them, and says which
 * story each problem is in. The gallery's own pages get one run each,
 * whole. The other engines check the light look only: colours come out the
 * same in all three, so there they're after the names and roles each
 * engine works out.
 */
const LOOKS = [
    "scheme=light",
    "scheme=dark",
    "theme=solarized&scheme=light",
    "theme=dracula&scheme=dark",
];

/**
 * Rules a group's page breaks only by holding all its stories at once, by
 * group id.
 */
const TOGETHER: Record<string, string[]> = {
    // Each story is a region named "Compare".
    "bench-compare": ["landmark-unique"],
    // A navbar per story, each with the same "Main" nav.
    navbar: ["landmark-unique"],
    // Each story is a section named "README".
    window: ["landmark-unique"],
};

/**
 * Groups whose stories frame a story page, which has no <h1> (see
 * STORY_PAGE), by group id.
 */
const FRAMED: Record<string, string[]> = {
    "bench-stage": ["page-has-heading-one"],
};

for (const group of groups) {
    for (const look of LOOKS) {
        test(`${group.id} ${look}`, async ({ page, browserName }) => {
            test.skip(browserName !== "chromium" && look !== LOOKS[0]);
            await page.goto(`${group.path}?${look}`);
            const { violations } = await new AxeBuilder({ page })
                .include("[data-story] .story-preview")
                .disableRules([
                    ...(TOGETHER[group.id] ?? []),
                    ...(FRAMED[group.id] ?? []),
                ])
                .analyze();
            const found: string[] = [];
            for (const { id, nodes } of violations) {
                for (const { target } of nodes) {
                    const story = await page
                        .locator(String(target[0]))
                        .first()
                        .evaluate(
                            (el) =>
                                el.closest<HTMLElement>("[data-story]")?.dataset
                                    .story,
                        );
                    found.push(`${story}: ${id} at ${JSON.stringify(target)}`);
                }
            }
            expect(found).toEqual([]);
        });
    }
}

/**
 * Allowed, for every page under /gallery/story/: no <h1>. Those pages are
 * a story and nothing else, whose headings start where its real page would
 * have them; a heading above them would only throw their order off.
 */
const STORY_PAGE = ["page-has-heading-one"];

for (const path of [
    "/gallery/",
    "/gallery/buttons/",
    "/gallery/code/",
    "/gallery/story/message/",
    "/gallery/story/code/shell/",
]) {
    test(`page ${path}`, async ({ page }) => {
        await page.goto(path);
        const { violations } = await new AxeBuilder({ page })
            .disableRules(path.startsWith("/gallery/story/") ? STORY_PAGE : [])
            .analyze();
        expect(violations.map(summary)).toEqual([]);
    });
}

test("the bench passes with the icon list open", async ({ page }) => {
    await page.goto("/gallery/buttons/#button-variant/default");
    const icon = page.getByRole("combobox", { name: "icon" });
    await icon.focus();
    await icon.press("ArrowDown");
    await expect(page.getByRole("listbox", { name: "icon" })).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(summary)).toEqual([]);
});

const summary = (v: { id: string; nodes: { target: unknown }[] }) =>
    `${v.id}: ${v.nodes.map((n) => JSON.stringify(n.target)).join(" ")}`;
