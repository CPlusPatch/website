/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { assertVecClose, MU, mulberry32, randomElements } from "./fixture.ts";
import type { Elements } from "./kepler.ts";
import {
    apoapsis,
    eccentricAnomalyOf,
    meanAnomalyAt,
    meanMotion,
    orbitPoints,
    orbitPointsAt,
    periapsis,
    period,
    solveKepler,
    stateAt,
    trueAnomalyAt,
    wrapAngle,
} from "./kepler.ts";
import { dot, length } from "./vec.ts";

const base: Elements = {
    a: 1e7,
    e: 0,
    i: 0.4,
    raan: 1,
    argp: 2,
    m0: 0.7,
    epoch: 0,
};

Deno.test("wrapAngle maps angles into [0, 2π)", () => {
    assertAlmostEquals(wrapAngle(-0.5), 2 * Math.PI - 0.5, 1e-12);
    assertAlmostEquals(wrapAngle(7), 7 - 2 * Math.PI, 1e-12);
    assert(wrapAngle(-1e-20) < 2 * Math.PI);
});

Deno.test("solveKepler leaves a residual below 1e-12", () => {
    for (const e of [0, 0.1, 0.5, 0.9, 0.99]) {
        for (const m of [0, 0.001, 1, Math.PI, 2 * Math.PI - 0.001]) {
            const ea = solveKepler(m, e);

            assert(
                Math.abs(ea - e * Math.sin(ea) - m) < 1e-12,
                `e=${e} M=${m}`,
            );
        }
    }
});

Deno.test("a circular orbit has constant radius and speed", () => {
    for (const t of [0, 100, 1234.5]) {
        const { r, v } = stateAt(base, MU, t);

        assertAlmostEquals(length(r) / base.a, 1, 1e-9);
        assertAlmostEquals(length(v) / Math.sqrt(MU / base.a), 1, 1e-9);
    }
});

Deno.test("at mean anomaly 0 the body is at periapsis", () => {
    const el = { ...base, e: 0.3, m0: 0 };

    assertAlmostEquals(length(stateAt(el, MU, 0).r) / (el.a * 0.7), 1, 1e-9);
    assertAlmostEquals(periapsis(el), el.a * 0.7, 1e-6);
    assertAlmostEquals(apoapsis(el), el.a * 1.3, 1e-6);
});

Deno.test("the velocity is perpendicular to the radius at periapsis", () => {
    const { r, v } = stateAt({ ...base, e: 0.5, m0: 0 }, MU, 0);

    assertAlmostEquals(dot(r, v) / (length(r) * length(v)), 0, 1e-9);
});

Deno.test("random orbits obey the vis-viva equation", () => {
    const rand = mulberry32(1);

    for (let k = 0; k < 100; k++) {
        const el = randomElements(rand);
        const { r, v } = stateAt(el, MU, rand() * 1e7);
        const expected = MU * (2 / length(r) - 1 / el.a);

        assertAlmostEquals(dot(v, v) / expected, 1, 1e-9);
    }
});

Deno.test("the state repeats after one period", () => {
    const rand = mulberry32(2);

    for (let k = 0; k < 20; k++) {
        const el = randomElements(rand);
        const t = rand() * 1e6;
        const before = stateAt(el, MU, t);
        const after = stateAt(el, MU, t + period(el, MU));

        assertVecClose(after.r, before.r, 1e-7);
        assertVecClose(after.v, before.v, 1e-7);
    }
});

Deno.test("the period is 2π over the mean motion", () => {
    assertAlmostEquals(
        period(base, MU) * meanMotion(base, MU),
        2 * Math.PI,
        1e-12,
    );
});

Deno.test("the mean anomaly advances with time and wraps", () => {
    const el = { ...base, m0: 6 };
    const quarter = period(el, MU) / 4;

    assertAlmostEquals(
        meanAnomalyAt(el, MU, quarter),
        wrapAngle(6 + Math.PI / 2),
        1e-9,
    );
});

Deno.test("orbit points lie on the orbit, starting at periapsis", () => {
    const el = { ...base, e: 0.4, m0: 0 };
    const points = orbitPoints(el, 64);
    const start = stateAt(el, MU, 0).r;

    assertEquals(points.length, 64 * 3);
    assertVecClose({ x: points[0], y: points[1], z: points[2] }, start);

    for (let k = 0; k < 64; k++) {
        const r = Math.hypot(
            points[k * 3],
            points[k * 3 + 1],
            points[k * 3 + 2],
        );

        assert(
            r >= periapsis(el) * (1 - 1e-9) && r <= apoapsis(el) * (1 + 1e-9),
        );
    }
});

Deno.test("orbit points default to 256 samples", () => {
    assertEquals(orbitPoints(base).length, 256 * 3);
});

Deno.test("the true anomaly is 0 at periapsis and π at apoapsis", () => {
    const el = { ...base, e: 0.6, m0: 0 };
    const half = period(el, MU) / 2;

    assertAlmostEquals(trueAnomalyAt(el, MU, 0), 0, 1e-9);
    assertAlmostEquals(trueAnomalyAt(el, MU, half), Math.PI, 1e-6);
});

Deno.test("on a circular orbit the true anomaly is the mean anomaly", () => {
    for (const t of [0, 100, 5000, 1e5]) {
        assertAlmostEquals(
            trueAnomalyAt(base, MU, t),
            meanAnomalyAt(base, MU, t),
            1e-9,
        );
    }
});

Deno.test("the true anomaly is the angle from the periapsis direction to the radius", () => {
    const rand = mulberry32(3);

    for (let k = 0; k < 50; k++) {
        const el = randomElements(rand);
        const t = rand() * 1e7;
        const periapsisDirection = stateAt({ ...el, m0: 0 }, MU, el.epoch).r;
        const { r } = stateAt(el, MU, t);
        const angle = Math.acos(
            Math.min(
                1,
                Math.max(
                    -1,
                    dot(r, periapsisDirection) /
                        (length(r) * length(periapsisDirection)),
                ),
            ),
        );
        const nu = trueAnomalyAt(el, MU, t);

        assert(nu >= 0 && nu < 2 * Math.PI);
        assertAlmostEquals(Math.min(nu, 2 * Math.PI - nu), angle, 1e-6);
    }
});

Deno.test("orbitPointsAt at uniform anomalies gives the points of orbitPoints", () => {
    const el = { ...base, e: 0.4 };
    const anomalies = Array.from(
        { length: 32 },
        (_, k) => (2 * Math.PI * k) / 32,
    );

    assertEquals(orbitPointsAt(el, anomalies), orbitPoints(el, 32));
});

Deno.test("eccentricAnomalyOf recovers the anomaly of a body's position on an inclined eccentric orbit", () => {
    const el = { ...base, a: 5.9e9, e: 0.25, i: 0.3, m0: 0 };
    const rand = mulberry32(7);

    for (let n = 0; n < 50; n++) {
        const t = rand() * 2 * period(el, MU);
        const expected = solveKepler(meanAnomalyAt(el, MU, t), el.e);
        const actual = eccentricAnomalyOf(el, stateAt(el, MU, t).r);
        const diff = wrapAngle(actual - expected + Math.PI) - Math.PI;

        assertAlmostEquals(diff, 0, 1e-9);
    }

    const point = orbitPointsAt(el, [2.5]);
    assertAlmostEquals(
        eccentricAnomalyOf(el, {
            x: point[0] ?? 0,
            y: point[1] ?? 0,
            z: point[2] ?? 0,
        }),
        2.5,
        1e-9,
    );
});
