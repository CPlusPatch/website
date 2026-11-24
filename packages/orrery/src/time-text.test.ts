/// <reference types="deno" />
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { assertEquals } from "@std/assert";
import { RATES } from "./clock.ts";
import {
    dateText,
    isLive,
    offsetText,
    rateText,
    stampParts,
} from "./time-text.ts";

const at = (...args: Parameters<typeof Date.UTC>): number =>
    unixMsToJ2000s(Date.UTC(...args));

// Date.UTC reads years 0 to 99 as 1900 to 1999.
const atYear = (year: number): number =>
    unixMsToJ2000s(new Date(0).setUTCFullYear(year, 0, 1));

const texts = (t: number, rate: number): string[] =>
    Object.values(stampParts(t, rate)).map((part) => part.text);

const fast = (t: number, rate: number): string[] =>
    Object.entries(stampParts(t, rate))
        .filter(([, part]) => part.fast)
        .map(([name]) => name);

Deno.test("rateText names the unit of each preset", () => {
    assertEquals(RATES.map(rateText), [
        "1 sec/s",
        "1 min/s",
        "1 hour/s",
        "1 day/s",
        "1 week/s",
        "1 month/s",
        "1 year/s",
    ]);
});

Deno.test("rateText snaps a rate to the largest preset it reaches", () => {
    assertEquals(rateText(100), "1 min/s");
    assertEquals(rateText(0.5), "1 sec/s");
});

Deno.test("rateText writes a reversed rate with a true minus", () => {
    assertEquals(rateText(-86400), "−1 day/s");
});

Deno.test("a running clock at 1 sec/s within 1.5 s of now is live", () => {
    const clock = { t: 100, rate: 1, paused: false };

    assertEquals(isLive(clock, 100), true);
    assertEquals(isLive(clock, 101.4), true);
    assertEquals(isLive(clock, 98.6), true);
    assertEquals(isLive(clock, 101.6), false);
});

Deno.test("a held, reversed or faster clock isn't live", () => {
    assertEquals(isLive({ t: 0, rate: 1, paused: true }, 0), false);
    assertEquals(isLive({ t: 0, rate: -1, paused: false }, 0), false);
    assertEquals(isLive({ t: 0, rate: 60, paused: false }, 0), false);
});

Deno.test("offsetText is null under a minute either way", () => {
    assertEquals(offsetText(0), null);
    assertEquals(offsetText(59.9), null);
    assertEquals(offsetText(-59.9), null);
});

Deno.test("offsetText writes minutes, hours, days and years", () => {
    assertEquals(offsetText(5 * 60), {
        full: "5m",
        short: "5m",
        spoken: "5 minutes",
        word: "ahead",
    });
    assertEquals(offsetText(3 * 3600 + 5 * 60), {
        full: "3h 05m",
        short: "3h",
        spoken: "3 hours",
        word: "ahead",
    });
    assertEquals(offsetText(2 * 86400 + 14 * 3600), {
        full: "2d 14h",
        short: "2d",
        spoken: "2 days",
        word: "ahead",
    });
    assertEquals(offsetText(31557600 + 12 * 86400), {
        full: "1y 12d",
        short: "1y",
        spoken: "1 year",
        word: "ahead",
    });
    assertEquals(offsetText(4 * 31557600), {
        full: "4y",
        short: "4y",
        spoken: "4 years",
        word: "ahead",
    });
});

Deno.test("offsetText says behind for a negative offset", () => {
    assertEquals(offsetText(-13 * 86400)?.word, "behind");
    assertEquals(offsetText(-13 * 86400)?.short, "13d");
});

Deno.test("stampParts zero-pads each part of the date", () => {
    assertEquals(texts(at(2026, 10, 21, 4, 5, 6), 1), [
        "2026",
        "11",
        "21",
        "04",
        "05",
        "06",
    ]);
});

Deno.test("stampParts rounds to the second, like the date editor", () => {
    assertEquals(texts(at(2026, 10, 21, 4, 5, 6, 600), 1).at(-1), "07");
});

Deno.test("stampParts formats years outside 0 to 9999", () => {
    assertEquals(texts(atYear(999), 1)[0], "0999");
    assertEquals(texts(atYear(10000), 1)[0], "10000");
    assertEquals(texts(atYear(-5), 1)[0], "-0005");
});

Deno.test("stampParts marks the parts that change faster than twice a second", () => {
    const t = at(2026, 10, 21);

    assertEquals(fast(t, 1), []);
    assertEquals(fast(t, 86400), ["h", "mi", "s"]);
    assertEquals(fast(t, 31557600), ["mo", "d", "h", "mi", "s"]);
    assertEquals(fast(t, -86400), ["h", "mi", "s"]);
});

Deno.test("stampParts doesn't mark a part that changes twice a second", () => {
    assertEquals(fast(0, 7200), ["mi", "s"]);
});

Deno.test("dateText pads the year, and shows dashes for a time that isn't a date", () => {
    assertEquals(dateText(at(2026, 10, 24, 13)), "2026-11-24");
    assertEquals(dateText(atYear(5)), "0005-01-01");
    assertEquals(dateText(1e30), "----------");
    assertEquals(dateText(Number.NaN), "----------");
});
