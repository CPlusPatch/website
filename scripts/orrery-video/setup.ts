import type { Page } from "@playwright/test";
import { drag, FPS, unhover } from "./actions.ts";

/** The clock rates the `[` and `]` keys step through, in seconds per second. */
const RATES = [1, 60, 3600, 86400, 604800, 2629800, 31557600];

/** Runs the app's clock for `seconds`, one frame at a time, without filming. */
export const settle = async (page: Page, seconds: number): Promise<void> => {
    for (let i = 0; i < Math.round(seconds * FPS); i++) {
        await page.clock.runFor(1000 / FPS);
    }
};

/** Picks a body the way a person would: `/`, its name, Enter. */
export const pick = async (page: Page, name: string): Promise<void> => {
    await page.keyboard.press("/");
    await page.getByRole("combobox", { name: "Find a body" }).fill(name);
    await page.keyboard.press("Enter");
    await page
        .getByRole("region", { name: "Selected body" })
        .getByRole("heading", { name, level: 2 })
        .waitFor();
};

/** Moves the camera to the selected body with the card's Focus button. */
export const focusSelected = (page: Page): Promise<void> =>
    page
        .getByRole("region", { name: "Selected body" })
        .getByRole("button", { name: "Focus", exact: true })
        .click();

/** Picks a body, moves the camera to it and lets the glide finish. */
export const focus = async (page: Page, name: string): Promise<void> => {
    await pick(page, name);
    await focusSelected(page);
    await settle(page, 2);
};

/** Sets the clock rate to one of `RATES`, from the bottom of the list up. */
export const rate = async (
    page: Page,
    secondsPerSecond: number,
): Promise<void> => {
    const index = RATES.indexOf(secondsPerSecond);
    if (index < 0) throw new Error(`No preset rate of ${secondsPerSecond} s/s`);

    for (let i = 0; i < RATES.length; i++) await page.keyboard.press("[");
    for (let i = 0; i < index; i++) await page.keyboard.press("]");
};

/** Turns the wheel `notches` times on the canvas (negative zooms in), then lets the camera settle. */
export const zoom = async (page: Page, notches: number): Promise<void> => {
    await page.mouse.move(960, 540);
    await unhover(page);
    for (let i = 0; i < Math.abs(notches); i++) {
        await page.mouse.wheel(0, Math.sign(notches) * 100);
        await page.clock.runFor(1000 / FPS);
    }
    await settle(page, 1);
};

/** Drags the camera by `dx`/`dy` px without filming, then lets it settle. */
export const turn = async (
    page: Page,
    dx: number,
    dy: number,
): Promise<void> => {
    const move = drag({ dx, dy, seconds: 0.5 });
    for (let frame = 0; frame < move.frames; frame++) {
        await move.run(page, frame);
        await page.clock.runFor(1000 / FPS);
    }
    await settle(page, 1);
};

/** Closes the card and drops focus, so no button shows a focus ring on camera. */
export const deselect = async (page: Page): Promise<void> => {
    await page.keyboard.press("Escape");
    await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
    );
};
