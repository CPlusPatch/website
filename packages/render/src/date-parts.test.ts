/// <reference types="deno" />
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { assertEquals } from "@std/assert";
import {
    type DateParts,
    fromParts,
    parsePasted,
    partsProblem,
    stepPart,
    toParts,
} from "./date-parts.ts";

const parts = (
    y: number,
    mo: number,
    d: number,
    h = 0,
    mi = 0,
    s = 0,
): DateParts => ({ y, mo, d, h, mi, s });

Deno.test("J2000 is noon on 1 January 2000 in UTC", () => {
    assertEquals(toParts(0), parts(2000, 1, 1, 12));
    assertEquals(fromParts(parts(2000, 1, 1, 12)), 0);
});

Deno.test("toParts rounds to the second", () => {
    assertEquals(toParts(0.4), parts(2000, 1, 1, 12));
    assertEquals(toParts(0.6), parts(2000, 1, 1, 12, 0, 1));
});

Deno.test("a time before 2000 round-trips through its parts", () => {
    const t = unixMsToJ2000s(Date.UTC(1969, 6, 20, 20, 17, 40));

    assertEquals(toParts(t), parts(1969, 7, 20, 20, 17, 40));
    assertEquals(fromParts(toParts(t)), t);
});

Deno.test("a year below 100 isn't read as 19xx", () => {
    assertEquals(toParts(fromParts(parts(44, 3, 15))).y, 44);
    assertEquals(toParts(fromParts(parts(1, 1, 1))), parts(1, 1, 1));
});

Deno.test("partsProblem accepts a valid date", () => {
    assertEquals(partsProblem(parts(2024, 2, 29, 23, 59, 59)), null);
});

Deno.test("partsProblem names the first part out of range", () => {
    assertEquals(partsProblem(parts(10000, 1, 1)), {
        part: "y",
        message: "Year must be -9999 to 9999.",
    });
    assertEquals(partsProblem(parts(-10000, 1, 1))?.part, "y");
    assertEquals(partsProblem(parts(2024, 13, 1)), {
        part: "mo",
        message: "Month must be 1 to 12.",
    });
    assertEquals(partsProblem(parts(2024, 2, 30)), {
        part: "d",
        message: "Day must be 1 to 29 in February 2024.",
    });
    assertEquals(
        partsProblem(parts(2023, 2, 29))?.message,
        "Day must be 1 to 28 in February 2023.",
    );
    assertEquals(
        partsProblem(parts(2024, 1, 1, 24))?.message,
        "Hour must be 0 to 23.",
    );
    assertEquals(
        partsProblem(parts(2024, 1, 1, 0, 60))?.message,
        "Minute must be 0 to 59.",
    );
    assertEquals(
        partsProblem(parts(2024, 1, 1, 0, 0, 60))?.message,
        "Second must be 0 to 59.",
    );
});

Deno.test("partsProblem accepts years from -9999, including 0", () => {
    assertEquals(partsProblem(parts(-9999, 1, 1)), null);
    assertEquals(partsProblem(parts(0, 2, 29)), null);
    assertEquals(partsProblem(parts(-1, 2, 29))?.part, "d");
});

Deno.test("partsProblem treats NaN as out of range", () => {
    assertEquals(partsProblem(parts(Number.NaN, 1, 1))?.part, "y");
    assertEquals(partsProblem(parts(2024, 1, Number.NaN))?.part, "d");
    assertEquals(partsProblem(parts(2024, 1, 1, 0, 0, Number.NaN))?.part, "s");
});

Deno.test("stepPart keeps the day inside a shorter month", () => {
    assertEquals(stepPart(parts(2024, 1, 31), "mo", 1), parts(2024, 2, 29));
    assertEquals(stepPart(parts(2023, 1, 31), "mo", 1), parts(2023, 2, 28));
    assertEquals(stepPart(parts(2024, 2, 29), "y", 1), parts(2025, 2, 28));
});

Deno.test("stepPart carries a month into the year", () => {
    assertEquals(stepPart(parts(2024, 12, 15), "mo", 1), parts(2025, 1, 15));
    assertEquals(stepPart(parts(2024, 1, 15), "mo", -1), parts(2023, 12, 15));
});

Deno.test("stepPart carries days, hours, minutes and seconds", () => {
    assertEquals(stepPart(parts(2024, 12, 31), "d", 1), parts(2025, 1, 1));
    assertEquals(stepPart(parts(2024, 3, 1), "d", -1), parts(2024, 2, 29));
    assertEquals(stepPart(parts(2024, 1, 1, 23), "h", 1), parts(2024, 1, 2));
    assertEquals(
        stepPart(parts(2024, 1, 1, 0, 59), "mi", 1),
        parts(2024, 1, 1, 1),
    );
    assertEquals(
        stepPart(parts(2024, 1, 1, 0, 0, 59), "s", 1),
        parts(2024, 1, 1, 0, 1),
    );
});

Deno.test("stepPart goes from year 1 to 0 to -1", () => {
    assertEquals(stepPart(parts(1, 6, 15), "y", -1), parts(0, 6, 15));
    assertEquals(stepPart(parts(0, 6, 15), "y", -1), parts(-1, 6, 15));
    assertEquals(stepPart(parts(1, 1, 1), "mo", -1), parts(0, 12, 1));
    assertEquals(stepPart(parts(1, 1, 1), "d", -1), parts(0, 12, 31));
    assertEquals(stepPart(parts(-1, 12, 31), "d", 1), parts(0, 1, 1));
    assertEquals(stepPart(parts(0, 2, 29), "y", -1), parts(-1, 2, 28));
});

Deno.test("stepPart is null past the years -9999 and 9999, or from an invalid date", () => {
    assertEquals(stepPart(parts(9999, 12, 31, 23, 59, 59), "s", 1), null);
    assertEquals(stepPart(parts(9999, 6, 1), "y", 1), null);
    assertEquals(stepPart(parts(-9999, 1, 1), "d", -1), null);
    assertEquals(stepPart(parts(-9999, 1, 1), "mo", -1), null);
    assertEquals(stepPart(parts(-9999, 6, 1), "y", -1), null);
    assertEquals(stepPart(parts(2024, 2, 30), "d", 1), null);
});

Deno.test("parsePasted reads a date, with or without a time", () => {
    assertEquals(parsePasted("2024-03-05"), parts(2024, 3, 5));
    assertEquals(parsePasted("2024-03-05T14:30"), parts(2024, 3, 5, 14, 30));
    assertEquals(
        parsePasted(" 2024-03-05 14:30:09 "),
        parts(2024, 3, 5, 14, 30, 9),
    );
    assertEquals(
        parsePasted("2024-03-05T14:30:09Z"),
        parts(2024, 3, 5, 14, 30, 9),
    );
});

Deno.test("parsePasted reads a year before 0 with a minus", () => {
    assertEquals(parsePasted("-0043-03-15"), parts(-43, 3, 15));
    assertEquals(
        parsePasted("-9999-01-01 00:00:01"),
        parts(-9999, 1, 1, 0, 0, 1),
    );
    assertEquals(parsePasted("--0043-03-15"), null);
});

Deno.test("a year before 0 round-trips through its parts", () => {
    assertEquals(
        toParts(fromParts(parts(-43, 3, 15, 12))),
        parts(-43, 3, 15, 12),
    );
    assertEquals(toParts(fromParts(parts(0, 1, 1))), parts(0, 1, 1));
});

Deno.test("parsePasted is null for text that isn't a date", () => {
    assertEquals(parsePasted("tomorrow"), null);
    assertEquals(parsePasted("03/05/2024"), null);
    assertEquals(parsePasted(""), null);
    assertEquals(parsePasted("2024-03-05 14:30 and more"), null);
});
