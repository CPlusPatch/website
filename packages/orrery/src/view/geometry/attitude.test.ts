/// <reference types="deno" />
import { cross, dot, length, type Vec3 } from "@cpluspatch/orbit";
import { assertAlmostEquals } from "@std/assert";
import { lvlhMatrix } from "./attitude.ts";

const axes = (m: number[]): [Vec3, Vec3, Vec3] => [
    { x: m[0], y: m[1], z: m[2] },
    { x: m[4], y: m[5], z: m[6] },
    { x: m[8], y: m[9], z: m[10] },
];

const r = { x: 6.8e6, y: 1e6, z: -2e6 };
// Circular: perpendicular to r.
const circular = { x: -1e3, y: 6.8e3, z: 0.5e3 };
const v = {
    x: circular.x - (dot(circular, r) / dot(r, r)) * r.x,
    y: circular.y - (dot(circular, r) / dot(r, r)) * r.y,
    z: circular.z - (dot(circular, r) / dot(r, r)) * r.z,
};
// Eccentric: has a radial part.
const eccentric = {
    x: v.x + 0.4 * r.x * 1e-3,
    y: v.y + 0.4 * r.y * 1e-3,
    z: v.z + 0.4 * r.z * 1e-3,
};

Deno.test("the columns are unit vectors at right angles", () => {
    for (const velocity of [v, eccentric]) {
        const [x, y, z] = axes(lvlhMatrix(r, velocity));

        assertAlmostEquals(length(x), 1, 1e-12);
        assertAlmostEquals(length(y), 1, 1e-12);
        assertAlmostEquals(length(z), 1, 1e-12);
        assertAlmostEquals(dot(x, y), 0, 1e-12);
        assertAlmostEquals(dot(y, z), 0, 1e-12);
        assertAlmostEquals(dot(x, z), 0, 1e-12);
    }
});

Deno.test("the frame is right-handed", () => {
    const [x, y, z] = axes(lvlhMatrix(r, eccentric));
    const c = cross(x, y);

    assertAlmostEquals(c.x, z.x, 1e-12);
    assertAlmostEquals(c.y, z.y, 1e-12);
    assertAlmostEquals(c.z, z.z, 1e-12);
});

Deno.test("+z points away from the parent", () => {
    const [, , z] = axes(lvlhMatrix(r, eccentric));

    assertAlmostEquals(dot(z, r) / length(r), 1, 1e-12);
});

Deno.test("+x runs with the velocity, on an eccentric orbit too", () => {
    for (const velocity of [v, eccentric]) {
        const [x] = axes(lvlhMatrix(r, velocity));

        if (!(dot(x, velocity) > 0))
            throw new Error("x runs against the velocity");
    }
});

Deno.test("+y is the orbit normal", () => {
    const [, y] = axes(lvlhMatrix(r, eccentric));
    const h = cross(r, eccentric);

    assertAlmostEquals(dot(y, h) / length(h), 1, 1e-12);
});
