/// <reference types="deno" />
import { AU } from "@cpluspatch/orbit";
import { assertEquals } from "@std/assert";
import {
    distanceParts,
    formatAngle,
    formatApsisChange,
    formatDistance,
    formatDuration,
    formatEscapeSpeed,
    formatGravity,
    formatInclinationChange,
    formatMass,
    formatNodeChange,
    formatPlateDistance,
    formatRadius,
    formatRange,
    formatSoon,
    formatSpeed,
    listUnit,
} from "./format.ts";

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

Deno.test("formatDistance follows the chosen unit at any size", () => {
    assertEquals(formatDistance(AU, "km"), "149,597,871 km");
    assertEquals(formatDistance(6_790_000, "AU"), "4.54e-5 AU");
    assertEquals(formatDistance(0.5 * AU, "AU"), "0.500 AU");
    assertEquals(formatDistance(0.00099 * AU, "AU"), "9.90e-4 AU");
    assertEquals(formatDistance(0.001 * AU, "AU"), "0.001 AU");
    assertEquals(formatDistance(0, "AU"), "0.000 AU");
    assertEquals(formatDistance(-2_527_000, "km"), "\u22122,527 km");
    assertEquals(formatDistance(AU, null), "1.000 AU");
});

Deno.test("distanceParts splits the number from the unit", () => {
    assertEquals(distanceParts(6_790_000), ["6,790", "km"]);
    assertEquals(distanceParts(AU), ["1.000", "AU"]);
    assertEquals(distanceParts(AU, "km"), ["149,597,871", "km"]);
    assertEquals(distanceParts(6_790_000, "AU"), ["4.54e-5", "AU"]);
});

Deno.test("formatRange keeps whole kilometres with grouping", () => {
    assertEquals(formatRange(384_400_000, "km"), "384,400 km");
    assertEquals(formatRange(-2_527_000, "km"), "\u22122,527 km");
});

Deno.test("formatRange shows AU with at most 4 significant digits and no trailing zeros", () => {
    assertEquals(formatRange(400 * AU, "AU"), "400 AU");
    assertEquals(formatRange(36.32 * AU, "AU"), "36.32 AU");
    assertEquals(formatRange(0.369 * AU, "AU"), "0.369 AU");
    assertEquals(formatRange(1.0159 * AU, "AU"), "1.016 AU");
    assertEquals(formatRange(0, "AU"), "0 AU");
});

Deno.test("formatRange keeps 4 significant digits under 0.001 AU, with no exponent", () => {
    assertEquals(formatRange(0.000297 * AU, "AU"), "0.000297 AU");
    assertEquals(formatRange(6_790_000, "AU"), "0.00004539 AU");
    assertEquals(formatRange(-0.0005 * AU, "AU"), "\u22120.0005 AU");
});

Deno.test("listUnit returns the chosen unit when there is one", () => {
    assertEquals(listUnit([AU], "km"), "km");
    assertEquals(listUnit([1000], "AU"), "AU");
});

Deno.test("listUnit follows the largest distance when none is chosen", () => {
    assertEquals(listUnit([6_790_000, 384_400_000], null), "km");
    assertEquals(listUnit([6_790_000, AU], null), "AU");
});

Deno.test("listUnit falls back to km for an empty list", () => {
    assertEquals(listUnit([], null), "km");
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

Deno.test("formatSoon writes one short unit for years, days, hours or minutes", () => {
    assertEquals(formatSoon(1.2 * 31557600), "1.2y");
    assertEquals(formatSoon(41 * 86400), "41d");
    assertEquals(formatSoon(3 * 3600), "3h");
    assertEquals(formatSoon(12 * 60), "12m");
});

Deno.test("formatSoon moves up a unit when rounding reaches it, and reads the past as 0m", () => {
    assertEquals(formatSoon(3599), "1h");
    assertEquals(formatSoon(86399), "1d");
    assertEquals(formatSoon(20), "0m");
    assertEquals(formatSoon(-90), "0m");
});

Deno.test("formatSoon changes unit at a year, a day and an hour", () => {
    assertEquals(formatSoon(31557600), "1.0y");
    assertEquals(formatSoon(31557600 - 86400 * 2), "363d");
    assertEquals(formatSoon(86400), "1d");
    assertEquals(formatSoon(86400 - 3600), "23h");
    assertEquals(formatSoon(3600), "1h");
    assertEquals(formatSoon(3540), "59m");
});

Deno.test("formatAngle writes degrees with one decimal", () => {
    assertEquals(formatAngle(0), "0.0°");
    assertEquals(formatAngle(Math.PI), "180.0°");
    assertEquals(formatAngle(1), "57.3°");
});

Deno.test("formatAngle never writes a full turn", () => {
    assertEquals(formatAngle(2 * Math.PI - 1e-5), "0.0°");
});

Deno.test("formatApsisChange writes the distance and its signed change in one unit", () => {
    assertEquals(
        formatApsisChange("Pe", 1.05 * AU, AU, "AU"),
        "Pe 1.050 AU (+0.050 AU)",
    );
    assertEquals(
        formatApsisChange("Ap", 0.95 * AU, AU, "AU"),
        "Ap 0.950 AU (−0.050 AU)",
    );
    assertEquals(
        formatApsisChange("Pe", 7_000_000, 6_800_000, null),
        "Pe 7,000 km (+200 km)",
    );
});

Deno.test("formatNodeChange writes the node and the shorter way round to it", () => {
    const deg = Math.PI / 180;

    assertEquals(formatNodeChange(125 * deg, 120 * deg), "Node 125.0° (+5.0°)");
    assertEquals(formatNodeChange(355 * deg, 5 * deg), "Node 355.0° (−10.0°)");
    assertEquals(formatNodeChange(5 * deg, 355 * deg), "Node 5.0° (+10.0°)");
});

Deno.test("formatInclinationChange writes the inclination and its change with a real minus", () => {
    const deg = Math.PI / 180;

    assertEquals(
        formatInclinationChange(28.5 * deg, 23.4 * deg),
        "Inc 28.5° (+5.1°)",
    );
    assertEquals(
        formatInclinationChange(23.4 * deg, 28.5 * deg),
        "Inc 23.4° (−5.1°)",
    );
});

Deno.test("formatMass writes 3 significant figures in scientific notation", () => {
    assertEquals(formatMass(5.972e24), "5.97 × 10²⁴ kg");
    assertEquals(formatMass(1.989e30), "1.99 × 10³⁰ kg");
    assertEquals(formatMass(420_000), "4.20 × 10⁵ kg");
    assertEquals(formatMass(9.996e24), "1.00 × 10²⁵ kg");
    assertEquals(formatMass(3.3e-3), "3.30 × 10⁻³ kg");
});

Deno.test("formatRadius groups kilometres from 100 km and keeps 3 figures below", () => {
    assertEquals(formatRadius(6_371_000), "6,371 km");
    assertEquals(formatRadius(99_950), "100 km");
    assertEquals(formatRadius(11_300), "11.3 km");
    assertEquals(formatRadius(6_200), "6.20 km");
});

Deno.test("formatGravity writes 3 significant figures", () => {
    assertEquals(formatGravity(9.82), "9.82 m/s²");
    assertEquals(formatGravity(0.057), "0.0570 m/s²");
    assertEquals(formatGravity(274), "274 m/s²");
});

Deno.test("formatEscapeSpeed writes 3 significant figures, in m/s under 1 km/s", () => {
    assertEquals(formatEscapeSpeed(11_186), "11.2 km/s");
    assertEquals(formatEscapeSpeed(617_670), "618 km/s");
    assertEquals(formatEscapeSpeed(11.39), "11.4 m/s");
});

Deno.test("formatPlateDistance writes AU with three decimals", () => {
    assertEquals(formatPlateDistance(0.983 * AU, "AU"), "0.983 AU");
    assertEquals(formatPlateDistance(30.07 * AU, "AU"), "30.070 AU");
});

Deno.test("formatPlateDistance writes millions of km from 1e6 km", () => {
    assertEquals(formatPlateDistance(146.5e9, "km"), "146.5M km");
    assertEquals(formatPlateDistance(1e9, "km"), "1.0M km");
});

Deno.test("formatPlateDistance groups whole km below 1e6 km", () => {
    assertEquals(formatPlateDistance(6_790_000, "km"), "6,790 km");
    assertEquals(formatPlateDistance(384_400_000, "km"), "384,400 km");
});
