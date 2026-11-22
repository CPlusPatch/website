/// <reference types="deno" />
import { AU } from "@cpluspatch/orbit";
import { assertEquals } from "@std/assert";
import {
    distanceParts,
    formatAngle,
    formatApsisChange,
    formatDistance,
    formatDuration,
    formatNodeChange,
    formatSoon,
    formatSpeed,
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
