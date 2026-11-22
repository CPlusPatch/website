/// <reference types="deno" />
import { bodyOrientation, type Vec3 } from "@cpluspatch/orbit";
import { assert, assertAlmostEquals } from "@std/assert";
import { spinMatrix } from "./spin.ts";

const T = 7.5e8;

const orientation = () => {
    const o = bodyOrientation("earth", T);
    assert(o);

    return o;
};

// Applies a column-major matrix to a vector.
const apply = (m: number[], v: Vec3): Vec3 => ({
    x: m[0] * v.x + m[4] * v.y + m[8] * v.z,
    y: m[1] * v.x + m[5] * v.y + m[9] * v.z,
    z: m[2] * v.x + m[6] * v.y + m[10] * v.z,
});

const assertVec = (actual: Vec3, expected: Vec3) => {
    assertAlmostEquals(actual.x, expected.x, 1e-12);
    assertAlmostEquals(actual.y, expected.y, 1e-12);
    assertAlmostEquals(actual.z, expected.z, 1e-12);
};

Deno.test("the geometry's +x, +y and -z land on the body's prime meridian, pole and 90 degrees east", () => {
    const o = orientation();
    const m = spinMatrix(o);

    assertVec(apply(m, { x: 1, y: 0, z: 0 }), o.x);
    assertVec(apply(m, { x: 0, y: 1, z: 0 }), o.z);
    assertVec(apply(m, { x: 0, y: 0, z: -1 }), o.y);
});

Deno.test("the spin is a proper rotation", () => {
    const m = spinMatrix(orientation());
    const columns = [0, 4, 8].map((i) => ({
        x: m[i],
        y: m[i + 1],
        z: m[i + 2],
    }));
    const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

    for (const [i, a] of columns.entries()) {
        for (const [j, b] of columns.entries()) {
            assertAlmostEquals(dot(a, b), i === j ? 1 : 0, 1e-12);
        }
    }

    const [a, b, c] = columns;
    const determinant =
        a.x * (b.y * c.z - b.z * c.y) -
        b.x * (a.y * c.z - a.z * c.y) +
        c.x * (a.y * b.z - a.z * b.y);
    assertAlmostEquals(determinant, 1, 1e-12);
});

Deno.test("east on the map is east on the body", () => {
    const o = orientation();
    const m = spinMatrix(o);
    // The vertex SphereGeometry puts at u = 0.75, v = 0.5.
    const phi = 0.75 * 2 * Math.PI;
    const theta = 0.5 * Math.PI;
    const vertex = {
        x: -Math.cos(phi) * Math.sin(theta),
        y: Math.cos(theta),
        z: Math.sin(phi) * Math.sin(theta),
    };

    assertVec(apply(m, vertex), o.y);
});
