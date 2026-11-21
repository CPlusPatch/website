/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { AU, DAY, OBLIQUITY_J2000 } from "../constants.ts";
import { assertVecClose } from "../fixture.ts";
import { period, stateAt, wrapAngle } from "../kepler.ts";
import { sortByDepth } from "../scenario.ts";
import { worldStates } from "../system.ts";
import { j2000sToUnixMs, unixMsToJ2000s } from "../time.ts";
import { cross, length } from "../vec.ts";
import { solarSystem } from "./solar-system.ts";

const find = (id: string) => {
    const body = solarSystem.bodies.find((b) => b.id === id);

    assert(body?.elements, `no orbiting body ${id}`);

    return { ...body, elements: body.elements };
};

Deno.test("there are 12 bodies with the expected ids", () => {
    assertEquals(
        solarSystem.bodies.map((b) => b.id),
        [
            "sun",
            "mercury",
            "venus",
            "earth",
            "mars",
            "jupiter",
            "saturn",
            "uranus",
            "neptune",
            "pluto",
            "moon",
            "iss",
        ],
    );
});

Deno.test("the Earth is 0.9833 AU from the Sun near perihelion in January 2026", () => {
    const t = unixMsToJ2000s(Date.UTC(2026, 0, 3, 12));
    const earth = worldStates(solarSystem, sortByDepth(solarSystem), t).get(
        "earth",
    );

    assert(earth);
    assertAlmostEquals(length(earth.r) / AU, 0.9833, 0.001);
});

Deno.test("the Moon's period around the Earth is 27.32 days", () => {
    const earth = find("earth");
    const moon = find("moon");

    assertAlmostEquals(
        period(moon.elements, earth.mu + moon.mu) / DAY,
        27.32,
        0.05,
    );
});

Deno.test("the ISS orbits in about 93 minutes from an epoch on 2026-11-21", () => {
    const earth = find("earth");
    const iss = find("iss");
    const minutes = period(iss.elements, earth.mu + iss.mu) / 60;

    assert(minutes > 92 && minutes < 94, `period is ${minutes} minutes`);
    assertEquals(
        new Date(j2000sToUnixMs(iss.elements.epoch)).toISOString().slice(0, 10),
        "2026-11-21",
    );
});

Deno.test("the ISS inclination is converted to the ecliptic and recovers 51.6319 degrees", () => {
    const earth = find("earth");
    const iss = find("iss");
    const mu = earth.mu + iss.mu;
    const toDeg = (x: number) => (x * 180) / Math.PI;
    const { r, v } = stateAt(iss.elements, mu, iss.elements.epoch);

    // Rotating the ecliptic state back to the equator undoes the conversion.
    const c = Math.cos(OBLIQUITY_J2000);
    const s = Math.sin(OBLIQUITY_J2000);
    const back = (p: { x: number; y: number; z: number }) => ({
        x: p.x,
        y: p.y * c - p.z * s,
        z: p.y * s + p.z * c,
    });
    const h = cross(back(r), back(v));

    assert(Math.abs(toDeg(iss.elements.i) - 51.6319) > 1);
    assertAlmostEquals(toDeg(Math.acos(h.z / length(h))), 51.6319, 1e-6);
});

Deno.test("Earth's negative Table 1 inclination is the same orbit after the flip", () => {
    const earth = find("earth");
    const deg = (x: number) => (x * Math.PI) / 180;

    // The raw row, with i < 0 left in, which stateAt handles.
    const raw = {
        ...earth.elements,
        i: deg(-0.00001531),
        raan: 0,
        argp: wrapAngle(deg(102.93768193)),
        m0: wrapAngle(deg(100.46457166 - 102.93768193)),
    };
    const t = unixMsToJ2000s(Date.UTC(2026, 0, 3, 12));
    const mu = solarSystem.bodies[0].mu + earth.mu;

    const flipped = stateAt(earth.elements, mu, t);
    const expected = stateAt(raw, mu, t);

    assert(earth.elements.i >= 0);
    assertVecClose(flipped.r, expected.r);
    assertVecClose(flipped.v, expected.v);
});
