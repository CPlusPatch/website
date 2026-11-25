/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { AU } from "@cpluspatch/orbit";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertThrows,
} from "@std/assert";
import { distanceOf, readouts } from "./readouts.ts";
import { sortByDepth } from "./scenario.ts";
import { worldStates } from "./system.ts";

const at = (id: string, t: number) =>
    readouts(
        solarSystem,
        id,
        worldStates(solarSystem, sortByDepth(solarSystem), t),
        t,
    );

Deno.test("the root has no readouts", () => {
    assertEquals(at("sun", 0), null);
});

Deno.test("an unknown body throws", () => {
    assertThrows(() => at("nowhere", 0));
});

Deno.test("Earth is about 1 AU from the Sun and orbits in about a year", () => {
    const earth = at("earth", 0);

    assert(earth);
    assertAlmostEquals(earth.distance / AU, 1, 0.02);
    assertAlmostEquals(earth.period / 86400, 365.25, 0.1);
    assertAlmostEquals(earth.speed, 29_800, 1000);
});

Deno.test("the ISS is measured from Earth, not from the Sun", () => {
    const iss = at("iss", 0);

    assert(iss);
    assertAlmostEquals(iss.distance, 6.78e6, 2e5);
    assertAlmostEquals(iss.speed, 7660, 200);
    assertAlmostEquals(iss.period / 60, 92.7, 1);
});

Deno.test("altitudes are measured above the parent's radius", () => {
    const iss = at("iss", 0);

    assert(iss);
    assert(iss.periapsisAltitude > 3e5 && iss.periapsisAltitude < 5e5);
    assert(iss.apoapsisAltitude >= iss.periapsisAltitude);
    assert(iss.apoapsisAltitude < 5e5);
});

Deno.test("the next apsides come within one period, apoapsis half a period from periapsis", () => {
    for (const t of [0, 1e4, 1e6, -1e6]) {
        const iss = at("iss", t);

        assert(iss);
        assert(iss.timeToPeriapsis > 0 && iss.timeToPeriapsis <= iss.period);
        assert(iss.timeToApoapsis > 0 && iss.timeToApoapsis <= iss.period);
        assertAlmostEquals(
            (iss.timeToApoapsis - iss.timeToPeriapsis + iss.period) %
                iss.period,
            iss.period / 2,
            1,
        );
    }
});

Deno.test("the time to the next apsis matches the body's state a moment later", () => {
    const before = at("moon", 0);
    assert(before);
    // Just after the next periapsis, the body is back near zero anomaly.
    const after = at("moon", before.timeToPeriapsis + 1);

    assert(after);
    assert(after.trueAnomaly < 0.01 || after.trueAnomaly > 2 * Math.PI - 0.01);
});

Deno.test("the true anomaly is in [0, 2π)", () => {
    for (const t of [0, 1e4, 1e6, -1e6]) {
        const moon = at("moon", t);

        assert(moon);
        assert(moon.trueAnomaly >= 0 && moon.trueAnomaly < 2 * Math.PI);
    }
});

Deno.test("a body's distance matches its readouts, and the root has none", () => {
    const states = worldStates(solarSystem, sortByDepth(solarSystem), 0);
    const body = (id: string) => {
        const found = solarSystem.bodies.find(
            (candidate) => candidate.id === id,
        );
        assert(found);

        return found;
    };

    assertEquals(distanceOf(states, body("sun")), null);
    assertEquals(distanceOf(states, body("moon")), at("moon", 0)?.distance);
});
