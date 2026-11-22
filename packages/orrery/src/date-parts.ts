import { j2000sToUnixMs, unixMsToJ2000s } from "@cpluspatch/orbit";

/** A UTC date and time as numbers, with the month from 1. */
export type DateParts = {
    y: number;
    mo: number;
    d: number;
    h: number;
    mi: number;
    s: number;
};

/** The name of one of the parts of a date. */
export type PartName = keyof DateParts;

/** The parts in the order they're written. */
export const PART_NAMES: PartName[] = ["y", "mo", "d", "h", "mi", "s"];

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const MIN_YEAR = 1;
const MAX_YEAR = 9999;

/** The seconds one step of a part below a month moves the date by. */
const STEP_SECONDS = { d: 86400, h: 3600, mi: 60, s: 1 } as const;

// setUTCFullYear, since Date.UTC reads years 0 to 99 as 1900 to 1999. Day 0 is the month's last.
const daysIn = (y: number, mo: number): number =>
    new Date(new Date(0).setUTCFullYear(y, mo, 0)).getUTCDate();

/** The parts of a time in seconds since J2000, rounded to the second. */
export const toParts = (t: number): DateParts => {
    const date = new Date(Math.round(j2000sToUnixMs(t) / 1000) * 1000);

    return {
        y: date.getUTCFullYear(),
        mo: date.getUTCMonth() + 1,
        d: date.getUTCDate(),
        h: date.getUTCHours(),
        mi: date.getUTCMinutes(),
        s: date.getUTCSeconds(),
    };
};

/** The time in seconds since J2000 of parts that are in range. */
export const fromParts = ({ y, mo, d, h, mi, s }: DateParts): number => {
    const date = new Date(0);
    date.setUTCFullYear(y, mo - 1, d);
    date.setUTCHours(h, mi, s, 0);

    return unixMsToJ2000s(date.getTime());
};

/** The first part that's out of range with a message for it, or `null` if all are fine. */
export const partsProblem = (
    parts: DateParts,
): { part: PartName; message: string } | null => {
    const { y, mo, d, h, mi, s } = parts;

    if (!(y >= MIN_YEAR && y <= MAX_YEAR)) {
        return { part: "y", message: "Year must be 1 to 9999." };
    }
    if (!(mo >= 1 && mo <= 12)) {
        return { part: "mo", message: "Month must be 1 to 12." };
    }

    const max = daysIn(y, mo);
    if (!(d >= 1 && d <= max)) {
        return {
            part: "d",
            message: `Day must be 1 to ${max} in ${MONTHS[mo - 1]} ${y}.`,
        };
    }
    if (!(h >= 0 && h <= 23)) {
        return { part: "h", message: "Hour must be 0 to 23." };
    }
    if (!(mi >= 0 && mi <= 59)) {
        return { part: "mi", message: "Minute must be 0 to 59." };
    }
    if (!(s >= 0 && s <= 59)) {
        return { part: "s", message: "Second must be 0 to 59." };
    }

    return null;
};

/** The parts after moving `part` by `by` steps, or `null` if that leaves years 1 to 9999 or `parts` is invalid. */
export const stepPart = (
    parts: DateParts,
    part: PartName,
    by: number,
): DateParts | null => {
    if (partsProblem(parts)) return null;

    if (part === "y" || part === "mo") {
        const months = parts.mo - 1 + (part === "mo" ? by : 0);
        const y = parts.y + (part === "y" ? by : 0) + Math.floor(months / 12);
        const mo = (((months % 12) + 12) % 12) + 1;
        if (y < MIN_YEAR || y > MAX_YEAR) return null;

        // 31 January plus a month is the end of February.
        return { ...parts, y, mo, d: Math.min(parts.d, daysIn(y, mo)) };
    }

    const next = toParts(fromParts(parts) + by * STEP_SECONDS[part]);

    return next.y < MIN_YEAR || next.y > MAX_YEAR ? null : next;
};

const PASTED =
    /^(\d{1,4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:\.\d+)?Z?$/;

/** The parts of pasted `YYYY-MM-DD`, with an optional `THH:MM` or ` HH:MM:SS`, or `null`. */
export const parsePasted = (text: string): DateParts | null => {
    const match = PASTED.exec(text.trim());
    if (!match) return null;

    const [y = 0, mo = 0, d = 0, h = 0, mi = 0, s = 0] = match
        .slice(1)
        .map((part) => Number(part ?? 0));

    return { y, mo, d, h, mi, s };
};
