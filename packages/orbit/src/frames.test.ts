/// <reference types="deno" />
import { assertAlmostEquals } from "@std/assert";
import { OBLIQUITY_J2000 } from "./constants.ts";
import { assertVecClose, MU, mulberry32, randomElements } from "./fixture.ts";
import {
    equatorialToEcliptic,
    rotateEclipticToEquatorial,
    rotateEquatorialToEcliptic,
} from "./frames.ts";
import type { Elements } from "./kepler.ts";
import { stateAt } from "./kepler.ts";
import type { Vec3 } from "./vec.ts";

const inverse = (v: Vec3): Vec3 => {
    const c = Math.cos(OBLIQUITY_J2000);
    const s = Math.sin(OBLIQUITY_J2000);

    return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
};

Deno.test("an equatorial orbit is inclined by the obliquity in the ecliptic frame", () => {
    const el: Elements = {
        a: 1e8,
        e: 0.3,
        i: 0,
        raan: 0,
        argp: 1,
        m0: 2,
        epoch: 0,
    };

    assertAlmostEquals(equatorialToEcliptic(el, MU).i, OBLIQUITY_J2000, 1e-9);
});

Deno.test("rotating the new state back gives the original state", () => {
    const rand = mulberry32(5);

    for (let k = 0; k < 50; k++) {
        const el = randomElements(rand);
        const before = stateAt(el, MU, 0);
        const after = stateAt(equatorialToEcliptic(el, MU), MU, 0);

        assertVecClose(inverse(after.r), before.r);
        assertVecClose(inverse(after.v), before.v);
    }
});

Deno.test("the obliquity is about 23.44 degrees", () => {
    assertAlmostEquals((OBLIQUITY_J2000 * 180) / Math.PI, 23.4393, 1e-4);
    assertAlmostEquals(rotateEquatorialToEcliptic({ x: 1, y: 0, z: 0 }).x, 1);
});

Deno.test("ecliptic to equatorial undoes equatorial to ecliptic", () => {
    const v = { x: 0.3, y: -1.2, z: 2.5 };

    assertVecClose(
        rotateEclipticToEquatorial(rotateEquatorialToEcliptic(v)),
        v,
    );
    assertVecClose(
        rotateEquatorialToEcliptic(rotateEclipticToEquatorial(v)),
        v,
    );
});
