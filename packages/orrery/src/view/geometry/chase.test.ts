/// <reference types="deno" />
import { length, type Vec3 } from "@cpluspatch/orbit";
import { assertAlmostEquals, assertEquals } from "@std/assert";
import { behindDirection, chaseFrame } from "./chase.ts";

const axes = (m: number[]): [Vec3, Vec3, Vec3] => [
    { x: m[0], y: m[1], z: m[2] },
    { x: m[4], y: m[5], z: m[6] },
    { x: m[8], y: m[9], z: m[10] },
];

Deno.test("a circular equatorial orbit has its track along y, its normal up and zenith outward", () => {
    const m = chaseFrame({ x: 7e6, y: 0, z: 0 }, { x: 0, y: 7.5e3, z: 0 });
    if (m === null) throw new Error("There should be a frame.");

    const [x, y, z] = axes(m);

    assertAlmostEquals(x.x, 0, 1e-12);
    assertAlmostEquals(x.y, 1, 1e-12);
    assertAlmostEquals(y.z, 1, 1e-12);
    assertAlmostEquals(z.x, 1, 1e-12);
});

Deno.test("no distance, no speed or a plunge straight down leaves the frame undefined", () => {
    const r = { x: 7e6, y: 0, z: 0 };
    const v = { x: 0, y: 7.5e3, z: 0 };
    const zero = { x: 0, y: 0, z: 0 };

    assertEquals(chaseFrame(zero, v), null);
    assertEquals(chaseFrame(r, zero), null);
    assertEquals(chaseFrame(r, { x: -3e3, y: 0, z: 0 }), null);
});

Deno.test("the behind direction is a unit vector behind the body and above its track", () => {
    const d = behindDirection();

    assertAlmostEquals(length(d), 1, 1e-12);
    assertEquals(d.x < 0, true);
    assertEquals(d.z > 0, true);
    assertEquals(d.y, 0);
});
