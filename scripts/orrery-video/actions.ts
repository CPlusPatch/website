import type { Page } from "@playwright/test";

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Something a shot does from its cue, spread over `frames` frames. */
export type Action = {
    frames: number;
    run: (page: Page, frame: number) => Promise<void>;
};

const framesIn = (seconds: number) => Math.max(1, Math.round(seconds * FPS));

/**
 * Clears the canvas hover. A pointer move with no button held hovers the label under it, which
 * expands into a list of its neighbours, and it stays until the next move.
 */
export const unhover = (page: Page): Promise<void> =>
    page.locator(".orrery__canvas canvas").dispatchEvent("pointerleave");

/** Anything on one frame: a click, a typed value, a menu. */
export const act = (run: (page: Page) => Promise<void>): Action => ({
    frames: 1,
    run: (page) => run(page),
});

export const key = (name: string): Action =>
    act((page) => page.keyboard.press(name));

/**
 * Drags on the canvas from the centre, by `dx`/`dy` px over `seconds`, at a constant speed: an
 * ease reads as a stop in a shot this short. Cue it before 0 to cut in on a moving camera.
 */
export const drag = ({
    dx = 0,
    dy = 0,
    seconds,
    from = [WIDTH / 2, HEIGHT / 2],
}: {
    dx?: number;
    dy?: number;
    seconds: number;
    from?: [number, number];
}): Action => {
    const frames = framesIn(seconds);
    const [x, y] = from;

    return {
        frames,
        run: async (page, frame) => {
            if (frame === 0) {
                await page.mouse.move(x, y);
                await unhover(page);
                await page.mouse.down();
            }

            const k = frames === 1 ? 1 : frame / (frames - 1);
            await page.mouse.move(x + dx * k, y + dy * k);

            if (frame === frames - 1) await page.mouse.up();
        },
    };
};

/**
 * Turns the wheel on the canvas, `notches` in all (negative zooms in), spread evenly over `seconds`.
 * The camera zooms on the focused body, not the pointer.
 */
export const wheel = ({
    notches,
    seconds,
}: {
    notches: number;
    seconds: number;
}): Action => {
    const frames = framesIn(seconds);
    const step = (notches * 100) / frames;

    return {
        frames,
        run: async (page, frame) => {
            if (frame === 0) {
                await page.mouse.move(WIDTH / 2, HEIGHT / 2);
                await unhover(page);
            }
            await page.mouse.wheel(0, step);
        },
    };
};
