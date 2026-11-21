/// <reference types="deno" />
import { AU, unixMsToJ2000s } from "@cpluspatch/orbit";
import { assertAlmostEquals, assertEquals } from "@std/assert";
import { RATES } from "./clock.ts";
import {
    formatAngle,
    formatDistance,
    formatDuration,
    formatSpeed,
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

Deno.test("formatUtc pads years to four digits, and six outside 0 to 9999", () => {
    assertEquals(formatUtc(atYear(999)), "0999-01-01 00:00 UTC");
    assertEquals(formatUtc(atYear(-5)), "-000005-01-01 00:00 UTC");
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

Deno.test("formatDistance groups thousands of kilometres below 0.1 AU", () => {
    assertEquals(formatDistance(6_790_000), "6,790 km");
    assertEquals(formatDistance(384_400_000), "384,400 km");
    assertEquals(formatDistance(500), "1 km");
});

Deno.test("formatDistance writes a negative distance with a minus sign", () => {
    assertEquals(formatDistance(-2_527_000), "\u22122,527 km");
});

Deno.test("formatDistance switches to AU at 0.1 AU", () => {
    assertEquals(formatDistance(0.1 * AU - 1000), "14,959,786 km");
    assertEquals(formatDistance(0.1 * AU), "0.100 AU");
    assertEquals(formatDistance(AU), "1.000 AU");
    assertEquals(formatDistance(39.48 * AU), "39.480 AU");
});

Deno.test("formatSpeed writes km/s with two decimals", () => {
    assertEquals(formatSpeed(7660), "7.66 km/s");
    assertEquals(formatSpeed(29_784), "29.78 km/s");
});

Deno.test("formatDuration picks minutes, hours, days or years", () => {
    assertEquals(formatDuration(92.7 * 60), "92.7 min");
    assertEquals(formatDuration(5 * 3600), "5.0 hr");
    assertEquals(formatDuration(27.3 * 86400), "27.3 days");
    assertEquals(formatDuration(300 * 86400), "300.0 days");
    assertEquals(formatDuration(11.86 * 31557600), "11.9 yrs");
});

Deno.test("formatDuration changes unit at 2 hours, 2 days and 2 years", () => {
    assertEquals(formatDuration(7199), "120.0 min");
    assertEquals(formatDuration(7200), "2.0 hr");
    assertEquals(formatDuration(2 * 86400), "2.0 days");
    assertEquals(formatDuration(2 * 31557600), "2.0 yrs");
});

Deno.test("formatAngle writes degrees with one decimal", () => {
    assertEquals(formatAngle(0), "0.0°");
    assertEquals(formatAngle(Math.PI), "180.0°");
    assertEquals(formatAngle(1), "57.3°");
});

Deno.test("formatAngle never writes a full turn", () => {
    assertEquals(formatAngle(2 * Math.PI - 1e-5), "0.0°");
});
