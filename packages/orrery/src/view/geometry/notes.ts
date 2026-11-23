/**
 * @module
 * Where the notes and text blocks of a picked orbit go, clear of the line and each other.
 */

import type { Rect } from "./labels.ts";

/** A picked orbit shows its apsides and numbers when its semi-major axis is over this many px. */
export const READOUTS_MIN_ORBIT_PX = 120;

/** The px a note's backing extends past its text on each side. */
export const NOTE_PAD_PX = 2;

/** The height of a note's box in px. */
export const NOTE_HEIGHT_PX = 14;

/** The px between a note beside an apsis and the apsis. */
const NOTE_APSIS_GAP_PX = 9;

/** The gap of the notes tried last, which clear the orbit's own line from any direction. */
const NOTE_APSIS_FAR_GAP_PX = 17;

/** The room in px under a picked tag that labels leave for its speed and period block. */
export const READOUT_BLOCK_PX = { width: 130, height: 32 };

/** The px between a tag's edge and the first line of a note block. */
const NOTE_BLOCK_GAP_PX = 9;

/** The note's box when its text is `width` px wide and centred on (`x`, `y`). */
export const noteBox = (x: number, y: number, width: number): Rect => ({
    left: x - width / 2 - NOTE_PAD_PX,
    top: y - NOTE_HEIGHT_PX / 2,
    right: x + width / 2 + NOTE_PAD_PX,
    bottom: y + NOTE_HEIGHT_PX / 2,
});

const TURNS = [0, 0.6, -0.6, 1.2, -1.2];

/**
 * Where a note of text `width` px wide goes beside the point (`x`, `y`) of an orbit centred on
 * (`cx`, `cy`). It tries the outward direction, then turned each way, then inward. Then it tries
 * them again farther out, since a slanted box near the point can touch the line by itself.
 */
export const noteSpots = (
    x: number,
    y: number,
    cx: number,
    cy: number,
    width: number,
): Rect[] => {
    const length = Math.hypot(x - cx, y - cy);
    // A point on the centre has no outward side.
    const ux = length < 1 ? 0 : (x - cx) / length;
    const uy = length < 1 ? -1 : (y - cy) / length;
    const beyond = (nx: number, ny: number, gap: number): Rect => {
        const t =
            gap +
            (Math.abs(nx) * (width + 2 * NOTE_PAD_PX)) / 2 +
            Math.abs(ny) * (NOTE_HEIGHT_PX / 2);

        return noteBox(x + nx * t, y + ny * t, width);
    };

    return [NOTE_APSIS_GAP_PX, NOTE_APSIS_FAR_GAP_PX].flatMap((gap) => [
        ...TURNS.map((angle) =>
            beyond(
                ux * Math.cos(angle) - uy * Math.sin(angle),
                ux * Math.sin(angle) + uy * Math.cos(angle),
                gap,
            ),
        ),
        beyond(-ux, -uy, gap),
    ]);
};

/**
 * Where lines of text `widths` px wide stack against a tag, nearest line first: below it flush
 * left, below flush right, above flush left, above flush right. All the lines are tried at each
 * spot, then the first alone.
 */
export const blockSpots = (
    tag: Rect,
    widths: readonly number[],
    lineHeight: number,
): Rect[][] => {
    const counts = [...new Set([widths.length, 1])];
    const sides = [
        [1, true],
        [1, false],
        [-1, true],
        [-1, false],
    ] as const;

    return counts.flatMap((count) =>
        sides.map(([direction, left]) =>
            widths.slice(0, count).map((width, row) => {
                const x = left ? tag.left + width / 2 : tag.right - width / 2;
                const y =
                    direction > 0
                        ? tag.bottom + NOTE_BLOCK_GAP_PX + row * lineHeight
                        : tag.top - NOTE_BLOCK_GAP_PX - row * lineHeight;

                return noteBox(x, y, width);
            }),
        ),
    );
};

/** Whether the segment from (ax, ay) to (bx, by) touches the rect (Liang-Barsky). */
const segmentTouches = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    rect: Rect,
): boolean => {
    const dx = bx - ax;
    const dy = by - ay;
    let t0 = 0;
    let t1 = 1;

    for (let side = 0; side < 4; side++) {
        const d = side === 0 ? -dx : side === 1 ? dx : side === 2 ? -dy : dy;
        const q =
            side === 0
                ? ax - rect.left
                : side === 1
                  ? rect.right - ax
                  : side === 2
                    ? ay - rect.top
                    : rect.bottom - ay;
        if (d === 0) {
            if (q < 0) return false;
        } else if (d < 0) {
            if (q / d > t1) return false;
            t0 = Math.max(t0, q / d);
        } else {
            if (q / d < t0) return false;
            t1 = Math.min(t1, q / d);
        }
    }

    return t0 <= t1;
};

/**
 * Whether a polyline of x, y pairs passes within `gap` px of `rect`.
 * A segment with a NaN end is a break in the line and is skipped.
 */
export const nearPolyline = (
    rect: Rect,
    points: ArrayLike<number>,
    gap: number,
): boolean => {
    const grown = {
        left: rect.left - gap,
        top: rect.top - gap,
        right: rect.right + gap,
        bottom: rect.bottom + gap,
    };

    for (let k = 2; k + 1 < points.length; k += 2) {
        const ax = points[k - 2] ?? Number.NaN;
        const ay = points[k - 1] ?? Number.NaN;
        const bx = points[k] ?? Number.NaN;
        const by = points[k + 1] ?? Number.NaN;
        if (Number.isNaN(ax + ay + bx + by)) continue;

        if (segmentTouches(ax, ay, bx, by, grown)) return true;
    }

    return false;
};

/** Whether `a` and `b` overlap. Boxes that only touch don't. */
const overlaps = (a: Rect, b: Rect): boolean =>
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top;

/** What a note must keep clear of: the viewport, `taken` boxes and, by `gap` px, a polyline. */
export type Clearance = {
    viewport: { width: number; height: number };
    taken: readonly Rect[];
    line: ArrayLike<number>;
    gap: number;
};

/** Whether `rect` is inside the viewport, off every taken box and `gap` px from the line. */
const isClear = (rect: Rect, { viewport, taken, line, gap }: Clearance) =>
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.right <= viewport.width &&
    rect.bottom <= viewport.height &&
    !taken.some((box) => overlaps(rect, box)) &&
    !nearPolyline(rect, line, gap);

/** The first of `spots` that is clear, or `null`. */
export const firstClear = (
    spots: readonly Rect[],
    clearance: Clearance,
): Rect | null => spots.find((spot) => isClear(spot, clearance)) ?? null;

/** The first of `stacks` whose every box is clear, or `null`. */
export const firstClearStack = (
    stacks: readonly (readonly Rect[])[],
    clearance: Clearance,
): readonly Rect[] | null =>
    stacks.find((stack) => stack.every((spot) => isClear(spot, clearance))) ??
    null;
