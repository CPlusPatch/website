import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../gallery/fixtures.ts";
import { openOrbits, selectBody } from "./orbits.ts";

/** The loaded page, with the inspector open, has no axe violations. */
test("has no axe violations", async ({ page }) => {
    await openOrbits(page);
    await selectBody(page, "Mars");

    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(
        violations.map(({ id, nodes }) => ({
            id,
            targets: nodes.map(({ target }) => target),
        })),
    ).toEqual([]);
});
