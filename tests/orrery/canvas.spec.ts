import { expect, test } from "../gallery/fixtures.ts";
import { openOrbits } from "./orbits.ts";

/**
 * The default view looks the same as the baseline. The baseline isn't in git:
 * make it on a clean tree with `--update-snapshots`, then run again after a change.
 * The clock is faked, so the simulated time and the frame steps don't depend on
 * how fast the page loaded.
 */
test.skip(!!process.env.CI, "There's no baseline in CI");
// WebGL runs in software, at a few frames a second
test.setTimeout(120_000);

test("the default view matches the baseline", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-24T00:00:00Z") });
    await openOrbits(page);

    await page.clock.pauseAt(new Date("2026-11-24T00:01:00Z"));
    await page.clock.runFor(2000);

    await expect(page).toHaveScreenshot("default.png", {
        maxDiffPixelRatio: 0.01,
        timeout: 60_000,
    });
});
