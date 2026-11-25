/// <reference types="deno" />

import { solarSystem } from "@cpluspatch/catalog";
import {
    cross,
    DAY,
    dot,
    length,
    OBLIQUITY_J2000,
    rotateEquatorialToEcliptic,
    scale,
    stateAt,
    type Vec3,
} from "@cpluspatch/orbit";
import { assertVecClose } from "@cpluspatch/orbit/fixture";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import type { Model } from "./models.ts";
import { MODELS } from "./models.ts";
import type { Orientation } from "./orientation.ts";
import {
    bodyOrientation,
    orientationFromPole,
    rotationPeriod,
    spinAxis,
} from "./orientation.ts";
import { elementsAt } from "./precession.ts";
import { ROTATION_MODELS } from "./rotation-models.ts";
import { isOrbiting } from "./scenario.ts";

const RAD = Math.PI / 180;

const find = (id: string) => {
    const body = solarSystem.bodies.find((b) => b.id === id);

    assert(body && isOrbiting(body), `no orbiting body ${id}`);

    return body;
};

const orientationOf = (model: Model | undefined, t: number): Orientation => {
    const orientation = bodyOrientation(model, t);

    assert(orientation, `no orientation for ${model}`);

    return orientation;
};

const angleBetween = (a: Vec3, b: Vec3): number =>
    Math.acos(dot(a, b) / (length(a) * length(b)));

const inverse = (v: Vec3): Vec3 => {
    const c = Math.cos(OBLIQUITY_J2000);
    const s = Math.sin(OBLIQUITY_J2000);

    return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
};

Deno.test("the axes are unit length, orthogonal and right-handed for every model", () => {
    for (const model of MODELS.filter((m) => ROTATION_MODELS[m])) {
        for (const days of [-9000, 0, 1234.5, 8000]) {
            const { x, y, z } = orientationOf(model, days * DAY);

            assertAlmostEquals(length(x), 1, 1e-12);
            assertAlmostEquals(length(y), 1, 1e-12);
            assertAlmostEquals(length(z), 1, 1e-12);
            assertAlmostEquals(dot(x, y), 0, 1e-12);
            assertAlmostEquals(dot(y, z), 0, 1e-12);
            assertAlmostEquals(dot(z, x), 0, 1e-12);
            assertVecClose(cross(x, y), z, 1e-12);
        }
    }
});

Deno.test("a pole at 90° declination with W = 0 puts the prime meridian at RA + 90°", () => {
    const ra = 0.7;

    const { x, y, z } = orientationFromPole(ra, Math.PI / 2, 0);

    assertVecClose(z, rotateEquatorialToEcliptic({ x: 0, y: 0, z: 1 }), 1e-9);
    assertVecClose(
        x,
        rotateEquatorialToEcliptic({ x: -Math.sin(ra), y: Math.cos(ra), z: 0 }),
        1e-9,
    );
    assertVecClose(
        y,
        rotateEquatorialToEcliptic({
            x: -Math.cos(ra),
            y: -Math.sin(ra),
            z: 0,
        }),
        1e-9,
    );
});

Deno.test("a body's pole is tilted from its orbit normal by its obliquity", () => {
    const expected: Record<string, number> = {
        earth: 23.44,
        mars: 25.19,
        jupiter: 3.13,
        saturn: 26.73,
        neptune: 28.32,
        // The IAU north pole of a retrograde spinner is on the orbit-normal side, so the angle is
        // 180° minus the usual obliquity (97.77° and 177.36°).
        uranus: 82.23,
        venus: 2.64,
    };

    for (const [id, degrees] of Object.entries(expected)) {
        const { i, raan } = find(id).orbit.elements;
        const normal = {
            x: Math.sin(i) * Math.sin(raan),
            y: -Math.sin(i) * Math.cos(raan),
            z: Math.cos(i),
        };

        const angle =
            angleBetween(orientationOf(find(id).model, 0).z, normal) / RAD;

        assertAlmostEquals(angle, degrees, 0.3, `${id} obliquity ${angle}`);
    }
});

Deno.test("a body's sidereal rotation period comes from its rotation model", () => {
    const hours = (model: Model) => (rotationPeriod(model, 0) ?? 0) / 3600;

    assertAlmostEquals(rotationPeriod("earth", 0) ?? 0, 86164.1, 1);
    assertAlmostEquals(hours("moon") / 24, 27.32, 0.01);
    assertAlmostEquals(hours("jupiter"), 9.925, 0.01);
    assertAlmostEquals(hours("venus") / 24, 243.0, 0.1);
    assertEquals(rotationPeriod(undefined, 0), null);
});

Deno.test("the spin axis is tilted from the orbit normal by the usual obliquity", () => {
    const expected: Record<string, number> = {
        earth: 23.44,
        venus: 177.36,
        uranus: 97.77,
    };

    for (const [id, degrees] of Object.entries(expected)) {
        const { i, raan } = find(id).orbit.elements;
        const normal = {
            x: Math.sin(i) * Math.sin(raan),
            y: -Math.sin(i) * Math.cos(raan),
            z: Math.cos(i),
        };
        const axis = spinAxis(find(id).model, 0);
        assert(axis, `no spin axis for ${id}`);

        const angle = angleBetween(axis, normal) / RAD;

        assertAlmostEquals(angle, degrees, 0.3, `${id} obliquity ${angle}`);
    }

    assertEquals(spinAxis(undefined, 0), null);
});

// The Earth rotation angle counts from the CIO, which stays on the ICRF axes, unlike GMST.
Deno.test("the Earth spins with the IERS Earth rotation angle", () => {
    for (const year of [2000, 2004.3, 2009.7, 2017.2, 2023.9, 2030]) {
        const t = (year - 2000) * 365.25 * DAY;

        const x = inverse(orientationOf("earth", t).x);
        const ra = Math.atan2(x.y, x.x) / RAD;
        const era = 360 * (0.779057273264 + 1.0027378119113546 * (t / DAY));
        const difference = ((((ra - era) % 360) + 540) % 360) - 180;

        assertAlmostEquals(
            difference,
            0,
            0.5,
            `year ${year}: RA ${ra}, ERA ${era % 360}`,
        );
    }
});

Deno.test("the Moon keeps one face to the Earth", () => {
    const moon = find("moon");
    const earth = find("earth");

    for (let k = 0; k < 12; k++) {
        const t = k * 2.53 * 365.25 * DAY + 1234.5;

        const { r } = stateAt(
            moon.orbit.elements,
            earth.mass.mu + moon.mass.mu,
            t,
        );
        const { x, y, z } = orientationOf("moon", t);
        const toEarth = scale(r, -1 / length(r));
        const local = {
            x: dot(toEarth, x),
            y: dot(toEarth, y),
            z: dot(toEarth, z),
        };
        const longitude = Math.atan2(local.y, local.x) / RAD;
        const latitude = Math.asin(local.z) / RAD;

        assertAlmostEquals(
            longitude,
            0,
            10,
            `day ${t / DAY}: longitude ${longitude}`,
        );
        assertAlmostEquals(
            latitude,
            0,
            10,
            `day ${t / DAY}: latitude ${latitude}`,
        );
    }
});

const LOCKED_MOONS = [
    "io",
    "europa",
    "ganymede",
    "callisto",
    "mimas",
    "enceladus",
    "tethys",
    "dione",
    "rhea",
    "iapetus",
    "triton",
    "phobos",
    "charon",
];

// Mimas librates by about 44° in longitude, which a Kepler orbit can't follow.
const LONGITUDE_TOLERANCE: Record<string, number> = { mimas: 20 };

Deno.test("a tidally locked moon keeps one face to its parent", () => {
    for (const id of LOCKED_MOONS) {
        const moon = solarSystem.bodies.find((b) => b.id === id);
        const parent = solarSystem.bodies.find(
            (b) => b.id === moon?.orbit?.parent,
        );

        assert(
            moon && parent && isOrbiting(moon),
            `no body or parent for ${id}`,
        );

        for (let k = 0; k < 12; k++) {
            const t = k * 2.53 * 365.25 * DAY + 1234.5;

            const elements = elementsAt(moon, t);

            const { r } = stateAt(elements, parent.mass.mu + moon.mass.mu, t);
            const { x, y, z } = orientationOf(moon.model, t);
            const toParent = scale(r, -1 / length(r));
            const local = {
                x: dot(toParent, x),
                y: dot(toParent, y),
                z: dot(toParent, z),
            };
            const longitude = Math.atan2(local.y, local.x) / RAD;
            const latitude = Math.asin(local.z) / RAD;

            assertAlmostEquals(
                longitude,
                0,
                LONGITUDE_TOLERANCE[id] ?? 10,
                `${id}, day ${t / DAY}: longitude ${longitude}`,
            );
            assertAlmostEquals(
                latitude,
                0,
                10,
                `${id}, day ${t / DAY}: latitude ${latitude}`,
            );
        }
    }
});

Deno.test("Ceres and Vesta have their pck pole at d = 0", () => {
    const poles = {
        ceres: { ra: 291.418, dec: 66.764 },
        vesta: { ra: 309.031, dec: 42.235 },
    };

    for (const [id, { ra, dec }] of Object.entries(poles)) {
        const { z } = orientationOf(find(id).model, 0);
        const expected = rotateEquatorialToEcliptic({
            x: Math.cos(dec * RAD) * Math.cos(ra * RAD),
            y: Math.cos(dec * RAD) * Math.sin(ra * RAD),
            z: Math.sin(dec * RAD),
        });

        assertVecClose(z, expected, 1e-12);
    }
});

Deno.test("a body with no rotation model has no orientation", () => {
    assertEquals(bodyOrientation("iss", 0), null);
    assertEquals(bodyOrientation(undefined, 0), null);
});
