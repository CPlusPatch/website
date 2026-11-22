/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { AU, DAY, OBLIQUITY_J2000 } from "../constants.ts";
import { nextApsisTime } from "../elements.ts";
import { assertVecClose } from "../fixture.ts";
import type { Elements } from "../kepler.ts";
import { axes, period, stateAt, wrapAngle } from "../kepler.ts";
import { bodyOrientation } from "../orientation.ts";
import { sortByDepth, validateScenario } from "../scenario.ts";
import { worldStates } from "../system.ts";
import { j2000sToUnixMs, unixMsToJ2000s } from "../time.ts";
import type { Vec3 } from "../vec.ts";
import { cross, dot, length, scale } from "../vec.ts";
import { MOON_ROWS, moonPole } from "./moons.ts";
import { solarSystem } from "./solar-system.ts";

const find = (id: string) => {
    const body = solarSystem.bodies.find((b) => b.id === id);

    assert(body?.elements, `no orbiting body ${id}`);

    return { ...body, elements: body.elements };
};

Deno.test("there are 38 bodies with the expected ids", () => {
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
            "ceres",
            "eris",
            "haumea",
            "makemake",
            "vesta",
            "halley",
            "moon",
            "iss",
            "phobos",
            "deimos",
            "io",
            "europa",
            "ganymede",
            "callisto",
            "mimas",
            "enceladus",
            "tethys",
            "dione",
            "rhea",
            "titan",
            "iapetus",
            "miranda",
            "ariel",
            "umbriel",
            "titania",
            "oberon",
            "triton",
            "charon",
        ],
    );
});

Deno.test("validateScenario accepts the solar system", () => {
    const result = validateScenario(JSON.parse(JSON.stringify(solarSystem)));

    assertEquals(result.ok, true);
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

const toDeg = (x: number) => (x * 180) / Math.PI;
const angleBetween = (a: Vec3, b: Vec3) =>
    toDeg(Math.acos(Math.min(1, dot(a, b) / (length(a) * length(b)))));
const normalOf = (el: Elements) => {
    const { p, q } = axes(el);

    return cross(p, q);
};
const moonRow = (id: string) => {
    const row = MOON_ROWS.find((r) => r.id === id);

    assert(row, `no moon row ${id}`);

    return row;
};

Deno.test("every moon's period matches its table period and its a is within 0.5% of the table", () => {
    for (const row of MOON_ROWS) {
        const parent = find(row.parent);
        const moon = find(row.id);
        const p = period(moon.elements, parent.mu + moon.mu) / DAY;

        assertAlmostEquals(p / row.P, 1, 1e-6, row.id);
        assertAlmostEquals(moon.elements.a / (row.a * 1000), 1, 0.005, row.id);
    }
});

Deno.test("every moon's orbit is inclined to its reference pole by the table inclination", () => {
    for (const row of MOON_ROWS) {
        const moon = find(row.id);
        const angle = angleBetween(normalOf(moon.elements), moonPole(row));

        assertAlmostEquals(angle, row.i, 0.01, row.id);
    }
});

Deno.test("Iapetus's Laplace pole is 14.8 degrees from Saturn's pole and Io's is Jupiter's", () => {
    const saturn = bodyOrientation("saturn", 0);
    const jupiter = bodyOrientation("jupiter", 0);

    assert(saturn && jupiter);
    assertAlmostEquals(
        angleBetween(moonPole(moonRow("iapetus")), saturn.z),
        14.8,
        0.2,
    );
    assert(angleBetween(moonPole(moonRow("io")), jupiter.z) < 0.1);
});

Deno.test("the Uranus moons orbit with the planet's retrograde spin", () => {
    const uranus = bodyOrientation("uranus", 0);

    assert(uranus);

    for (const id of ["miranda", "ariel", "umbriel", "titania", "oberon"]) {
        const normal = normalOf(find(id).elements);

        assert(angleBetween(normal, scale(uranus.z, -1)) < 5, id);
    }
});

Deno.test("Triton is retrograde around Neptune", () => {
    const neptune = bodyOrientation("neptune", 0);
    const triton = find("triton");

    assert(neptune);
    assert(angleBetween(normalOf(triton.elements), neptune.z) > 90);
    assert(toDeg(triton.elements.i) > 90);
});

Deno.test("Halley's inclination is 162.19 degrees and it reaches perihelion on 1986-02-09", () => {
    const halley = find("halley");
    const mu = solarSystem.bodies[0].mu + halley.mu;
    const next = nextApsisTime(
        halley.elements,
        mu,
        halley.elements.epoch,
        "periapsis",
    );

    assertAlmostEquals(toDeg(halley.elements.i), 162.19, 0.01);
    assertAlmostEquals(j2000sToUnixMs(next), Date.UTC(1986, 1, 9), DAY * 1000);
});

Deno.test("Ceres orbits the Sun in 4.60 years", () => {
    const ceres = find("ceres");
    const years =
        period(ceres.elements, solarSystem.bodies[0].mu + ceres.mu) /
        (365.25 * DAY);

    assertAlmostEquals(years, 4.6, 0.01);
});

Deno.test("only moons with a period for the node or apsides precess", () => {
    const body = (id: string) => solarSystem.bodies.find((b) => b.id === id);

    assertEquals(body("charon")?.precession, undefined);
    assertEquals(body("io")?.precession?.nodeRate, 0);
    assert((body("io")?.precession?.argpRate ?? 0) !== 0);
    assert((body("triton")?.precession?.nodeRate ?? 0) > 0);
    assert((body("titan")?.precession?.nodeRate ?? 0) < 0);
});
