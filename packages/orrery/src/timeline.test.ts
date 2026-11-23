/// <reference types="deno" />
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { assert, assertEquals } from "@std/assert";
import { fromParts, toParts } from "./date-parts.ts";
import {
    apsides,
    clampT,
    isFree,
    tickLabel,
    tickLabelFree,
    ticks,
    tipText,
    windowHalf,
} from "./timeline.ts";

const DAY = 86400;

// setUTCFullYear, since Date.UTC reads years 0 to 99 as 1900 to 1999.
const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number =>
    unixMsToJ2000s(
        new Date(0).setUTCFullYear(y, mo - 1, d) +
            ((h * 60 + mi) * 60 + s) * 1000,
    );

Deno.test("the window is a minute per second of the rate, and at least an hour", () => {
    assertEquals(windowHalf(1), 3600);
    assertEquals(windowHalf(60), 3600);
    assertEquals(windowHalf(3600), 216000);
    assertEquals(windowHalf(DAY), 5184000);
});

Deno.test("a reversed clock has the same window as a forward one", () => {
    assertEquals(windowHalf(-DAY), windowHalf(DAY));
});

Deno.test("clamping keeps a time inside years 1 to 9999", () => {
    assertEquals(clampT(0), 0);
    assertEquals(toParts(clampT(-1e15)).y, 1);
    assertEquals(toParts(clampT(-1e15)).mo, 1);
    assertEquals(toParts(clampT(1e15)).y, 9999);
    assertEquals(
        clampT(at(9999, 12, 31, 23, 59, 59)),
        at(9999, 12, 31, 23, 59, 59),
    );
});

Deno.test("an hour of window gets ticks every 15 minutes or so, on the quarter hour", () => {
    const lo = at(2026, 11, 22, 10, 7);
    const result = ticks(lo, lo + 3600, 6);

    assertEquals(result.kind, "time");
    assertEquals(
        result.ticks.map((t) => tickLabel(t, "time")),
        ["10:15", "10:30", "10:45", "11:00"],
    );
});

Deno.test("day ticks fall on UTC midnight", () => {
    const lo = at(2026, 11, 3, 5);
    const result = ticks(lo, lo + 8 * DAY, 6);

    assertEquals(result.kind, "day");
    assert(result.ticks.length > 0);
    for (const t of result.ticks) {
        const { h, mi, s } = toParts(t);
        assertEquals([h, mi, s], [0, 0, 0]);
    }
    assertEquals(result.ticks[1] - (result.ticks[0] ?? 0), 2 * DAY);
});

Deno.test("ticks stay inside the range and start on their own grid", () => {
    const lo = at(2026, 1, 1, 6);
    const hi = lo + 3 * DAY;
    const result = ticks(lo, hi, 6);

    assertEquals(result.kind, "time");
    for (const t of result.ticks) assert(t >= lo && t <= hi);
    assertEquals(result.ticks[0], at(2026, 1, 1, 12));
});

Deno.test("a window too wide for days gets ticks on the 1st of a quarter", () => {
    const lo = at(2026, 2, 10);
    const result = ticks(lo, at(2026, 11, 10), 6);

    assertEquals(result.kind, "month");
    assertEquals(
        result.ticks.map((t) => tickLabel(t, "month")),
        ["Apr", "Jul", "Oct"],
    );
    for (const t of result.ticks) assertEquals(toParts(t).d, 1);
});

Deno.test("a window of decades gets ticks on 1 January of a round year", () => {
    const result = ticks(at(1950, 6, 1), at(2150, 6, 1), 6);

    assertEquals(result.kind, "year");
    assertEquals(
        result.ticks.map((t) => tickLabel(t, "year")),
        ["2000", "2050", "2100", "2150"],
    );
});

Deno.test("year ticks before year 100 don't read as the 1900s", () => {
    const result = ticks(at(1, 1, 1), at(150, 1, 1), 2);

    assertEquals(result.kind, "year");
    assertEquals(
        result.ticks.map((t) => tickLabel(t, "year")),
        ["0100"],
    );
    assertEquals(toParts(result.ticks[0] ?? 0).y, 100);
});

Deno.test("a window past the last year ends instead of looping", () => {
    const result = ticks(at(9900, 1, 1), at(9999, 12, 31), 1);

    assertEquals(result.kind, "year");
    assert(result.ticks.length <= 2);
});

Deno.test("tick labels come from the UTC parts", () => {
    const t = at(2026, 3, 4, 5, 6);

    assertEquals(tickLabel(t, "time"), "05:06");
    assertEquals(tickLabel(t, "day"), "Mar 4");
    assertEquals(tickLabel(t, "month"), "Mar");
    assertEquals(tickLabel(at(2026, 1, 1), "month"), "2026");
    assertEquals(tickLabel(t, "year"), "2026");
    assertEquals(tickLabel(at(7, 1, 1), "year"), "0007");
});

Deno.test("the tip shows seconds only in a window under a day", () => {
    const t = fromParts({ y: 2026, mo: 11, d: 22, h: 9, mi: 5, s: 7 });

    assertEquals(tipText(t, 3600), "22 Nov 2026 09:05:07 UTC");
    assertEquals(tipText(t, 43199), "22 Nov 2026 09:05:07 UTC");
    assertEquals(tipText(t, 43200), "22 Nov 2026 09:05 UTC");
});

Deno.test("a range is free when it clears every taken one by the gap", () => {
    const taken: [number, number][] = [[10, 20]];

    assertEquals(isFree(taken, 24, 30, 4), true);
    assertEquals(isFree(taken, 23, 30, 4), false);
    assertEquals(isFree(taken, 0, 6, 4), true);
    assertEquals(isFree(taken, 0, 7, 4), false);
    assertEquals(isFree(taken, 12, 15, 0), false);
    assertEquals(isFree([], 12, 15, 4), true);
});

Deno.test("apsides are the next and the previous one of each kind", () => {
    const result = apsides(
        { period: 100, timeToPeriapsis: 30, timeToApoapsis: 80 },
        1000,
    );

    assertEquals(result, [
        { name: "Pe", t: 1030 },
        { name: "Pe", t: 930 },
        { name: "Ap", t: 1080 },
        { name: "Ap", t: 980 },
    ]);
});

Deno.test("a body with no orbit, or an open one, has no apsides", () => {
    assertEquals(apsides(null, 0), []);
    assertEquals(
        apsides(
            {
                period: Number.POSITIVE_INFINITY,
                timeToPeriapsis: 5,
                timeToApoapsis: 6,
            },
            0,
        ),
        [],
    );
    assertEquals(
        apsides(
            { period: Number.NaN, timeToPeriapsis: 5, timeToApoapsis: 6 },
            0,
        ),
        [],
    );
});

Deno.test("a tick label keeps 12px from the Now label, and 3px from other labels", () => {
    const now: [number, number] = [100, 120];

    assertEquals(tickLabelFree([], now, 132, 160), true);
    assertEquals(tickLabelFree([], now, 131, 160), false);
    assertEquals(tickLabelFree([], now, 60, 88), true);
    assertEquals(tickLabelFree([], now, 60, 89), false);
    assertEquals(tickLabelFree([], null, 121, 160), true);
    assertEquals(tickLabelFree([[0, 10]], null, 12, 20), false);
    assertEquals(tickLabelFree([[0, 10]], null, 13, 20), true);
});
