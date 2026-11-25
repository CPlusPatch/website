/// <reference types="deno" />

import {
    AU,
    axes,
    cross,
    DAY,
    dot,
    type Elements,
    j2000sToUnixMs,
    length,
    nextApsisTime,
    OBLIQUITY_J2000,
    period,
    scale,
    stateAt,
    unixMsToJ2000s,
    type Vec3,
    wrapAngle,
} from "@cpluspatch/orbit";
import { assertVecClose } from "@cpluspatch/orbit/fixture";
import {
    bodyOrientation,
    elementsAt,
    sortByDepth,
    validateScenario,
    worldStates,
} from "@cpluspatch/sim";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { MOON_ROWS, moonPole } from "./moons.ts";
import { solarSystem } from "./solar-system.ts";

const find = (id: string) => {
    const body = solarSystem.bodies.find((b) => b.id === id);

    assert(body?.elements, `no orbiting body ${id}`);

    return { ...body, elements: body.elements };
};

const sun = solarSystem.bodies.find((b) => b.id === "sun");

assert(sun, "no sun");

const SUN_MU = sun.mu;

Deno.test("there are 55 bodies with the expected ids", () => {
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
            "hubble",
            "tiangong",
            "landsat-9",
            "gps-biii-1",
            "goes-19",
            "meridian-10",
            "parisat",
            "mro",
            "mars-express",
            "mars-odyssey",
            "tgo",
            "hope",
            "lro",
            "chandrayaan-2",
            "danuri",
            "juno",
            "parker-solar-probe",
            "solar-orbiter",
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

Deno.test("the ISS orbits in about 93 minutes from an epoch on 2026-11-23", () => {
    const earth = find("earth");
    const iss = find("iss");
    const minutes = period(iss.elements, earth.mu + iss.mu) / 60;

    assert(minutes > 92 && minutes < 94, `period is ${minutes} minutes`);
    assertEquals(
        new Date(j2000sToUnixMs(iss.elements.epoch)).toISOString().slice(0, 10),
        "2026-11-23",
    );
});

Deno.test("the ISS inclination is converted to the ecliptic and recovers 51.632 degrees", () => {
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

    assert(Math.abs(toDeg(iss.elements.i) - 51.632) > 1);
    assertAlmostEquals(toDeg(Math.acos(h.z / length(h))), 51.632, 1e-6);
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
    const mu = SUN_MU + earth.mu;

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

        // A mean-longitude period also holds the apsidal and nodal turns, which are up to 0.5%.
        assertAlmostEquals(
            p / row.P,
            1,
            row.meanLongitude ? 0.01 : 1e-6,
            row.id,
        );
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
    const mu = SUN_MU + halley.mu;
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
    const years = period(ceres.elements, SUN_MU + ceres.mu) / (365.25 * DAY);

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

Deno.test("every Earth spacecraft precesses about Earth's pole", () => {
    const spacecraft = solarSystem.bodies.filter(
        (b) => b.kind === "spacecraft" && b.parent === "earth",
    );

    assertEquals(spacecraft.length, 8);

    for (const body of spacecraft) {
        assert(body.precession, `${body.id} has no precession`);
        assert(body.precession.nodeRate !== 0, `${body.id} has no node rate`);
        assertAlmostEquals(
            body.precession.pole.z,
            Math.cos(OBLIQUITY_J2000),
            1e-12,
        );
    }
});

Deno.test("GPS orbits in 718 minutes and GOES-19 in 1436", () => {
    const earth = find("earth");
    const minutes = (id: string) => {
        const body = find(id);

        return period(body.elements, earth.mu + body.mu) / 60;
    };

    assertAlmostEquals(minutes("gps-biii-1"), 718, 2);
    assertAlmostEquals(minutes("goes-19"), 1436, 2);
});

// Unit vectors from the parent to the moon in ecliptic J2000, from JPL Horizons (geometric
// vectors, TDB, REF_PLANE=ECLIPTIC, REF_SYSTEM=ICRF) at 2015-01-01 00:00 TDB.
const HORIZONS_2015: Record<string, { toMoon: Vec3; degrees: number }> = {
    io: { toMoon: { x: 0.03687, y: -0.9987, z: -0.0352 }, degrees: 2 },
    dione: { toMoon: { x: -0.92357, y: -0.29585, z: 0.24391 }, degrees: 2 },
    rhea: { toMoon: { x: 0.08835, y: 0.88151, z: -0.46382 }, degrees: 2 },
    // Triton's mean orbit is about 5° off Horizons.
    triton: { toMoon: { x: 0.53281, y: 0.78439, z: 0.31754 }, degrees: 6 },
    charon: { toMoon: { x: 0.68862, y: 0.354, z: -0.63285 }, degrees: 2 },
};

Deno.test("moons point where Horizons puts them in 2015", () => {
    const t = (2457023.5 - 2451545) * DAY;

    for (const [id, { toMoon, degrees }] of Object.entries(HORIZONS_2015)) {
        const moon = find(id);
        const parent = find(moon.parent ?? "");
        const elements = elementsAt(moon, t);

        assert(elements, `no elements for ${id}`);

        const { r } = stateAt(elements, parent.mu + moon.mu, t);

        assert(
            angleBetween(r, toMoon) < degrees,
            `${id}: ${angleBetween(r, toMoon)}°`,
        );
    }
});

// Geometric vectors from the parent in ecliptic J2000, in km, from JPL Horizons at
// 2026-11-24 00:00 TDB, one day after the probes' epoch.
const HORIZONS_PROBES: Record<
    "mro" | "lro" | "juno" | "parker-solar-probe",
    Vec3
> = {
    mro: { x: 1050.583882246016, y: -1037.355041138028, z: -3327.607949548157 },
    lro: { x: -1279.8151416294, y: -541.8156285521441, z: -1173.089278908651 },
    juno: { x: 1171872.25891045, y: -341475.4301779601, z: -5174248.407601531 },
    "parker-solar-probe": {
        x: 51553564.4977901,
        y: -2857702.930706531,
        z: -3009760.254410001,
    },
};

Deno.test("Juno and Parker Solar Probe point where Horizons puts them a day after the epoch", () => {
    for (const id of ["juno", "parker-solar-probe"] as const) {
        const probe = find(id);
        const parent = solarSystem.bodies.find((b) => b.id === probe.parent);
        const t = probe.elements.epoch + DAY;

        assert(parent, `no parent for ${id}`);
        const elements = elementsAt(probe, t);

        assert(elements, `no elements for ${id}`);

        const { r } = stateAt(elements, parent.mu + probe.mu, t);

        assert(
            angleBetween(r, HORIZONS_PROBES[id]) < 1,
            `${id}: ${angleBetween(r, HORIZONS_PROBES[id])}°`,
        );
    }
});

Deno.test("MRO and LRO are in their orbit planes a day after the epoch", () => {
    for (const id of ["mro", "lro"] as const) {
        const probe = find(id);
        const elements = elementsAt(probe, probe.elements.epoch + DAY);

        assert(elements, `no elements for ${id}`);

        // The angle to the plane is 90° minus the angle to its normal.
        const offPlane = Math.abs(
            90 - angleBetween(HORIZONS_PROBES[id], normalOf(elements)),
        );

        assert(offPlane < 1, `${id}: ${offPlane}°`);
    }
});

Deno.test("every Mars, Moon and Jupiter probe precesses about its parent's pole", () => {
    const probes = solarSystem.bodies.filter(
        (b) =>
            b.kind === "spacecraft" &&
            (b.parent === "mars" ||
                b.parent === "moon" ||
                b.parent === "jupiter"),
    );

    assertEquals(probes.length, 9);

    for (const body of probes) {
        const pole = bodyOrientation(
            find(body.parent ?? "").model,
            body.elements?.epoch ?? 0,
        );

        assert(pole, `no rotation model for ${body.parent}`);
        assert(body.precession, `${body.id} has no precession`);
        assertVecClose(body.precession.pole, pole.z, 1e-12);
    }
});

Deno.test("MRO's node precesses about +0.5 degrees a day, sun-synchronous with Mars", () => {
    const rate = find("mro").precession?.nodeRate;

    assert(rate !== undefined, "MRO has no precession");
    assertAlmostEquals(toDeg(rate) * DAY, 0.5, 0.1);
});
