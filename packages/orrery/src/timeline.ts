import { j2000sToUnixMs } from "@cpluspatch/orbit";
import { fromParts, MAX_YEAR, MIN_YEAR, toParts } from "./date-parts.ts";
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

/** Half the window in seconds: a minute per second of the rate, and at least an hour. */
export const windowHalf = (rate: number): number =>
    Math.max(3600, 60 * Math.abs(rate));

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

/** `HH:MM`, `MM-DD`, `YYYY-MM` or `YYYY`, in UTC. */
export const tickLabel = (t: number, kind: TickKind): string => {
    const { y, mo, d, h, mi } = toParts(t);

    if (kind === "time") return `${pad(h)}:${pad(mi)}`;
    if (kind === "day") return `${pad(mo)}-${pad(d)}`;
    if (kind === "month") return `${year(y)}-${pad(mo)}`;

    return year(y);
};

/** The date at `t` for the hover tip and the slider's value text, to the second in a narrow window. */
export const tipText = (t: number, half: number): string => {
    const { y, mo, d, h, mi, s } = toParts(t);
    const time = `${pad(h)}:${pad(mi)}${half < 43200 ? `:${pad(s)}` : ""}`;

    return `${year(y)}-${pad(mo)}-${pad(d)} ${time} UTC`;
};

/** Whether `[from, to]`, with `gap` either side, is clear of every range in `taken`. */
export const isFree = (
    taken: [number, number][],
    from: number,
    to: number,
    gap: number,
): boolean => taken.every(([a, b]) => to + gap <= a || from - gap >= b);

/** A periapsis or apoapsis the strip can show, and when it happens. */
export type Apsis = { name: "Ap" | "Pe"; t: number };

/** The next and the previous apsides at clock time `t`, or none for no orbit or an open one. */
export const apsides = (
    readout: Pick<
        Readouts,
        "period" | "timeToPeriapsis" | "timeToApoapsis"
    > | null,
    t: number,
): Apsis[] => {
    if (!readout) return [];

    const { period, timeToPeriapsis, timeToApoapsis } = readout;
    if (
        ![period, timeToPeriapsis, timeToApoapsis].every(Number.isFinite) ||
        period <= 0
    ) {
        return [];
    }

    return [
        { name: "Pe", t: t + timeToPeriapsis },
        { name: "Pe", t: t + timeToPeriapsis - period },
        { name: "Ap", t: t + timeToApoapsis },
        { name: "Ap", t: t + timeToApoapsis - period },
    ];
};
