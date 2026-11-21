/// <reference types="deno" />
import { AU, solarSystem, sortByDepth, worldStates } from "@cpluspatch/orbit";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertThrows,
} from "@std/assert";
import { readouts } from "./readouts.ts";

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

Deno.test("the true anomaly is in [0, 2π)", () => {
    for (const t of [0, 1e4, 1e6, -1e6]) {
        const moon = at("moon", t);

        assert(moon);
        assert(moon.trueAnomaly >= 0 && moon.trueAnomaly < 2 * Math.PI);
    }
});
