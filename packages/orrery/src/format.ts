import { j2000sToUnixMs, unixMsToJ2000s } from "@cpluspatch/orbit";

const pad = (n: number): string => String(n).padStart(2, "0");

const padYear = (year: number): string =>
    `${year < 0 ? "-" : ""}${String(Math.abs(year)).padStart(4, "0")}`;

/** `YYYY-MM-DDTHH:MM` in UTC, or `null` if `t` isn't a date. */
const parts = (t: number): string | null => {
    const date = new Date(j2000sToUnixMs(t));
    if (Number.isNaN(date.getTime())) return null;

    const day = `${padYear(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

    return `${day}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

/** A time as `2026-11-21 14:30 UTC`. */
export const formatUtc = (t: number): string =>
    `${(parts(t) ?? "Invalid date").replace("T", " ")} UTC`;

/** A time as the value of a `datetime-local` input, in UTC. */
export const toDatetimeLocal = (t: number): string => {
    const value = parts(t) ?? "";

    // The input only takes four-digit years.
    return /^\d{4}-/.test(value) ? value : "";
};

/** The time of a `datetime-local` value read as UTC, or `null` if it's empty or invalid. */
export const fromDatetimeLocal = (value: string): number | null => {
    const match =
        /^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (!match) return null;

    const [year, month, day, hour, minute, second] = match
        .slice(1)
        .map((part) => Number(part ?? 0));
    const date = new Date(0);
    date.setUTCFullYear(year ?? 0, (month ?? 1) - 1, day);
    date.setUTCHours(hour ?? 0, minute ?? 0, second ?? 0, 0);

    // Month 13 or day 32 roll over, so check they didn't.
    if (
        date.getUTCMonth() !== (month ?? 1) - 1 ||
        date.getUTCDate() !== day ||
        date.getUTCHours() !== hour ||
        date.getUTCMinutes() !== minute
    ) {
        return null;
    }

    return unixMsToJ2000s(date.getTime());
};

const UNITS: [number, string][] = [
    [31557600, "1 year"],
    [2629800, "1 month"],
    [604800, "1 week"],
    [86400, "1 day"],
    [3600, "1 hour"],
    [60, "1 minute"],
    [1, "1 second"],
];

/** The preset's unit by magnitude, like `1 day`. */
export const rateLabel = (rate: number): string => {
    const speed = Math.abs(rate);
    const unit = UNITS.find(([seconds]) => speed >= seconds);

    return unit ? unit[1] : "1 second";
};
