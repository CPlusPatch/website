/// <reference types="deno" />
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { assertAlmostEquals, assertEquals } from "@std/assert";
import { RATES } from "./clock.ts";
import {
    formatUtc,
    fromDatetimeLocal,
    rateLabel,
    toDatetimeLocal,
} from "./format.ts";

const at = (...args: Parameters<typeof Date.UTC>): number =>
    unixMsToJ2000s(Date.UTC(...args));

Deno.test("formatUtc writes the date and the minute", () => {
    assertEquals(
        formatUtc(at(2026, 10, 21, 14, 30, 59)),
        "2026-11-21 14:30 UTC",
    );
});

Deno.test("formatUtc handles a date before 2000", () => {
    assertEquals(formatUtc(at(1969, 6, 20, 20, 17)), "1969-07-20 20:17 UTC");
});

// Date.UTC reads years 0 to 99 as 1900 to 1999.
const atYear = (year: number): number =>
    unixMsToJ2000s(new Date(0).setUTCFullYear(year, 0, 1));

Deno.test("formatUtc pads years to four digits", () => {
    assertEquals(formatUtc(atYear(999)), "0999-01-01 00:00 UTC");
    assertEquals(formatUtc(atYear(-5)), "-0005-01-01 00:00 UTC");
});

Deno.test("toDatetimeLocal is empty for years the input can't hold", () => {
    assertEquals(toDatetimeLocal(atYear(999)), "0999-01-01T00:00");
    assertEquals(toDatetimeLocal(atYear(-5)), "");
    assertEquals(toDatetimeLocal(atYear(10000)), "");
});

Deno.test("toDatetimeLocal writes the value of a datetime-local input", () => {
    assertEquals(toDatetimeLocal(at(2026, 10, 21, 14, 30)), "2026-11-21T14:30");
    assertEquals(toDatetimeLocal(at(1969, 6, 20, 20, 17)), "1969-07-20T20:17");
});

Deno.test("fromDatetimeLocal reads a value as UTC", () => {
    assertEquals(fromDatetimeLocal("2000-01-01T12:00"), 0);
    assertEquals(
        fromDatetimeLocal("1969-07-20T20:17"),
        at(1969, 6, 20, 20, 17),
    );
});

Deno.test("fromDatetimeLocal returns null for an empty or invalid value", () => {
    assertEquals(fromDatetimeLocal(""), null);
    assertEquals(fromDatetimeLocal("tomorrow"), null);
    assertEquals(fromDatetimeLocal("2026-13-01T00:00"), null);
    assertEquals(fromDatetimeLocal("2026-02-30T00:00"), null);
    assertEquals(fromDatetimeLocal("2026-11-21T25:00"), null);
});

Deno.test("a time round-trips through a datetime-local value", () => {
    const t = at(2026, 10, 21, 14, 30);

    assertAlmostEquals(fromDatetimeLocal(toDatetimeLocal(t)) ?? NaN, t, 1e-6);
});

Deno.test("rateLabel names the unit of each preset", () => {
    assertEquals(RATES.map(rateLabel), [
        "1 second",
        "1 minute",
        "1 hour",
        "1 day",
        "1 week",
        "1 month",
        "1 year",
    ]);
    assertEquals(rateLabel(-86400), "1 day");
});
