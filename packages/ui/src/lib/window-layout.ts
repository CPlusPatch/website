/**
 * Where windows go and which one is on top, for the window manager. Pure, so
 * it's tested without a DOM: the manager measures, calls these, and writes
 * the results back as styles.
 *
 * Every rect is in CSS pixels, relative to the desktop's top-left corner.
 *
 * @module
 */

/** A width and height. */
export type Size = { width: number; height: number };

/** A box at a position. */
export type Rect = Size & { x: number; y: number };

/** How new windows step down and right from the first one. */
export type Cascade = {
    /** Where the first window opens. */
    origin: { x: number; y: number };
    /** How far each next window moves along both axes. */
    step: number;
};

export const DEFAULT_CASCADE: Cascade = { origin: { x: 24, y: 24 }, step: 32 };

/**
 * How much of a dragged window must stay on the desktop, in pixels: enough of
 * its title bar to grab it again.
 */
export const GRIP = 48;

/** A size shrunk to fit the desktop, if it doesn't. */
export const fit = (size: Size, desktop: Size): Size => ({
    width: Math.min(size.width, desktop.width),
    height: Math.min(size.height, desktop.height),
});

/**
 * The `index`th spot along the cascade for a window of `size`. The cascade
 * starts over at the origin once a window would cross the desktop's far edge,
 * and a window too big for the origin is fitted and opens at 0, 0.
 */
export const cascadeAt = (
    index: number,
    size: Size,
    desktop: Size,
    { origin, step }: Cascade = DEFAULT_CASCADE,
): Rect => {
    const fitted = fit(size, desktop);
    const room = Math.min(
        desktop.width - fitted.width - origin.x,
        desktop.height - fitted.height - origin.y,
    );

    if (room < 0) {
        return { x: 0, y: 0, ...fitted };
    }

    const slots = Math.floor(room / step) + 1;
    const offset = (index % slots) * step;

    return { x: origin.x + offset, y: origin.y + offset, ...fitted };
};

/**
 * Where a new window opens: the first spot along the cascade that no open
 * window's corner sits on, so a new window never hides one exactly.
 */
export const place = (
    size: Size,
    desktop: Size,
    open: readonly Rect[],
    cascade: Cascade = DEFAULT_CASCADE,
): Rect => {
    const taken = (rect: Rect) =>
        open.some((o) => o.x === rect.x && o.y === rect.y);

    // Past open.length spots, at least one is free, unless the cascade wraps
    // sooner: then every spot is taken and the first will do.
    for (let index = 0; index <= open.length; index++) {
        const rect = cascadeAt(index, size, desktop, cascade);

        if (!taken(rect)) {
            return rect;
        }
    }

    return cascadeAt(0, size, desktop, cascade);
};

/**
 * A rect moved, and shrunk if it must be, so its title bar stays on the
 * desktop: the top edge on screen, and at least `grip` pixels of its width.
 * Used after a drag and when the desktop resizes.
 */
export const clamp = (rect: Rect, desktop: Size, grip: number = GRIP): Rect => {
    const { width, height } = fit(rect, desktop);
    const reach = Math.min(grip, width);

    return {
        x: Math.min(Math.max(rect.x, reach - width), desktop.width - reach),
        y: Math.min(
            Math.max(rect.y, 0),
            desktop.height - Math.min(grip, height),
        ),
        width,
        height,
    };
};

/**
 * The windows from bottom to top, by id. The last one is on top and has
 * focus.
 */
export type Stack = readonly string[];

/** The stack with `id` brought to the top, opening it if it wasn't open. */
export const raise = (stack: Stack, id: string): Stack => [
    ...stack.filter((w) => w !== id),
    id,
];

/** The stack without `id`. */
export const remove = (stack: Stack, id: string): Stack =>
    stack.filter((w) => w !== id);

/** The window on top, which gets focus after another closes. */
export const top = (stack: Stack): string | undefined => stack.at(-1);
