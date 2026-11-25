/// <reference types="deno" />
import { PRESETS, solarSystem } from "@cpluspatch/catalog";
import { compile, documentOf } from "@cpluspatch/sim";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertThrows,
} from "@std/assert";
import { bodyStats } from "./body-stats.ts";

const DEG = Math.PI / 180;

const system = compile(documentOf(solarSystem), PRESETS);

Deno.test("the Earth's stats match the known values", () => {
    const earth = bodyStats(system, "earth", 0);

    assertAlmostEquals(earth.mass ?? 0, 5.972e24, 0.01e24);
    assertAlmostEquals(earth.radius ?? 0, 6_371_000, 1000);
    assertAlmostEquals(earth.gravity ?? 0, 9.82, 0.05);
    assertAlmostEquals(earth.escapeSpeed ?? 0, 11_186, 20);
    assertAlmostEquals(earth.day ?? 0, 86_164, 2);
    assertAlmostEquals((earth.tilt ?? 0) / DEG, 23.44, 0.1);
});

Deno.test("a spacecraft has no mass, gravity, escape speed or radius", () => {
    const iss = bodyStats(system, "iss", 0);

    assertEquals(iss.mass, null);
    assertEquals(iss.gravity, null);
    assertEquals(iss.escapeSpeed, null);
    assertEquals(iss.radius, null);
});

Deno.test("a body with no mass still has a radius", () => {
    const makemake = bodyStats(system, "makemake", 0);

    assertEquals(makemake.mass, null);
    assert((makemake.radius ?? 0) > 0);
});

Deno.test("the root is tilted from the ecliptic pole", () => {
    assertAlmostEquals(
        (bodyStats(system, "sun", 0).tilt ?? 0) / DEG,
        7.25,
        0.1,
    );
});

Deno.test("an unknown body throws", () => {
    assertThrows(() => bodyStats(system, "no-such-body", 0));
});
