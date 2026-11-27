import AxeBuilder from "@axe-core/playwright";
import { MAX_TEXT } from "../../src/gallery/controls.ts";
import { expect, test } from "./fixtures.ts";
import { type Story, stories } from "./stories.ts";

/**
 * Every controlled story's live page, stepped through its controls the way
 * the bench does: one load, then a `gallery-play` message per step. Each
 * choice and boolean combination is checked, with the other controls at
 * their defaults, then each text control at its longest. A step must pass
 * axe and leave the page loaded, and the page must stay free of errors.
 */
type Control = NonNullable<Story["controls"]>[number];
type Values = Record<string, string | boolean>;

const WORDS = "Lorem ipsum dolor sit amet ";

/** Every choice and boolean combination, then each text control at MAX_TEXT. */
const steps = (controls: Control[]): Values[] => {
    const defaults = Object.fromEntries(
        controls.map(({ key, value }) => [key, value]),
    );
    const combinations = controls.reduce<Values[]>(
        (rows, control) => {
            const options =
                control.kind === "choice"
                    ? (control.values ?? [])
                    : control.kind === "boolean"
                      ? [true, false]
                      : [];

            return options.length === 0
                ? rows
                : rows.flatMap((row) =>
                      options.map((value) => ({
                          ...row,
                          [control.key]: value,
                      })),
                  );
        },
        [defaults],
    );
    const long = controls
        .filter(({ kind }) => kind === "text")
        .map(({ key }) => ({
            ...defaults,
            [key]: WORDS.repeat(MAX_TEXT).slice(0, MAX_TEXT),
        }));

    return [...combinations, ...long];
};

/** What the bench sends: the values that aren't defaults, in control order. */
const query = (controls: Control[], values: Values) => {
    const params = new URLSearchParams();
    for (const { key, value } of controls) {
        if (values[key] !== value) params.set(key, String(values[key]));
    }

    return params.toString();
};

for (const story of stories.filter(({ play }) => play)) {
    const { controls = [], id, play } = story;

    test(id, async ({ page, problems }) => {
        test.setTimeout(120_000);
        await page.goto(`${play}?scheme=light`);
        // A message sent before the island hydrates has no listener.
        await page.waitForSelector("astro-island:not([ssr])");
        await page.evaluate(() => {
            (window as Window & { marker?: boolean }).marker = true;
        });

        const found: string[] = [];
        for (const values of steps(controls)) {
            const sent = query(controls, values);
            const search = `?scheme=light${sent && `&${sent}`}`;
            await page.evaluate((query) => {
                window.postMessage(
                    { type: "gallery-play", query },
                    location.origin,
                );
            }, sent);
            await page.waitForFunction(
                (search) => location.search === search,
                search,
            );
            // The URL changes before Svelte flushes the DOM.
            await page.evaluate(() => new Promise(requestAnimationFrame));

            const { violations } = await new AxeBuilder({ page })
                .include(".story-preview")
                .analyze();
            for (const { id, nodes } of violations) {
                found.push(`${search}: ${id} at ${nodes.map((n) => n.target)}`);
            }
            const marker = await page.evaluate(
                () => (window as Window & { marker?: boolean }).marker,
            );
            if (marker !== true) found.push(`${search}: the page reloaded`);
        }

        expect(found).toEqual([]);
        expect(problems).toEqual([]);
    });
}
