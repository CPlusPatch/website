/// <reference types="deno" />
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { assert, assertEquals, assertExists } from "@std/assert";
import { RATES } from "./clock.ts";
import { fromParts, toParts } from "./date-parts.ts";
import {
    apsisMarks,
    clampT,
    isFree,
    labelLeft,
    MAX_T,
    MIN_T,
    nowFlagLeft,
    tickLabel,
    ticks,
    tipText,
    windowHalf,
    windowLabel,
} from "./timeline.ts";

const DAY = 86400;

// setUTCFullYear, since Date.UTC reads years 0 to 99 as 1900 to 1999.
const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number =>
    unixMsToJ2000s(
        new Date(0).setUTCFullYear(y, mo - 1, d) +
            ((h * 60 + mi) * 60 + s) * 1000,
    );

Deno.test("the window is 60 ticks of the rate, with no floor", () => {
    assertEquals(windowHalf(1, false), 60);
    assertEquals(windowHalf(60, false), 3600);
    assertEquals(windowHalf(3600, false), 216000);
    assertEquals(windowHalf(DAY, false), 5184000);
});

Deno.test("a reversed clock has the same window as a forward one", () => {
    assertEquals(windowHalf(-DAY, false), windowHalf(DAY, false));
});

Deno.test("a live window is at least 60 days", () => {
    assertEquals(windowHalf(1, true), 60 * DAY);
    assertEquals(windowHalf(DAY, true), 60 * DAY);
    assertEquals(windowHalf(3600 * 24 * 7, true), 60 * 7 * DAY);
});

Deno.test("the window label names the unit of the preset the rate snaps to", () => {
    const labels = RATES.map((rate) => windowLabel(rate, false));

    assertEquals(labels, [
        "±60 sec",
        "±60 min",
        "±60 hours",
        "±60 days",
        "±60 weeks",
        "±60 months",
        "±60 years",
    ]);
    assertEquals(windowLabel(-DAY, false), "±60 days");
    assertEquals(windowLabel(0.5, false), "±60 sec");
    assertEquals(windowLabel(100000, false), "±60 days");
});

Deno.test("a live window is labelled in days at least", () => {
    assertEquals(windowLabel(1, true), "±60 days");
    assertEquals(windowLabel(RATES[6] ?? 0, true), "±60 years");
});

Deno.test("the Now flag is centred on Now, and kept inside the strip", () => {
    assertEquals(nowFlagLeft(100, 60, 1000, 70, 6), 70);
    assertEquals(nowFlagLeft(10, 60, 1000, 70, 6), 4);
    assertEquals(nowFlagLeft(990, 60, 1000, 70, 6), 936);
});

Deno.test("the Now flag gives way to Go live when it would clash with the date tag", () => {
    // The tag spans 430 to 570, plus a gap of 6 each side.
    assertEquals(nowFlagLeft(490, 60, 1000, 70, 6), null);
    assertEquals(nowFlagLeft(510, 60, 1000, 70, 6), null);
    assertEquals(nowFlagLeft(360, 60, 1000, 70, 6), 330);
    assertEquals(nowFlagLeft(640, 60, 1000, 70, 6), 610);
});

Deno.test("clamping keeps a time inside years -9999 to 9999", () => {
    assertEquals(clampT(0), 0);
    assertEquals(toParts(clampT(-1e15)).y, -9999);
    assertEquals(toParts(clampT(-1e15)).mo, 1);
    assertEquals(toParts(clampT(1e15)).y, 9999);
    assertEquals(
        clampT(at(9999, 12, 31, 23, 59, 59)),
        at(9999, 12, 31, 23, 59, 59),
    );
});

Deno.test("the limits are the first and last second of years -9999 and 9999", () => {
    assertEquals(MIN_T, at(-9999, 1, 1));
    assertEquals(MAX_T, at(9999, 12, 31, 23, 59, 59));
});

Deno.test("a window of two minutes gets a tick every 10 seconds, on the 10 seconds", () => {
    const lo = at(2026, 11, 22, 10, 7, 3);
    const result = ticks(lo, lo + 120, 12);

    assertEquals(result.kind, "seconds");
    assertEquals(
        result.ticks.map((t) => tickLabel(t, result.kind)),
        [
            "10:07:10",
            "10:07:20",
            "10:07:30",
            "10:07:40",
            "10:07:50",
            "10:08:00",
            "10:08:10",
            "10:08:20",
            "10:08:30",
            "10:08:40",
            "10:08:50",
            "10:09:00",
        ],
    );
});

Deno.test("seconds steps run from 1 second to 2 minutes, then labels drop the seconds", () => {
    const lo = at(2026, 11, 22, 10);
    const stepOf = (span: number) => {
        const [a, b] = ticks(lo, lo + span, 10).ticks;

        return {
            step: (b ?? 0) - (a ?? 0),
            kind: ticks(lo, lo + span, 10).kind,
        };
    };

    assertEquals(stepOf(10), { step: 1, kind: "seconds" });
    assertEquals(stepOf(50), { step: 5, kind: "seconds" });
    assertEquals(stepOf(150), { step: 15, kind: "seconds" });
    assertEquals(stepOf(300), { step: 30, kind: "seconds" });
    assertEquals(stepOf(600), { step: 60, kind: "time" });
    assertEquals(stepOf(1200), { step: 120, kind: "time" });
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

    const [first, second] = result.ticks;

    assertExists(first);
    assertExists(second);
    assertEquals(second - first, 2 * DAY);
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

Deno.test("year ticks run across year 0 into negative years", () => {
    const result = ticks(at(-150, 6, 1), at(150, 6, 1), 6);

    assertEquals(result.kind, "year");
    assertEquals(
        result.ticks.map((t) => tickLabel(t, "year")),
        ["-0100", "-0050", "0000", "0050", "0100", "0150"],
    );
});

Deno.test("a window around year -1 has ticks on round negative years", () => {
    const result = ticks(at(-12, 1, 1), at(8, 1, 1), 11);

    assertEquals(result.kind, "year");
    assertEquals(
        result.ticks.map((t) => toParts(t).y),
        [-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8],
    );
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
    assertEquals(tickLabel(at(2026, 3, 4, 5, 6, 7), "seconds"), "05:06:07");
});

Deno.test("a year before 0 is written with a minus and four digits", () => {
    assertEquals(tickLabel(at(-43, 1, 1), "year"), "-0043");
    assertEquals(tickLabel(at(-9999, 1, 1), "year"), "-9999");
    assertEquals(tickLabel(at(0, 1, 1), "year"), "0000");
    assertEquals(tickLabel(at(-43, 3, 1), "month"), "Mar");
    assertEquals(
        tipText(at(-43, 3, 15, 9, 5), 43200),
        "15 Mar -0043 09:05 UTC",
    );
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

const ORBIT = { period: 100, timeToPeriapsis: 30, timeToApoapsis: 80 };

const times = (marks: { name: string; t: number }[], name: string) =>
    marks.filter((mark) => mark.name === name).map((mark) => mark.t);

Deno.test("far apart apsides all show, with labels", () => {
    // 50 s between marks at 1 px/s is 50 px.
    const marks = apsisMarks(ORBIT, 1000, 800, 1200, 1);

    assertEquals(times(marks, "Pe"), [830, 930, 1030, 1130]);
    assertEquals(times(marks, "Ap"), [880, 980, 1080, 1180]);
    assertEquals(
        marks.map((mark) => mark.t),
        marks.map((mark) => mark.t).toSorted((a, b) => a - b),
    );
    assertEquals(
        marks.every((mark) => mark.labelled),
        true,
    );
});

Deno.test("closer apsides all show, as squares", () => {
    // 50 s between marks at 0.3 px/s is 15 px.
    const marks = apsisMarks(ORBIT, 1000, 0, 2000, 0.3);

    assertEquals(times(marks, "Pe").length, 20);
    assertEquals(times(marks, "Ap").length, 20);
    assertEquals(
        marks.some((mark) => mark.labelled),
        false,
    );
    assertEquals(apsisMarks(ORBIT, 1000, 800, 1200, 0.6)[0]?.labelled, true);
    assertEquals(apsisMarks(ORBIT, 1000, 800, 1200, 0.24)[0]?.labelled, false);
});

Deno.test("fast apsides keep only every Nth periapsis, on the same orbits", () => {
    // 100 s per orbit at 0.1 px/s is 10 px, so every 2nd orbit clears 12 px: N = 2.
    const marks = apsisMarks(ORBIT, 1000, 0, 2000, 0.1);

    assertEquals(
        marks.every((mark) => mark.name === "Pe"),
        true,
    );
    assertEquals(
        marks.every((mark) => !mark.labelled),
        true,
    );
    assertEquals(
        marks.map((mark) => mark.t),
        [30, 230, 430, 630, 830, 1030, 1230, 1430, 1630, 1830],
    );
    // N is 12 / (100 * 0.01) = 12.
    const sparse = apsisMarks(ORBIT, 1000, 0, 5000, 0.01);

    assertEquals(
        sparse.map((mark) => mark.t),
        [30, 1230, 2430, 3630, 4830],
    );
});

Deno.test("thinned marks keep their times as the clock moves", () => {
    const at = (shift: number) =>
        apsisMarks(
            { ...ORBIT, timeToPeriapsis: 30 - shift },
            1000 + shift,
            0,
            3000,
            0.01,
        ).map((mark) => Math.round(mark.t));

    assertEquals(at(0), [30, 1230, 2430]);
    assertEquals(at(7), at(0));
    assertEquals(at(23), at(0));
});

Deno.test("a huge number of orbits in the window stays cheap", () => {
    const year = 365.25 * 86400;
    const marks = apsisMarks(
        { period: 5400, timeToPeriapsis: 1000, timeToApoapsis: 3700 },
        0,
        -60 * year,
        60 * year,
        1000 / (120 * year),
    );

    // At most one mark per 12 px of the 1000 px window.
    assertEquals(marks.length <= 84, true);
    assertEquals(marks.length >= 60, true);
});

Deno.test("a body with no orbit, or an open one, has no apsides", () => {
    assertEquals(apsisMarks(null, 0, -10, 10, 1), []);
    assertEquals(
        apsisMarks(
            {
                period: Number.POSITIVE_INFINITY,
                timeToPeriapsis: 5,
                timeToApoapsis: 6,
            },
            0,
            -10,
            10,
            1,
        ),
        [],
    );
    assertEquals(
        apsisMarks(
            { period: Number.NaN, timeToPeriapsis: 5, timeToApoapsis: 6 },
            0,
            -10,
            10,
            1,
        ),
        [],
    );
});

Deno.test("a label goes right of its tick, or left when the right is taken", () => {
    const line: [number, number][] = [[96, 104]];

    assertEquals(labelLeft([54, 42], 30, [], 0, 400), 54);
    assertEquals(labelLeft([80, 20], 30, line, 0, 400), 20);
    assertEquals(labelLeft([70, 12], 30, line, 0, 400), 12);
});

Deno.test("a label that fits neither side is dropped", () => {
    assertEquals(labelLeft([54, 12], 30, [[40, 70]], 0, 400), null);
    assertEquals(labelLeft([390], 30, [], 24, 376), null);
    assertEquals(labelLeft([10], 30, [], 24, 376), null);
    assertEquals(labelLeft([24, 400], 30, [], 24, 376), 24);
});

Deno.test("a label may touch a range's edge but not cross it", () => {
    assertEquals(labelLeft([40], 20, [[60, 70]], 0, 400), 40);
    assertEquals(labelLeft([41], 20, [[60, 70]], 0, 400), null);
});
