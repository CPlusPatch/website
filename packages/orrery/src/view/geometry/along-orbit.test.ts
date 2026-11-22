/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
    arcLengthAt,
    nearAnomalies,
    nearestPoint,
    trailAlpha,
    trailBack,
} from "./along-orbit.ts";

Deno.test("the nearest point is the one closest to the position, among the first count", () => {
    const points = [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 0, 0];

    assertEquals(nearestPoint(points, 3, 9, 1, 0), 1);
    assertEquals(nearestPoint(points, 3, 8, 12, 0), 2);
    assertEquals(nearestPoint(points, 3, 0, 0, 1), 0);
    assertEquals(nearestPoint([5, 5, 5, 5, 5, 6], 2, 5, 5, 7), 1);
});

Deno.test("the distance along a loop is interpolated in the table and keeps growing past a lap", () => {
    const table = [0, 10, 30, 40, 100];
    const lap = 2 * Math.PI;

    assertAlmostEquals(arcLengthAt(table, 0), 0);
    assertAlmostEquals(arcLengthAt(table, lap / 4), 10);
    assertAlmostEquals(arcLengthAt(table, lap * 0.375), 20);
    assertAlmostEquals(arcLengthAt(table, lap * 0.99), 40 + 60 * 0.96);
    assertAlmostEquals(arcLengthAt(table, lap + lap / 2), 100 + 30);
    assertAlmostEquals(arcLengthAt(table, -lap / 4), 40 - 100);
});

Deno.test("an orbit line is brightest at its body and fades along the trail", () => {
    assertAlmostEquals(trailAlpha(0, 100, false), 0.57);
    assertAlmostEquals(trailAlpha(100, 100, false), 0.12);
    assertAlmostEquals(trailAlpha(0, 100, true), 1);
    assertAlmostEquals(trailAlpha(50, 100, true), 0.65);
    assertAlmostEquals(trailAlpha(100, 100, true), 0.3);
});

Deno.test("the trail runs back against the motion, wrapping round the loop", () => {
    assertEquals(trailBack(10, 10, 100, 1), 0);
    assertEquals(trailBack(7, 10, 100, 1), 3);
    assertEquals(trailBack(12, 10, 100, 1), 98);
    assertEquals(trailBack(12, 10, 100, -1), 2);
    assertEquals(trailBack(7, 10, 100, -1), 97);
});

Deno.test("near anomalies run once round the orbit, growing from the body", () => {
    const count = 2048;
    const center = 1.3;
    const first = 0.004;
    const anomalies = nearAnomalies(center, first, count);

    assertEquals(anomalies.length, count + 1);
    assertAlmostEquals(anomalies[0] ?? 0, center - Math.PI, 1e-12);
    assertAlmostEquals(anomalies[count] ?? 0, center + Math.PI, 1e-12);
    assertEquals(anomalies[count / 2], center);
    assertAlmostEquals((anomalies[count / 2 + 1] ?? 0) - center, first, 1e-12);
    assertAlmostEquals(center - (anomalies[count / 2 - 1] ?? 0), first, 1e-12);

    for (let k = 1; k <= count; k++) {
        assert((anomalies[k] ?? 0) > (anomalies[k - 1] ?? 0));
    }
});
