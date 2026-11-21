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
 * this share of its own width. Narrower than that, the content starts to
 * crop, so the windows overlap instead.
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

/** Whether two rects share any area. Touching edges don't count. */
const overlaps = (a: Rect, b: Rect) =>
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;

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

/** Whether the rect's left or top edge sits in a sliver's distance of the other's. */
const slivered = (rect: Rect, other: Rect) => {
    const dx = Math.abs(rect.x - other.x);
    const dy = Math.abs(rect.y - other.y);

    if ((dx > 0 && dx < SLIVER) || (dy > 0 && dy < SLIVER)) return true;

    return (dx === 0 || dy === 0) && overlaps(rect, other);
};

/**
 * Whether `GRIP` pixels of the other window's title bar, or all of it if it's
 * narrower, show with `rect` on top. A bar is as tall as a cascade step.
 */
const barShows = (rect: Rect, other: Rect, { step }: Cascade) => {
    const bar = { ...other, height: step };
    if (!overlaps(rect, bar)) return true;

    const left = Math.max(0, Math.min(rect.x, bar.x + bar.width) - bar.x);
    const right = Math.max(
        0,
        bar.x + bar.width - Math.max(rect.x + rect.width, bar.x),
    );

    return Math.max(left, right) >= Math.min(GRIP, bar.width);
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
 *    open window.
 * 2. With no free room, it goes over the others, one step down and right of
 *    the top window. When that has too little room, it starts a new column
 *    at the top, moved right a step for each one before it. The first column
 *    is at the origin.
 *
 * Over the others, no left or top edge lands within `SLIVER` pixels of
 * another window's, and `GRIP` pixels of every other title bar stay
 * visible. If no spot has both, the second is given up, since a window with
 * room is worth more than a bar that shows. If nothing has the room, it
 * opens at the first spot with the minimum.
 */
export const place = (
    size: Size,
    desktop: Size,
    open: readonly Rect[],
    cascade: Cascade = DEFAULT_CASCADE,
): Rect => {
    const { origin, step, min } = cascade;
    const corner = origin;
    const least: Size = {
        width: Math.min(size.width, Math.ceil(desktop.width * SHARE)),
        height: Math.min(size.height, Math.ceil(desktop.height * SHARE)),
    };
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
    for (const spot of free) {
        if (!roomy(spot, least)) continue;

        const rect = fittedAt(spot, size, desktop, cascade);
        if (!open.some((o) => overlaps(rect, o) || slivered(rect, o))) {
            return rect;
        }
    }

    const spots: Spot[] = [];
    const last = open.at(-1);
    if (last) {
        for (let n = 1; last.x + n * step < desktop.width; n++) {
            spots.push(spotAlong(last, n, step));
        }
    }
    for (let n = 0; corner.x + n * step < desktop.width; n++) {
        for (let m = 0; corner.y + m * step < desktop.height; m++) {
            spots.push({ x: corner.x + n * step, y: corner.y + m * step });
        }
    }

    const fits = spots
        .filter((spot) => roomy(spot, least))
        .map((spot) => fittedAt(spot, size, desktop, cascade))
        .filter((rect) => !open.some((o) => slivered(rect, o)));
    const shown = fits.find((rect) =>
        open.every((o) => barShows(rect, o, cascade)),
    );
    const found = shown ?? fits[0];
    if (found) return found;

    const usable = spots.find((spot) => roomy(spot, min));

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
 *   minimum width or `NARROWEST` of their own, whichever is more. Windows of
 *   one width get one width.
 * - If they still don't fit, they overlap evenly: the first at the origin,
 *   the last ending at the far margin, each stepped down a cascade step from
 *   the one before so every title bar shows. If the left edges can't each
 *   show `GRIP` pixels, they cascade from the origin.
 */
export const arrange = (
    sizes: readonly Size[],
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

    // Narrow the widest first: each takes its share of what's left, or less.
    const available = room.width - gaps;
    const floors = natural.map((width, i) =>
        Math.min(
            width,
            Math.max(min.width, Math.ceil(NARROWEST * sizes[i].width)),
        ),
    );
    if (floors.reduce((sum, width) => sum + width, 0) <= available) {
        const widths = [...natural];
        let left = available;
        let count = widths.length;
        const order = widths
            .map((_, i) => i)
            .sort((a, b) => widths[a] - widths[b]);
        while (order.length) {
            // Windows of one width take the same share.
            const group = order.filter((i) => natural[i] === natural[order[0]]);
            const share = Math.floor(left / count);
            for (const i of group) {
                widths[i] = Math.min(natural[i], Math.max(floors[i], share));
                left -= widths[i];
            }
            count -= group.length;
            order.splice(0, group.length);
        }

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
