import { clampT, tipText } from "../../timeline.ts";
import { EVENTS, type Hit } from "./draw.ts";

/** The drag distance in px that makes a press a scrub and not a click. */
export const DRAG_PX = 3;

/** The time after dragging the strip `dx` px from `t`. */
export const scrubTime = (
    t: number,
    dx: number,
    width: number,
    half: number,
): number => clampT(t + (dx / width) * 2 * half);

/** The time under `px`, with `t` in the middle of a strip `width` px wide. */
export const hoverTime = (
    t: number,
    px: number,
    width: number,
    half: number,
): number => clampT(t + ((px - width / 2) / width) * 2 * half);

/** How far the Now mark is from the middle of the strip, in px. */
export const nowOffsetPx = (
    nowT: number,
    t: number,
    width: number,
    half: number,
): number => Math.round(((nowT - t) * width) / (2 * half));

/** The saved scenario or apsis mark at `px`, if the pointer is in the events row. */
export const flagAt = (
    hits: Hit[],
    px: number,
    py: number,
    height: number,
): Hit | undefined =>
    // A few pixels of slack either side of a mark.
    py >= height - EVENTS
        ? hits.find(({ from, to }) => px >= from - 2 && px <= to + 2)
        : undefined;

/** The tip's left edge relative to `origin`, centred on `px` and kept inside the viewport. */
export const tipLeft = (
    origin: number,
    px: number,
    tipWidth: number,
    viewport: number,
): number =>
    Math.min(viewport - 4 - tipWidth, Math.max(4, origin + px - tipWidth / 2)) -
    origin;

/** How far a key moves the clock in seconds, or undefined for a key that doesn't. */
export const keyStep = (key: string, half: number): number | undefined => {
    const tick = half / 60;

    return {
        ArrowLeft: -tick,
        ArrowRight: tick,
        PageUp: 10 * tick,
        PageDown: -10 * tick,
    }[key];
};

/** The slider's `aria-value*` attributes for the clock at `t`. */
export const ariaValues = (t: number, half: number) => ({
    min: String(Math.round(t - half)),
    max: String(Math.round(t + half)),
    now: String(Math.round(t)),
    text: tipText(t, half),
});
