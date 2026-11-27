/*
 * The maths of a preview frame (behaviours/preview-frame.ts): snapping,
 * stepping and the text that says the width. All widths are in rem.
 */

/** A named width the ruler marks and a drag lands on. */
export interface PreviewWidth {
    name: string;
    rem: number;
}

/** A dragged width this close to a snap width lands on it. */
export const SNAP_RANGE = 0.5;

/** A width this close to the container's means the frame fills it. */
export const FILL_RANGE = 0.25;

/** What an arrow key moves by. */
export const KEY_STEP = 1;

/** Closer than this, two widths are the same one. */
const SAME = 0.01;

/** The narrowest a frame goes when nothing says: the ruler starts here. */
export const DEFAULT_MIN = 20;

export const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(value, max));

export const isFill = (value: number, max: number): boolean =>
    value >= max - FILL_RANGE;

/** The nearest snap width within SNAP_RANGE of `value` (and in range), else `value`. */
export const snap = (
    value: number,
    widths: PreviewWidth[],
    min: number,
    max: number,
): number => {
    let best = value;
    let distance = SNAP_RANGE;

    for (const { rem } of widths) {
        if (rem < min || rem > max) continue;
        const gap = Math.abs(rem - value);
        if (gap <= distance) {
            best = rem;
            distance = gap;
        }
    }

    return best;
};

/** The previous or next stop for PageDown and PageUp: a snap width, or min and fill past the ends. */
export const page = (
    value: number,
    direction: 1 | -1,
    widths: PreviewWidth[],
    min: number,
    max: number,
): number => {
    const stops = [
        min,
        ...widths.map((w) => w.rem).filter((rem) => rem > min && rem < max),
        max,
    ].sort((a, b) => a - b);

    return direction > 0
        ? (stops.find((stop) => stop > value + SAME) ?? max)
        : (stops.findLast((stop) => stop < value - SAME) ?? min);
};

/**
 * The width a key moves to, or undefined for a key that doesn't move it.
 * Home and End aren't handled: a range input does those itself.
 */
export const keyWidth = (
    key: string,
    value: number,
    widths: PreviewWidth[],
    min: number,
    max: number,
): number | undefined => {
    switch (key) {
        case "ArrowLeft":
        case "ArrowDown":
            return clamp(value - KEY_STEP, min, max);
        case "ArrowRight":
        case "ArrowUp":
            return clamp(value + KEY_STEP, min, max);
        case "PageDown":
            return page(value, -1, widths, min, max);
        case "PageUp":
            return page(value, 1, widths, min, max);
    }
};

// One decimal, so a fill just under a snap width doesn't read as on it.
const format = (rem: number): string => `${Math.round(rem * 10) / 10} rem`;

/** `32 rem, Phone` on a snap width, `Fill, 61 rem` at the container's, else `27.4 rem`. */
export const widthText = (
    value: number,
    widths: PreviewWidth[],
    max: number,
): string => {
    if (isFill(value, max)) return `Fill, ${format(value)}`;
    const named = widths.find((w) => Math.abs(w.rem - value) < SAME);

    return named ? `${format(value)}, ${named.name}` : format(value);
};

/** A saved or authored width: a number of rem, or "fill". Anything else is undefined. */
export const parseWidth = (
    text: string | null | undefined,
): number | "fill" | undefined => {
    if (text === "fill") return "fill";
    if (text == null || text.trim() === "") return undefined;
    const rem = Number(text);

    return Number.isFinite(rem) && rem > 0 ? rem : undefined;
};
