import type { Page } from "@playwright/test";
import { expect, test } from "../gallery/fixtures.ts";
import { openOrbits, selectBody } from "./orbits.ts";

/**
 * The things a person does in the Orrery: pick a body, edit it, burn it,
 * add one, switch scenario and search. Each ends with a clean console.
 *
 * Mars is the body to change: its period only moves when its orbit does,
 * where its distance and speed move with the clock.
 */
const card = (page: Page) =>
    page.getByRole("region", { name: "Selected body" });

const period = (page: Page) =>
    card(page)
        .locator(".orrery__headline-grid div")
        .filter({ hasText: "Period" })
        .locator("dd");

test("the inspector shows the selected body and follows a child chip", async ({
    page,
    problems,
}) => {
    await openOrbits(page);

    await selectBody(page, "Mars");
    await expect(card(page)).toContainText("Planet around Sun");
    await card(page).getByRole("button", { name: "Mars Odyssey" }).click();

    await expect(
        card(page).getByRole("heading", { name: "Mars Odyssey", level: 2 }),
    ).toBeVisible();
    await expect(card(page)).toContainText("around Mars");
    // It has no moons or stats, and the empty body would leave a gap above the actions.
    await expect(card(page).locator(".orrery__inspector-body")).toBeHidden();
    expect(problems).toEqual([]);
});

test("editing the semi-major axis changes the period", async ({
    page,
    problems,
}) => {
    await openOrbits(page);
    await selectBody(page, "Mars");
    const before = await period(page).innerText();

    await card(page).getByRole("button", { name: "Edit" }).click();
    await page.getByRole("spinbutton", { name: "Semi-major axis" }).fill("2");
    await card(page).getByRole("button", { name: "Apply" }).click();

    await expect(period(page)).not.toHaveText(before);
    expect(problems).toEqual([]);
});

test("a prograde burn changes the period", async ({ page, problems }) => {
    await openOrbits(page);
    await selectBody(page, "Mars");
    const before = await period(page).innerText();

    await card(page).getByRole("button", { name: "Burn" }).click();
    await page.getByRole("spinbutton", { name: "Prograde" }).fill("500");
    await card(page).getByRole("button", { name: "Apply" }).click();

    await expect(period(page)).not.toHaveText(before);
    expect(problems).toEqual([]);
});

test("Esc in an edit field closes the form and focuses Edit", async ({
    page,
    problems,
}) => {
    await openOrbits(page);
    await selectBody(page, "Mars");

    await card(page).getByRole("button", { name: "Edit" }).click();
    const field = page.getByRole("spinbutton", { name: "Semi-major axis" });
    await expect(field).toBeFocused();
    await field.press("Escape");

    await expect(field).toHaveCount(0);
    await expect(
        card(page).getByRole("heading", { name: "Mars", level: 2 }),
    ).toBeVisible();
    await expect(
        card(page).getByRole("button", { name: "Edit" }),
    ).toBeFocused();
    expect(problems).toEqual([]);
});

test("an invalid eccentricity shows its error and keeps the form open", async ({
    page,
    problems,
}) => {
    await openOrbits(page);
    await selectBody(page, "Mars");

    await card(page).getByRole("button", { name: "Edit" }).click();
    const field = page.getByRole("spinbutton", { name: "Eccentricity" });
    await field.fill("1.5");
    // The error shows on blur, and it moves the Apply button, so click only after.
    await field.blur();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await card(page).getByRole("button", { name: "Apply" }).click();

    await expect(field).toBeFocused();
    await expect(
        card(page).getByRole("button", { name: "Apply" }),
    ).toBeVisible();
    expect(problems).toEqual([]);
});

test("a burn needs a value, and Cancel resumes the clock it paused", async ({
    page,
    problems,
}) => {
    await openOrbits(page);
    await selectBody(page, "Mars");
    // The tests run with reduced motion, so the clock starts held.
    await page.getByRole("button", { name: "Held. Run time" }).click();
    await expect(
        page.getByRole("button", { name: "Running. Hold time" }),
    ).toBeVisible();

    await card(page).getByRole("button", { name: "Burn" }).click();
    const apply = card(page).getByRole("button", { name: "Apply" });
    await expect(apply).toBeDisabled();
    await page.getByRole("spinbutton", { name: "Prograde" }).fill("10");

    await expect(apply).toBeEnabled();
    await expect(
        page.getByRole("button", { name: "Held. Run time" }),
    ).toBeVisible();
    await card(page).getByRole("button", { name: "Cancel" }).click();

    await expect(
        card(page).getByRole("button", { name: "Burn" }),
    ).toBeFocused();
    await expect(
        page.getByRole("button", { name: "Running. Hold time" }),
    ).toBeVisible();
    expect(problems).toEqual([]);
});

test("a body can be added and is then selected", async ({ page, problems }) => {
    await openOrbits(page);

    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("button", { name: "Add a body…" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Vulcan");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(
        card(page).getByRole("heading", { name: "Vulcan", level: 2 }),
    ).toBeVisible();
    expect(problems).toEqual([]);
});

test("removing a moon keeps its planet and selects it", async ({
    page,
    problems,
}) => {
    await openOrbits(page);

    await selectBody(page, "Mars Odyssey");
    await card(page).getByRole("button", { name: "Remove" }).click();
    await card(page)
        .getByRole("group", { name: "Remove Mars Odyssey?" })
        .getByRole("button", { name: "Remove" })
        .click();

    await expect(
        card(page).getByRole("heading", { name: "Mars", level: 2 }),
    ).toBeVisible();
    await expect(
        card(page).getByRole("button", { name: "Mars Odyssey" }),
    ).toHaveCount(0);
    await expect(card(page).locator(".orrery__orbit-focus")).toBeFocused();
    expect(problems).toEqual([]);
});

test("a built-in scenario can be loaded", async ({ page, problems }) => {
    await openOrbits(page);

    await page.getByRole("button", { name: "Scenarios" }).click();
    await page
        .getByRole("button", { name: "Load Gargantua (Interstellar)" })
        .click();

    await expect(
        page
            .getByRole("navigation", { name: "Focus" })
            .getByRole("button", { name: "Gargantua" }),
    ).toBeVisible();
    await selectBody(page, "Miller's planet");
    expect(problems).toEqual([]);
});

test("search opens with / and a clicked result is selected", async ({
    page,
    problems,
}) => {
    await openOrbits(page);

    await page.keyboard.press("/");
    await page.getByRole("combobox", { name: "Find a body" }).fill("Odyssey");
    await page.getByRole("option", { name: /Mars Odyssey/ }).click();

    await expect(
        card(page).getByRole("heading", { name: "Mars Odyssey", level: 2 }),
    ).toBeVisible();
    expect(problems).toEqual([]);
});

test("the crumbs follow the focus and keep keyboard focus when clicked", async ({
    page,
    problems,
}) => {
    await openOrbits(page);
    const crumbs = page.getByRole("navigation", { name: "Focus" });
    const buttons = crumbs.getByRole("button");

    await selectBody(page, "Moon");
    await card(page).getByRole("button", { name: "Focus" }).click();

    await expect(buttons).toHaveText(["Sun", "Earth", "Moon"]);
    await expect(crumbs.locator("[aria-current]")).toHaveCount(1);
    await expect(buttons.nth(2)).toHaveAttribute("aria-current", "location");

    await buttons.nth(1).focus();
    await buttons.nth(1).click();

    await expect(buttons.nth(1)).toHaveAttribute("aria-current", "location");
    await expect(crumbs.locator("[aria-current]")).toHaveCount(1);
    await expect(buttons.nth(1)).toBeFocused();
    expect(problems).toEqual([]);
});
