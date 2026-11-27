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

test("Ctrl+Z undoes a burn and the Redo button applies it again", async ({
    page,
    problems,
}) => {
    await openOrbits(page);
    await selectBody(page, "Mars");
    const before = await period(page).innerText();
    await card(page).getByRole("button", { name: "Burn" }).click();
    await page.getByRole("spinbutton", { name: "Prograde" }).fill("500");
    await card(page).getByRole("button", { name: "Apply" }).click();
    await expect(period(page)).not.toHaveText(before);
    const after = await period(page).innerText();

    await page.keyboard.press("Control+z");

    await expect(period(page)).toHaveText(before);

    await page.getByRole("button", { name: "Redo" }).click();

    await expect(period(page)).toHaveText(after);
    expect(problems).toEqual([]);
});

test("undo closes an open Edit form, so its stale draft can't be applied", async ({
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
    await card(page).getByRole("button", { name: "Edit" }).click();

    await page.getByRole("button", { name: "Undo" }).click();

    await expect(card(page).getByRole("button", { name: "Apply" })).toHaveCount(
        0,
    );
    await expect(period(page)).toHaveText(before);
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

const runButton = (page: Page) =>
    page.getByRole("button", { name: /^(Running\. Hold|Held\. Run) time$/ });

const rateButton = (page: Page) => page.locator(".orrery__rate");

const dateEditor = (page: Page) =>
    page.getByRole("region", { name: "Set the date" });

const shownDate = (page: Page) => page.locator(".orrery__clock time");

/** Opens the editor with T and sets a date in 2030. */
const jumpTo2030 = async (page: Page) => {
    await page.keyboard.press("t");
    await expect(dateEditor(page)).toBeVisible();
    await dateEditor(page).getByRole("textbox", { name: "Year" }).fill("2030");
    await dateEditor(page).getByRole("textbox", { name: "Month" }).fill("06");
    await dateEditor(page).getByRole("textbox", { name: "Day" }).fill("15");
    await dateEditor(page).getByRole("button", { name: "Go to date" }).click();
};

test("the run button toggles between running and held", async ({
    page,
    problems,
}) => {
    await openOrbits(page);
    // Reduced motion starts the clock held, so read the state first.
    const first = (await runButton(page).getAttribute("aria-label")) ?? "";
    const other =
        first === "Held. Run time" ? "Running. Hold time" : "Held. Run time";

    await runButton(page).click();

    await expect(runButton(page)).toHaveAccessibleName(other);

    await runButton(page).click();

    await expect(runButton(page)).toHaveAccessibleName(first);
    expect(problems).toEqual([]);
});

test("the rate menu opens with arrows, picks with Enter and closes with Esc", async ({
    page,
    problems,
}) => {
    await openOrbits(page);
    await selectBody(page, "Mars");
    const before = await rateButton(page).innerText();
    const menu = page.getByRole("menu", { name: "Time warp" });

    await rateButton(page).focus();
    await page.keyboard.press("ArrowDown");

    await expect(menu).toBeVisible();
    await expect(rateButton(page)).toHaveAttribute("aria-expanded", "true");
    await expect(
        menu.getByRole("menuitemradio", { checked: true }),
    ).toBeFocused();

    await page.keyboard.press("ArrowUp");
    const picked = await page.locator(":focus").innerText();
    await page.keyboard.press("Enter");

    await expect(menu).toBeHidden();
    await expect(rateButton(page)).toBeFocused();
    await expect(rateButton(page)).not.toHaveText(before);
    await expect(rateButton(page)).toHaveText(picked);

    await page.keyboard.press("ArrowDown");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(menu).toBeHidden();
    await expect(rateButton(page)).toBeFocused();
    await expect(rateButton(page)).toHaveAttribute("aria-expanded", "false");
    await expect(card(page)).toBeVisible();
    expect(problems).toEqual([]);
});

test("the date editor sets the clock, and Esc and a bad month keep it as it was", async ({
    page,
    problems,
}) => {
    await openOrbits(page);

    await jumpTo2030(page);

    await expect(dateEditor(page)).toBeHidden();
    await expect(shownDate(page)).toHaveAttribute("datetime", /^2030-06-15T/);

    // Reduced motion starts the clock held, and Esc has to put back a running one.
    await runButton(page).click();
    await expect(runButton(page)).toHaveAccessibleName("Running. Hold time");

    await page.keyboard.press("t");
    await expect(dateEditor(page)).toBeVisible();
    await expect(runButton(page)).toHaveAccessibleName("Held. Run time");
    await page.keyboard.press("Escape");

    await expect(dateEditor(page)).toBeHidden();
    await expect(runButton(page)).toHaveAccessibleName("Running. Hold time");

    await page.keyboard.press("t");
    await dateEditor(page).getByRole("textbox", { name: "Month" }).fill("13");
    await dateEditor(page).getByRole("button", { name: "Go to date" }).click();

    await expect(page.locator("#orrery-date-error")).toBeVisible();
    await expect(dateEditor(page)).toBeVisible();
    expect(problems).toEqual([]);
});

test("Go live shows after a date jump and returns to the real time", async ({
    page,
    problems,
}) => {
    await openOrbits(page);
    const goLive = page.locator(".orrery__go-live");
    const chip = page.locator(".orrery__date-live");

    // The clock starts at the scenario's date, not the real time.
    await expect(goLive).toBeVisible();
    await expect(chip).toBeHidden();

    await goLive.click();

    await expect(goLive).toBeHidden();
    await expect(chip).toBeVisible();

    await jumpTo2030(page);

    await expect(goLive).toBeVisible();
    await expect(chip).toBeHidden();

    await goLive.click();

    await expect(goLive).toBeHidden();
    await expect(chip).toBeVisible();
    expect(problems).toEqual([]);
});

test("dismissing a notice with the keyboard focuses the Scenarios button", async ({
    page,
    problems,
}) => {
    await openOrbits(page);

    await page.evaluate(() => {
        location.hash = "#s=not-a-scenario";
    });
    const dismiss = page.getByRole("button", { name: "Dismiss" });
    await dismiss.focus();
    await page.keyboard.press("Enter");

    await expect(dismiss).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Scenarios" })).toBeFocused();
    expect(problems).toEqual([]);
});
