import { test as base, type Page } from "@playwright/test";

/**
 * Makes the viewport as tall as the page, so every story is on screen:
 * scripts that wait to be scrolled to start, and lazy images load.
 */
export const showAll = async (page: Page) => {
    const height = await page.evaluate(
        () => document.documentElement.scrollHeight,
    );
    const width = page.viewportSize()?.width ?? 1280;
    await page.setViewportSize({ width, height: Math.min(height, 16_000) });
};

/**
 * Pages that never leave the preview server: anything off-origin (the live
 * stories' feeds) is refused, so a run doesn't depend on the network and the
 * stories show what they show when their feed is down.
 *
 * `problems` gathers what a page complained about while it was open:
 * console errors, uncaught exceptions, and its own requests that failed.
 */
export const test = base.extend<{ problems: string[] }>({
    page: async ({ page, baseURL }, use) => {
        const origin = new URL(baseURL ?? "").origin;
        await page.route(
            (url) => url.origin !== origin,
            (route) => route.abort("blockedbyclient"),
        );
        await use(page);
    },
    problems: async ({ page, baseURL }, use) => {
        const origin = new URL(baseURL ?? "").origin;
        const ours = (url: string) => url.startsWith(origin);
        const problems: string[] = [];
        page.on("console", (message) => {
            // A refused feed is logged too; that one is on us, not the page.
            if (message.type() === "error" && ours(message.location().url)) {
                problems.push(`console: ${message.text()}`);
            }
        });
        page.on("pageerror", (error) => problems.push(`uncaught: ${error}`));
        page.on("requestfailed", (request) => {
            // Media is fetched in ranges and dropped when it has enough.
            if (!ours(request.url()) || request.resourceType() === "media") {
                return;
            }
            problems.push(
                `request: ${request.url()} ${request.failure()?.errorText}`,
            );
        });
        await use(problems);
    },
});

export { expect } from "@playwright/test";
