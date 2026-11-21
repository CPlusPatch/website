import { J2000_UNIX_MS } from "./constants.ts";

/** Converts Unix milliseconds to seconds since J2000 (TT−UTC is ignored). */
export const unixMsToJ2000s = (ms: number): number =>
    (ms - J2000_UNIX_MS) / 1000;

/** Converts seconds since J2000 to Unix milliseconds. */
export const j2000sToUnixMs = (s: number): number => s * 1000 + J2000_UNIX_MS;
