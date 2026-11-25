/// <reference types="deno" />
import { type Elements, orbitPoints } from "@cpluspatch/orbit";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
    axisPosition,
    gripNoteSpots,
    latitudeAnomaly,
    planeAngle,
    pointAtAnomaly,
} from "./grips.ts";

const ORIGIN = { x: 0, y: 0, z: 0 };

const TILTED: Elements = {
    a: 7e6,
    e: 0.3,
    i: 0.9,
    raan: 1,
    argp: 2,
    m0: 0,
    epoch: 0,
};

Deno.test("a circular orbit's node is at minus its argument of periapsis", () => {
    assertAlmostEquals(latitudeAnomaly(0, 1, 0), 2 * Math.PI - 1);
    assertAlmostEquals(latitudeAnomaly(0, 0, 0), 0);
});

Deno.test("the node is level with the parent and the orbit climbs after it", () => {
    for (const e of [0, 0.3, 0.9]) {
        for (const argp of [0.5, 2, 4, 6]) {
            const el = { ...TILTED, e, argp, i: 0.7 };
            const at = latitudeAnomaly(e, argp, 0);

            assertAlmostEquals(pointAtAnomaly(el, at).z / el.a, 0, 1e-9);
            assert(pointAtAnomaly(el, at + 0.01).z > 0);
        }
    }
});

Deno.test("half a turn of latitude on from the node is the descending node", () => {
    for (const e of [0, 0.3, 0.9]) {
        for (const argp of [0.5, 2, 4, 6]) {
            const el = { ...TILTED, e, argp };
            const down = pointAtAnomaly(el, latitudeAnomaly(e, argp, Math.PI));

            const r = Math.hypot(down.x, down.y, down.z);

            assertAlmostEquals(down.x / r, -Math.cos(el.raan), 1e-9);
            assertAlmostEquals(down.y / r, -Math.sin(el.raan), 1e-9);
            assertAlmostEquals(down.z / r, 0, 1e-9);
        }
    }
});

Deno.test("a point at an anomaly is where the orbit's samples are", () => {
    const samples = orbitPoints(TILTED, 24);

    for (const k of [0, 5, 12, 19]) {
        const point = pointAtAnomaly(TILTED, (2 * Math.PI * k) / 24);

        assertAlmostEquals(point.x, samples[3 * k] ?? Number.NaN, 1e-6);
        assertAlmostEquals(point.y, samples[3 * k + 1] ?? Number.NaN, 1e-6);
        assertAlmostEquals(point.z, samples[3 * k + 2] ?? Number.NaN, 1e-6);
    }
});

Deno.test("the pointer's place on an axis is a fraction of the axis", () => {
    assertAlmostEquals(axisPosition(50, 0, 100, 0, 100) ?? Number.NaN, 0.5);
    assertAlmostEquals(axisPosition(150, 30, 100, 0, 100) ?? Number.NaN, 1.5);
    assertAlmostEquals(axisPosition(0, 40, 0, 80, 100) ?? Number.NaN, 0.5);
});

Deno.test("the pointer behind the start of an axis is negative", () => {
    assertAlmostEquals(axisPosition(-50, 0, 100, 0, 100) ?? Number.NaN, -0.5);
});

Deno.test("an axis that points at the viewer can't place the pointer", () => {
    assertEquals(axisPosition(10, 10, 20, 0, 100), null);
    assert(axisPosition(10, 10, 30, 0, 100) !== null);
});

Deno.test("a ray down onto the plane gives the angle of its hit round the centre", () => {
    const centre = { x: 10, y: 0, z: 5 };
    const origin = { x: 10, y: 0, z: 25 };
    const dir = { x: 0, y: 1, z: -1 };

    assertAlmostEquals(
        planeAngle(origin, dir, centre) ?? Number.NaN,
        Math.PI / 2,
    );
    assertAlmostEquals(
        planeAngle(origin, { x: -1, y: 0, z: -1 }, centre) ?? Number.NaN,
        Math.PI,
    );
});

Deno.test("a ray along the plane doesn't hit it", () => {
    const origin = { x: 0, y: 0, z: 10 };

    assertEquals(planeAngle(origin, { x: 1, y: 0, z: -0.01 }, ORIGIN), null);
});

Deno.test("a ray going away from the plane doesn't hit it", () => {
    const origin = { x: 0, y: 0, z: 10 };

    assertEquals(planeAngle(origin, { x: 1, y: 0, z: 1 }, ORIGIN), null);
});

Deno.test("a drag note goes right of its grip, then left, then below", () => {
    const [right, left, below] = gripNoteSpots(100, 50, 60);

    assertEquals(right?.left, 114);
    assertEquals(left?.right, 86);
    assertEquals(below?.top, 63);
    assertEquals((right?.right ?? 0) - (right?.left ?? 0), 64);
});
