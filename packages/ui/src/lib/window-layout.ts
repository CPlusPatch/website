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

/** A size with the narrowest its content can be, if it's known. */
export type Floored = Size & {
    /** The narrowest its content fits in: narrower and it overflows or crops. */
    floor?: number;
};

/** A box at a position. */
export type Rect = Size & { x: number; y: number };

/** How new windows step down and right from the first one. */
export type Cascade = {
    /**
     * Where the first window opens. Also the margin kept at every edge of the
     * desktop, so no window sits flush with one, and the gap between windows
     * arranged side by side.
     */
    origin: { x: number; y: number };
    /** How far each next window moves along both axes. */
    step: number;
    /**
     * The least room a spot must have left for a window to open there. The
     * same as `--window-min-width` and `--window-min-height` in
     * components/window-manager.css.
     */
    min: Size;
};

export const DEFAULT_CASCADE: Cascade = {
    origin: { x: 24, y: 24 },
    step: 32,
    min: { width: 256, height: 160 },
};

/**
 * The room a window's focus ring needs outside its frame: the 2px outline at
 * a 2px offset in components/window.css. The desktop clips what's outside it,
 * so a window can't go closer to the top or left edge than this.
 */
export const FOCUS_RING = 4;

/**
 * How far `arrange` narrows a window to fit it beside another: no less than
 * this share of its own width, and no less than its content fits in
 * (`Floored.floor`). Narrower than either, the content starts to crop,
 * so the windows overlap instead.
 */
const NARROWEST = 0.75;

/**
 * How much of a dragged window must stay on the desktop, in pixels: enough of
 * its title bar to show beside the close button, and to grab it again.
 */
export const GRIP = 96;

/** A size shrunk to fit the desktop, if it doesn't. */
export const fit = (size: Size, desktop: Size): Size => ({
    width: Math.min(size.width, desktop.width),
    height: Math.min(size.height, desktop.height),
});

type Spot = { x: number; y: number };

/** The `index`th spot along a cascade that starts at `from`. */
const spotAlong = (from: Spot, index: number, step: number): Spot => ({
    x: from.x + index * step,
    y: from.y + index * step,
});

/** The room left at a spot, with a margin of the origin at the far edges. */
const roomAt = ({ x, y }: Spot, desktop: Size, { origin }: Cascade): Size => ({
    width: Math.max(0, desktop.width - x - origin.x),
    height: Math.max(0, desktop.height - y - origin.y),
});

/**
 * A window of `size` at a spot, shrunk to the room left there, but not below
 * the minimum size. A desktop with no room can't leave a window of nothing,
 * so it's never bigger than the desktop.
 */
const fittedAt = (
    spot: Spot,
    size: Size,
    desktop: Size,
    cascade: Cascade,
): Rect => {
    const { width, height } = fit(size, roomAt(spot, desktop, cascade));

    return {
        ...spot,
        ...fit(
            {
                width: Math.max(width, cascade.min.width),
                height: Math.max(height, cascade.min.height),
            },
            desktop,
        ),
    };
};

/** The area two rects share. Touching edges share none. */
const overlapArea = (a: Rect, b: Rect) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/** Whether two rects share any area. Touching edges don't count. */
const overlaps = (a: Rect, b: Rect) =>
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;

/**
 * Whether two rects overlap by less than `GRIP` on either axis: a thin strip
 * of one over the other, which reads as a mistake and hides little.
 */
const grazes = (a: Rect, b: Rect) =>
    overlaps(a, b) &&
    (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) < GRIP ||
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) < GRIP);

/**
 * How close two edges can be before they read as a mistake: a doubled border
 * with a sliver between. Equal edges are fine, unless the windows overlap.
 */
const SLIVER = 16;

/**
 * The share of the desktop's width and height a new window gets, if its own
 * size is more.
 */
const SHARE = 0.6;

/**
 * How much more covering the window a new one was opened from counts than
 * covering another. The reader is using it, so it should stay readable.
 */
const OPENER_WEIGHT = 4;

/**
 * How much worse than the best spot's cost another can be and still win, if
 * it comes first: a slightly better spot isn't worth losing the line-up with
 * the windows already open.
 */
const TOLERANCE = 0.05;

/** Whether the rect's left or top edge sits in a sliver's distance of the other's. */
const slivered = (rect: Rect, other: Rect) => {
    const dx = Math.abs(rect.x - other.x);
    const dy = Math.abs(rect.y - other.y);

    if ((dx > 0 && dx < SLIVER) || (dy > 0 && dy < SLIVER)) return true;

    return (dx === 0 || dy === 0) && overlaps(rect, other);
};

/**
 * Whether `GRIP` pixels of the other window's title bar, or all of it if it's
 * narrower, show with `rect` on top. A bar is as tall as a cascade step. With
 * `leftEnd`, those pixels must be the left ones, where its icon and title are.
 */
const barShows = (
    rect: Rect,
    other: Rect,
    { step }: Cascade,
    leftEnd = false,
) => {
    const bar = { ...other, height: step };
    if (!overlaps(rect, bar)) return true;

    const grip = Math.min(GRIP, bar.width);
    if (leftEnd) return !overlaps(rect, { ...bar, width: grip });

    const left = Math.max(0, Math.min(rect.x, bar.x + bar.width) - bar.x);
    const right = Math.max(
        0,
        bar.x + bar.width - Math.max(rect.x + rect.width, bar.x),
    );

    return Math.max(left, right) >= grip;
};

/**
 * Where a new window opens. `size` is its natural size and `open` the windows
 * already on the desktop, from bottom to top. It gets at least `SHARE` of
 * the desktop's width and height, or its own size if that's less, and is
 * shrunk to the room left at its spot but not below the minimum size.
 *
 * 1. Free room first: the margin corner, and the spots just right of and
 *    just below each open window, a gap of the origin away. The first one
 *    from top to bottom and then left to right where the window overlaps no
 *    open window. A spot with room for `NARROWEST` of the window's size,
 *    or the share above if that's less, will do, and it's shrunk to fit.
 * 2. With no free room, it goes over the others. The cascade spots are off
 *    the opener, then off each other window from the top down. The grid
 *    spots are steps from the origin, with the left edges of the open
 *    windows and the gaps right of them added. Each spot also tries a copy
 *    shrunk to stop a gap short of a window it overlaps from the left or
 *    from above, down to `NARROWEST` of the window's size.
 *
 * A candidate costs the share of the window that's over others, plus the share
 * of its natural area lost to shrinking. The first one within `TOLERANCE` of
 * the cheapest in its tier wins, so with nothing clearly better the window
 * lines up with the opener or the top window.
 *
 * `opener` is the index in `open` of the window the reader opened this one
 * from. Covering it counts `OPENER_WEIGHT` times as much, and the left
 * `GRIP` pixels of its title bar stay visible.
 *
 * Over the others, no left or top edge lands within `SLIVER` pixels of
 * another window's. The tiers, best first, are: `GRIP` pixels of every other
 * title bar stay visible and no window is grazed (overlapped by less than
 * `GRIP` on either axis), then every bar shows, then anything that fits. The
 * cascade spots are tried first, and the grid spots only if none of them is
 * in the first tier. If nothing has the room, it opens at the first spot with
 * the minimum.
 */
export const place = (
    size: Size,
    desktop: Size,
    open: readonly Rect[],
    cascade: Cascade = DEFAULT_CASCADE,
    opener?: number,
): Rect => {
    const { origin, step, min } = cascade;
    const corner = origin;
    const least: Size = {
        width: Math.min(size.width, Math.ceil(desktop.width * SHARE)),
        height: Math.min(size.height, Math.ceil(desktop.height * SHARE)),
    };
    const natural = fit(size, roomAt(corner, desktop, cascade));
    // The smallest a window shrinks to, from `of`, to line up or to fit.
    const narrowed = (of: Size): Size => ({
        width: Math.max(min.width, Math.ceil(NARROWEST * of.width)),
        height: Math.max(min.height, Math.ceil(NARROWEST * of.height)),
    });
    const roomy = (spot: Spot, enough: Size) => {
        const room = roomAt(spot, desktop, cascade);

        return room.width >= enough.width && room.height >= enough.height;
    };

    const free = [
        corner,
        ...open.flatMap((o) => [
            { x: o.x + o.width + origin.x, y: o.y },
            { x: o.x, y: o.y + o.height + origin.y },
        ]),
    ].sort((a, b) => a.y - b.y || a.x - b.x);
    // A quarter off its natural size, but never asked for more than `least`.
    const shrinkable: Size = {
        width: Math.min(least.width, narrowed(natural).width),
        height: Math.min(least.height, narrowed(natural).height),
    };
    for (const spot of free) {
        if (!roomy(spot, shrinkable)) continue;

        const rect = fittedAt(spot, size, desktop, cascade);
        if (!open.some((o) => overlaps(rect, o) || slivered(rect, o))) {
            return rect;
        }
    }

    const cascaded: Spot[] = [];
    const cascadeOff = (from: Rect) => {
        for (let n = 1; from.x + n * step < desktop.width; n++) {
            cascaded.push(spotAlong(from, n, step));
        }
    };
    const from = opener === undefined ? undefined : open[opener];
    if (from) cascadeOff(from);
    for (let i = open.length - 1; i >= 0; i--) {
        if (i !== opener) cascadeOff(open[i]);
    }
    const xs = [
        ...new Set([
            ...Array.from(
                { length: Math.ceil((desktop.width - corner.x) / step) },
                (_, n) => corner.x + n * step,
            ),
            ...open.flatMap((o) => [o.x, o.x + o.width + origin.x]),
        ]),
    ].sort((a, b) => a - b);
    const gridded: Spot[] = [];
    for (const x of xs) {
        for (let m = 0; corner.y + m * step < desktop.height; m++) {
            gridded.push({ x, y: corner.y + m * step });
        }
    }

    const shrunkTo = narrowed(natural);
    const candidates = (spots: Spot[]) =>
        spots
            .filter((spot) => roomy(spot, least))
            .map((spot) => fittedAt(spot, size, desktop, cascade))
            .filter((rect) => !open.some((o) => slivered(rect, o)))
            .flatMap((rect) => {
                // Shrunk to stop a gap short of a window it overlaps, right
                // after the rect it comes from.
                const clear = open.flatMap((o) => {
                    if (!overlaps(rect, o)) return [];

                    const copies: Rect[] = [];
                    const width = o.x - origin.x - rect.x;
                    const height = o.y - origin.y - rect.y;
                    if (rect.x < o.x && width >= shrunkTo.width) {
                        copies.push({ ...rect, width });
                    }
                    if (rect.y < o.y && height >= shrunkTo.height) {
                        copies.push({ ...rect, height });
                    }

                    return copies;
                });

                return [rect, ...clear];
            });
    const naturalArea = Math.max(1, natural.width * natural.height);
    const cost = (rect: Rect) =>
        open.reduce(
            (sum, o, i) =>
                sum + overlapArea(rect, o) * (i === opener ? OPENER_WEIGHT : 1),
            0,
        ) /
            Math.max(1, rect.width * rect.height) +
        Math.max(0, 1 - (rect.width * rect.height) / naturalArea);
    // The first within the tolerance of the cheapest, so the cascade order
    // breaks near ties.
    // Undefined for no rects.
    const cheapest = (rects: Rect[]): Rect | undefined => {
        const costs = rects.map(cost);
        const limit = Math.min(...costs) + TOLERANCE;

        return rects[costs.findIndex((c) => c <= limit)];
    };
    // Tiers, best first: every bar shows and nothing is grazed, every bar
    // shows, anything. The first tier with a candidate in it is used.
    const tiers = (rects: Rect[]) => {
        const shown = rects.filter((rect) =>
            open.every((o, i) => barShows(rect, o, cascade, i === opener)),
        );
        const clean = shown.filter(
            (rect) => !open.some((o) => grazes(rect, o)),
        );

        return { clean, shown, all: rects };
    };
    const choose = ({ clean, shown, all }: ReturnType<typeof tiers>) =>
        cheapest(clean.length > 0 ? clean : shown.length > 0 ? shown : all);

    const along = candidates(cascaded);
    const cascades = tiers(along);
    const lined = cascades.clean.length > 0 ? choose(cascades) : undefined;
    if (lined) return lined;

    const found = choose(tiers([...along, ...candidates(gridded)]));
    if (found) return found;

    const usable = [...cascaded, ...gridded].find((spot) => roomy(spot, min));

    return fittedAt(usable ?? corner, size, desktop, cascade);
};

/**
 * Where a set of windows go when a desktop starts with them open. `sizes` is
 * from bottom to top, like the `open` of `place`, and so are the rects it
 * returns. The origin is the margin at every edge, and its x is the gap
 * between windows. Each is shrunk to the room there, but not below the
 * minimum size.
 *
 * Side by side, the top window is on the left. Overlapping, the windows take
 * the slots in stack order, so the top one is last, furthest down and right,
 * and every title bar behind it shows.
 *
 * - If they fit side by side, they sit along the top, the top window at the
 *   origin, and the room left over goes to the right.
 * - If not, the widest are narrowed evenly until they do, down to the
 *   minimum width, `NARROWEST` of their own or their `floor`, whichever is
 *   most, but never past their own width. Windows of one width get one width.
 * - If those floors don't fit either, they overlap evenly: the first at the origin,
 *   the last ending at the far margin, each stepped down a cascade step from
 *   the one before so every title bar shows. If the left edges can't each
 *   show `GRIP` pixels, they cascade from the origin.
 */
export const arrange = (
    sizes: readonly Floored[],
    desktop: Size,
    cascade: Cascade = DEFAULT_CASCADE,
): Rect[] => {
    const { origin, min, step } = cascade;
    const room = {
        width: Math.max(0, desktop.width - 2 * origin.x),
        height: Math.max(0, desktop.height - 2 * origin.y),
    };
    // Not narrower than the minimum, but never wider than the desktop.
    const natural = sizes.map(({ width }) =>
        Math.min(
            Math.max(Math.min(width, room.width), min.width),
            desktop.width,
        ),
    );
    // The window at `y`, as tall as the room below it allows.
    const rectAt = (i: number, x: number, y: number, width: number): Rect => ({
        x,
        y,
        width,
        height: Math.min(
            Math.max(
                Math.min(sizes[i].height, desktop.height - y - origin.y),
                min.height,
            ),
            desktop.height,
        ),
    });
    // From the top window, on the left, to the bottom one.
    const row = (widths: number[], left: number) => {
        const rects: Rect[] = [];
        let x = left;

        for (let i = widths.length - 1; i >= 0; i--) {
            rects[i] = rectAt(i, x, origin.y, widths[i]);
            x += widths[i] + origin.x;
        }

        return rects;
    };

    const gaps = origin.x * Math.max(0, natural.length - 1);
    const used = natural.reduce((sum, width) => sum + width, 0) + gaps;
    if (used <= room.width) return row(natural, origin.x);

    const available = room.width - gaps;
    const floors = natural.map((width, i) =>
        Math.min(
            width,
            Math.max(
                min.width,
                Math.ceil(NARROWEST * sizes[i].width),
                sizes[i].floor ?? 0,
            ),
        ),
    );
    if (floors.reduce((sum, width) => sum + width, 0) <= available) {
        // The widest level every window is cut to, but not below its floor.
        // Windows of one width and floor get one width.
        const at = (level: number) =>
            natural.map((width, i) =>
                Math.min(width, Math.max(floors[i], level)),
            );
        const total = (widths: number[]) =>
            widths.reduce((sum, width) => sum + width, 0);
        let level = Math.max(...natural);
        while (total(at(level)) > available) level--;
        const widths = at(level);

        return row(widths, origin.x);
    }

    // Spread from the first at the origin to the last at the far margin, and
    // never past the far margin on the way.
    const farEdge = desktop.width - origin.x;
    const last = natural.length - 1;
    const span = farEdge - (natural.at(-1) ?? 0) - origin.x;
    const xs = natural.map((width, i) =>
        Math.max(
            origin.x,
            Math.min(
                Math.round(origin.x + (i * span) / Math.max(1, last)),
                farEdge - width,
            ),
        ),
    );
    const grips = natural.every(
        (width, i) => i === last || xs[i + 1] - xs[i] >= Math.min(GRIP, width),
    );
    if (grips) {
        return natural.map((width, i) =>
            rectAt(i, xs[i], origin.y + i * step, width),
        );
    }

    return sizes.map((size, i) =>
        fittedAt(spotAlong(origin, i, step), size, desktop, cascade),
    );
};

/**
 * A rect moved, and shrunk if it must be, so its title bar stays on the
 * desktop. It can't pass the left or top edge, short of the room a focus ring
 * needs (`ring`). At the right and bottom, `grip` pixels of it stay. Used
 * while dragging.
 */
export const clamp = (
    rect: Rect,
    desktop: Size,
    grip: number = GRIP,
    ring: number = FOCUS_RING,
): Rect => {
    const { width, height } = fit(rect, desktop);

    return {
        x: Math.min(
            Math.max(rect.x, ring),
            desktop.width - Math.min(grip, width),
        ),
        y: Math.min(
            Math.max(rect.y, ring),
            desktop.height - Math.min(grip, height),
        ),
        width,
        height,
    };
};

/**
 * A rect resized from its bottom-right corner by `by`, which is negative to
 * shrink. Each side stays between the minimum size and the room left to the
 * desktop's far edge, less the margin. A window already past that edge keeps
 * the size it has, so growing it does nothing, but it can still shrink. The
 * same room is written as `--window-max-width` and `--window-max-height`, so
 * the keys stop where the native handle does.
 */
export const resize = (
    rect: Rect,
    by: Size,
    desktop: Size,
    cascade: Cascade = DEFAULT_CASCADE,
): Rect => {
    const { origin, min } = cascade;
    const side = (
        size: number,
        change: number,
        least: number,
        room: number,
    ) => {
        const most = Math.max(room, size);

        return Math.max(least, Math.min(size + change, most));
    };

    return {
        ...rect,
        width: side(
            rect.width,
            by.width,
            Math.min(min.width, desktop.width),
            desktop.width - origin.x - rect.x,
        ),
        height: side(
            rect.height,
            by.height,
            Math.min(min.height, desktop.height),
            desktop.height - origin.y - rect.y,
        ),
    };
};

/**
 * A rect brought fully onto the desktop, with a margin of the origin at every
 * edge if it fits with one. If it's too big for that, it's shrunk to fit
 * inside the margins, but not below the minimum size. Used when the desktop
 * resizes, on the rect the window is meant to have, so growing the desktop
 * back restores it.
 */
export const reveal = (
    rect: Rect,
    desktop: Size,
    cascade: Cascade = DEFAULT_CASCADE,
): Rect => {
    const { origin, min } = cascade;
    const room = {
        width: Math.max(0, desktop.width - 2 * origin.x),
        height: Math.max(0, desktop.height - 2 * origin.y),
    };
    const width = Math.min(
        rect.width,
        Math.max(room.width, Math.min(min.width, desktop.width)),
    );
    const height = Math.min(
        rect.height,
        Math.max(room.height, Math.min(min.height, desktop.height)),
    );
    const marginX = width <= room.width ? origin.x : 0;
    const marginY = height <= room.height ? origin.y : 0;

    return {
        width,
        height,
        x: Math.max(marginX, Math.min(rect.x, desktop.width - width - marginX)),
        y: Math.max(
            marginY,
            Math.min(rect.y, desktop.height - height - marginY),
        ),
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
