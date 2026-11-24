import { j2000sToUnixMs } from "@cpluspatch/orbit";
import { presetOf } from "./clock.ts";
import {
    fromParts,
    MAX_YEAR,
    MIN_YEAR,
    MONTHS,
    toParts,
} from "./date-parts.ts";
import type { Readouts } from "./readouts.ts";

/** What a labelled tick shows: a time of day, a day, a month or a year. */
export type TickKind = "time" | "day" | "month" | "year";

const MIN_T = fromParts({ y: MIN_YEAR, mo: 1, d: 1, h: 0, mi: 0, s: 0 });
const MAX_T = fromParts({ y: MAX_YEAR, mo: 12, d: 31, h: 23, mi: 59, s: 59 });

const UNIX_AT_J2000 = j2000sToUnixMs(0) / 1000;

const DAY = 86400;

/** Steps in seconds. */
const STEPS = [
    300, // 5 minutes
    900, // 15 minutes
    3600, // 1 hour
    10800, // 3 hours
    21600, // 6 hours
    43200, // 12 hours
    ...[1, 2, 5, 10, 20].map((d) => d * DAY), // days
];

/** The step in months, tried in order. */
const MONTH_STEPS = [1, 3, 6, 12, 24, 60, 120, 240, 600];

/** The window's half-width in the live view, in seconds: 60 days. */
const LIVE_HALF = 60 * DAY;

/** Half the window in seconds: 60 ticks of the rate, and at least 60 days when live. */
export const windowHalf = (rate: number, live: boolean): number =>
    Math.max(live ? LIVE_HALF : 0, 60 * Math.abs(rate));

const WINDOW_UNITS = [
    "sec",
    "min",
    "hours",
    "days",
    "weeks",
    "months",
    "years",
];

/** The window's size as text, like `±60 days`. Live counts as at least days. */
export const windowLabel = (rate: number, live: boolean): string => {
    const k = Math.max(presetOf(rate), live ? WINDOW_UNITS.indexOf("days") : 0);

    return `±60 ${WINDOW_UNITS[k]}`;
};

/**
 * The left edge of the Now flag in px: centred on `nowX` and kept inside the strip. It moves to the
 * side of the date tag that `nowX` is on if it would overlap the tag and `gap`.
 */
export const nowFlagLeft = (
    nowX: number,
    flagWidth: number,
    width: number,
    tagHalf: number,
    gap: number,
): number => {
    const mid = width / 2;
    const edge = 4;
    const left = Math.min(
        Math.max(nowX - flagWidth / 2, edge),
        width - edge - flagWidth,
    );
    const clash =
        left < mid + tagHalf + gap && left + flagWidth > mid - tagHalf - gap;
    if (!clash) return left;

    return nowX < mid ? mid - tagHalf - gap - flagWidth : mid + tagHalf + gap;
};

/** `t`, kept inside the years the date editor accepts. */
export const clampT = (t: number): number =>
    Math.min(MAX_T, Math.max(MIN_T, t));

// setUTCFullYear, since Date.UTC reads years 0 to 99 as 1900 to 1999.
const firstOfMonth = (year: number, month: number): number =>
    new Date(0).setUTCFullYear(year, month, 1) / 1000 - UNIX_AT_J2000;

/**
 * The tick times in `[lo, hi]` (seconds since J2000) on the finest step that gives at most
 * `maxCount` of them. Fixed steps start at UTC midnight, longer ones on the 1st of a month.
 */
export const ticks = (
    lo: number,
    hi: number,
    maxCount: number,
): { ticks: number[]; kind: TickKind } => {
    const span = hi - lo;
    const out: number[] = [];
    const step = STEPS.find((candidate) => span / candidate <= maxCount);

    if (step !== undefined) {
        const first =
            Math.ceil((lo + UNIX_AT_J2000) / step) * step - UNIX_AT_J2000;
        for (let t = first; t <= hi; t += step) out.push(t);

        return { ticks: out, kind: step < DAY ? "time" : "day" };
    }

    const months =
        MONTH_STEPS.find(
            (candidate) => span / (candidate * 30.4375 * DAY) <= maxCount,
        ) ?? 1200;
    const start = new Date(j2000sToUnixMs(lo));
    let year = start.getUTCFullYear();
    let month = 0;
    if (months < 12) {
        month = start.getUTCMonth() - (start.getUTCMonth() % months);
    } else {
        const years = months / 12;
        year -= ((year % years) + years) % years;
    }

    for (;;) {
        const t = firstOfMonth(year, month);
        // An out of range date is NaN, which would never pass `hi`.
        if (!(t <= hi)) break;

        if (t >= lo) out.push(t);
        if (months < 12) {
            month += months;
            year += Math.floor(month / 12);
            month %= 12;
        } else {
            year += months / 12;
        }
    }

    return { ticks: out, kind: months < 12 ? "month" : "year" };
};

const pad = (n: number, width = 2): string => String(n).padStart(width, "0");

// Not toISOString, which writes years past 9999 as +010000.
const year = (y: number): string => (y < 0 ? `-${pad(-y, 4)}` : pad(y, 4));

const shortMonth = (mo: number): string => {
    const name = MONTHS[mo - 1];

    if (name === undefined) throw new Error(`No month ${mo}.`);

    return name.slice(0, 3);
};

/** `HH:MM`, `Jan 19`, `Mar` (the year on January) or `YYYY`, in UTC. */
export const tickLabel = (t: number, kind: TickKind): string => {
    const { y, mo, d, h, mi } = toParts(t);

    if (kind === "time") return `${pad(h)}:${pad(mi)}`;
    if (kind === "day") return `${shortMonth(mo)} ${d}`;
    if (kind === "month" && mo !== 1) return shortMonth(mo);

    return year(y);
};

/** The date at `t` for the hover tip and the slider's value text, to the second in a narrow window. */
export const tipText = (t: number, half: number): string => {
    const { y, mo, d, h, mi, s } = toParts(t);
    const time = `${pad(h)}:${pad(mi)}${half < 43200 ? `:${pad(s)}` : ""}`;

    return `${d} ${shortMonth(mo)} ${year(y)} ${time} UTC`;
};

/** Whether `[from, to]`, with `gap` either side, is clear of every range in `taken`. */
export const isFree = (
    taken: [number, number][],
    from: number,
    to: number,
    gap: number,
): boolean => taken.every(([a, b]) => to + gap <= a || from - gap >= b);

/** A periapsis or apoapsis mark on the strip, and whether it carries its label. */
export type ApsisMark = { name: "Ap" | "Pe"; t: number; labelled: boolean };

/** The spacing in px between marks that gives each a label. */
const LABELLED_PX = 30;

/** The spacing in px below which marks are thinned out. */
const MARK_PX = 12;

/** The times in `[lo, hi]` that fall on every `every`th orbit, counted from J2000. */
const orbitTimes = (
    anchor: number,
    period: number,
    lo: number,
    hi: number,
    every: number,
): number[] => {
    // The phase doesn't change with the clock, so orbit k keeps its time and its place in the count.
    const phase = ((anchor % period) + period) % period;
    const first = Math.ceil(Math.ceil((lo - phase) / period) / every) * every;
    const out: number[] = [];

    for (let k = first; phase + k * period <= hi; k += every) {
        out.push(phase + k * period);
    }

    return out;
};

/**
 * The apsides in `[lo, hi]` at `perSecond` px per second, or none for no orbit or an open one. Wide
 * apart they have labels, closer they're squares, and closer still only every Nth periapsis shows.
 */
export const apsisMarks = (
    readout: Pick<
        Readouts,
        "period" | "timeToPeriapsis" | "timeToApoapsis"
    > | null,
    t: number,
    lo: number,
    hi: number,
    perSecond: number,
): ApsisMark[] => {
    if (!readout || !(perSecond > 0)) return [];

    const { period, timeToPeriapsis, timeToApoapsis } = readout;
    if (
        ![period, timeToPeriapsis, timeToApoapsis].every(Number.isFinite) ||
        period <= 0
    ) {
        return [];
    }

    const spacing = (period / 2) * perSecond;
    const labelled = spacing >= LABELLED_PX;
    const every =
        spacing >= MARK_PX ? 1 : Math.ceil(MARK_PX / (period * perSecond));
    const periapses = orbitTimes(
        t + timeToPeriapsis,
        period,
        lo,
        hi,
        every,
    ).map((time) => ({ name: "Pe" as const, t: time, labelled }));
    if (spacing < MARK_PX) return periapses;

    const apoapses = orbitTimes(t + timeToApoapsis, period, lo, hi, 1).map(
        (time) => ({ name: "Ap" as const, t: time, labelled }),
    );

    return [...periapses, ...apoapses].sort((a, b) => a.t - b.t);
};
