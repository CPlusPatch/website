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

for (const form of ["Edit", "Burn"]) {
    test(`has no axe violations with the ${form.toLowerCase()} form open`, async ({
        page,
    }) => {
        await openOrbits(page);
        await selectBody(page, "Mars");
        await page
            .getByRole("region", { name: "Selected body" })
            .getByRole("button", { name: form })
            .click();

        const { violations } = await new AxeBuilder({ page }).analyze();

        expect(
            violations.map(({ id, nodes }) => ({
                id,
                targets: nodes.map(({ target }) => target),
            })),
        ).toEqual([]);
    });
}
