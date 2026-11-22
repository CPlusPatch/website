/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { DAY, OBLIQUITY_J2000 } from "./constants.ts";
import { ROTATION_MODELS } from "./data/rotation.ts";
import { solarSystem } from "./data/solar-system.ts";
import { assertVecClose } from "./fixture.ts";
import { rotateEquatorialToEcliptic } from "./frames.ts";
import { stateAt } from "./kepler.ts";
import type { Orientation } from "./orientation.ts";
import { bodyOrientation, orientationFromPole } from "./orientation.ts";
import type { Vec3 } from "./vec.ts";
import { cross, dot, length, scale } from "./vec.ts";

const RAD = Math.PI / 180;

const find = (id: string) => {
    const body = solarSystem.bodies.find((b) => b.id === id);

    assert(body?.elements, `no orbiting body ${id}`);

    return { ...body, elements: body.elements };
};

const orientationOf = (id: string, t: number): Orientation => {
    const orientation = bodyOrientation(id, t);

    assert(orientation, `no orientation for ${id}`);

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
    for (const id of Object.keys(ROTATION_MODELS)) {
        for (const days of [-9000, 0, 1234.5, 8000]) {
            const { x, y, z } = orientationOf(id, days * DAY);

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
        const { i, raan } = find(id).elements;
        const normal = {
            x: Math.sin(i) * Math.sin(raan),
            y: -Math.sin(i) * Math.cos(raan),
            z: Math.cos(i),
        };

        const angle = angleBetween(orientationOf(id, 0).z, normal) / RAD;

        assertAlmostEquals(angle, degrees, 0.3, `${id} obliquity ${angle}`);
    }
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

        const { r } = stateAt(moon.elements, earth.mu + moon.mu, t);
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

Deno.test("a body with no rotation model has no orientation", () => {
    assertEquals(bodyOrientation("iss", 0), null);
    assertEquals(bodyOrientation("toString", 0), null);
});
