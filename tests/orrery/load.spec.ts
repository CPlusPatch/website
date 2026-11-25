import { expect, test } from "../gallery/fixtures.ts";
import { openOrbits } from "./orbits.ts";

/**
 * The Orrery loads: the loading state goes away, the cards are usable, and
 * the page logs no errors and makes no failed requests.
 */
test("loads without problems", async ({ page, problems }) => {
    await openOrbits(page);

    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(page.locator(".orrery__canvas canvas")).toBeVisible();

    expect(problems).toEqual([]);
});
