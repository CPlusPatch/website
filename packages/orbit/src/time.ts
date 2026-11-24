import { J2000_UNIX_MS } from "./constants.ts";

/** Converts Unix milliseconds to seconds since J2000 (TT−UTC is ignored). */
export const unixMsToJ2000s = (ms: number): number =>
    (ms - J2000_UNIX_MS) / 1000;

/** Converts seconds since J2000 to Unix milliseconds. */
export const j2000sToUnixMs = (s: number): number => s * 1000 + J2000_UNIX_MS;

/** The first and last year a date can have. Year 0 is 1 BC, so 44 BC is -0043. */
export const MIN_YEAR = -9999;
export const MAX_YEAR = 9999;

// setUTCFullYear, since Date.UTC reads years 0 to 99 as 1900 to 1999.
const utcSeconds = (
    y: number,
    mo: number,
    d: number,
    h: number,
    mi: number,
    s: number,
): number =>
    unixMsToJ2000s(
        new Date(0).setUTCFullYear(y, mo, d) + ((h * 60 + mi) * 60 + s) * 1000,
    );

/** The earliest time, -9999-01-01T00:00:00Z, in seconds since J2000. */
export const MIN_TIME = utcSeconds(MIN_YEAR, 0, 1, 0, 0, 0);

/** The latest time, 9999-12-31T23:59:59Z, in seconds since J2000. */
export const MAX_TIME = utcSeconds(MAX_YEAR, 11, 31, 23, 59, 59);
