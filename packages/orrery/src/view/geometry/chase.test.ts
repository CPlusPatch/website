/// <reference types="deno" />
import { length, type Vec3 } from "@cpluspatch/orbit";
import { assertAlmostEquals, assertEquals, assertExists } from "@std/assert";
import {
    BEHIND_ELEVATION_RAD,
    behindDirection,
    chaseFrame,
    chaseView,
} from "./chase.ts";

const FOV = (50 * Math.PI) / 180;
const deg = (d: number): number => (d * Math.PI) / 180;

/** Where the craft and the parent's centre land on screen, as -1 to 1 up the half-frame. */
const screen = (
    parentAngularRadiusRad: number,
): { craft: number; parent: number } => {
    const view = chaseView(parentAngularRadiusRad, FOV);
    const camera = behindDirection(view.elevationRad);
    const target = { x: 0, y: 0, z: -view.nadirOffset };
    const axis = { x: target.x - camera.x, y: 0, z: target.z - camera.z };
    const up = (d: Vec3): number => {
        const k = Math.atan2(d.z, d.x) - Math.atan2(axis.z, axis.x);

        return Math.tan(k) / Math.tan(FOV / 2);
    };

    return {
        craft: up({ x: -camera.x, y: 0, z: -camera.z }),
        parent: up({ x: 0, y: 0, z: -1 }),
    };
};

const column = (m: number[], at: number): Vec3 => {
    const [x, y, z] = m.slice(at, at + 3);

    assertExists(x);
    assertExists(y);
    assertExists(z);

    return { x, y, z };
};

const axes = (m: number[]): [Vec3, Vec3, Vec3] => [
    column(m, 0),
    column(m, 4),
    column(m, 8),
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

Deno.test("a large parent keeps the 15 degree view that looks straight at the craft", () => {
    const view = chaseView(deg(67), FOV);

    assertEquals(view.elevationRad, BEHIND_ELEVATION_RAD);
    assertEquals(view.pitchRad, 0);
    assertEquals(view.nadirOffset, 0);
});

Deno.test("a 0.5 degree parent lands its centre in the lower third with the craft at or above centre", () => {
    const { craft, parent } = screen(deg(0.5));

    assertAlmostEquals(parent, -2 / 3, 1e-9);
    assertEquals(craft >= 0 && craft <= 1, true);
});

Deno.test("the view is the same for a tiny parent at any size below a degree", () => {
    const a = chaseView(deg(0.4), FOV);
    const b = chaseView(deg(0.9), FOV);

    assertAlmostEquals(a.elevationRad, b.elevationRad, 1e-12);
    assertAlmostEquals(a.nadirOffset, b.nadirOffset, 1e-12);
});

Deno.test("the view changes in small steps as the parent's angular radius grows", () => {
    let last = chaseView(0, FOV);

    for (let degrees = 0.1; degrees <= 80; degrees += 0.1) {
        const view = chaseView(deg(degrees), FOV);

        assertEquals(
            Math.abs(view.elevationRad - last.elevationRad) < deg(1),
            true,
        );
        assertEquals(
            Math.abs(view.nadirOffset - last.nadirOffset) < 0.02,
            true,
        );

        last = view;
    }
});
