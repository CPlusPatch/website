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
