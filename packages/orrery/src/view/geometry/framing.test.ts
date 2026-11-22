/// <reference types="deno" />
import { AU, type Body, solarSystem } from "@cpluspatch/orbit";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
    centreShift,
    ease,
    fitDistanceKm,
    focusDistanceKm,
    focusTween,
    minDistanceKm,
    reachKm,
} from "./framing.ts";

const body = (id: string): Body => {
    const found = solarSystem.bodies.find((b) => b.id === id);
    if (!found) throw new Error(`No body ${id}`);

    return found;
};

Deno.test("a body is focused at six radii, or a twentieth of its orbit if that is farther", () => {
    const earth = body("earth");
    const big: Body = { ...earth, radius: 1e10 };

    assertAlmostEquals(focusDistanceKm(big), 6e7);
    assertAlmostEquals(
        focusDistanceKm(earth),
        (0.05 * (earth.elements?.a ?? 0)) / 1000,
    );
});

Deno.test("a body with no orbit is focused no closer than a twentieth of 50 AU", () => {
    const root: Body = { ...body("sun"), radius: 1, elements: null };

    assertAlmostEquals(focusDistanceKm(root), (0.05 * 50 * AU) / 1000);
});

Deno.test("the camera stays where a body's sphere spans 80% of the view, and at least 10 m", () => {
    const fov = (50 * Math.PI) / 180;
    const iss: Body = { ...body("iss"), radius: 1 };

    assertAlmostEquals(
        minDistanceKm(body("earth"), fov),
        6371 / Math.sin(0.4 * fov),
        1,
    );
    assertEquals(minDistanceKm(iss, fov), 0.01);
    assertAlmostEquals(minDistanceKm(body("iss"), fov), 0.15, 0.01);
});

/** The NDC coordinates of a point on a circle of `radius` in the ecliptic, as the fit sees it. */
const project = (
    radius: number,
    angle: number,
    distance: number,
    fov: number,
    aspect: number,
    elevation: number,
): { x: number; y: number } => {
    const px = radius * Math.cos(angle);
    const py = radius * Math.sin(angle);
    const depth = distance + py * Math.cos(elevation);
    const tan = Math.tan(fov / 2);

    return {
        x: px / (depth * tan * aspect),
        y: (py * Math.sin(elevation)) / (depth * tan),
    };
};

Deno.test("an orbit at the fit distance lands inside the viewport at any aspect", () => {
    const fov = (50 * Math.PI) / 180;
    const elevation = Math.PI / 6;

    for (const aspect of [0.4, 1, 1.8]) {
        const distance = fitDistanceKm(100, fov, aspect, elevation);
        let largest = 0;

        for (let k = 0; k < 360; k++) {
            const { x, y } = project(
                100,
                (k * Math.PI) / 180,
                distance,
                fov,
                aspect,
                elevation,
            );
            largest = Math.max(largest, Math.abs(x), Math.abs(y));
        }

        assertEquals(largest <= 1, true);
        assertAlmostEquals(largest, 1 / 1.1, 0.01);
    }
});

Deno.test("the near, far and side points of an orbit are inside the viewport", () => {
    const fov = (50 * Math.PI) / 180;
    const elevation = Math.PI / 6;

    for (const aspect of [0.4, 1, 1.8]) {
        const distance = fitDistanceKm(100, fov, aspect, elevation);

        for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
            const { x, y } = project(
                100,
                angle,
                distance,
                fov,
                aspect,
                elevation,
            );

            assertEquals(Math.abs(x) < 1 && Math.abs(y) < 1, true);
        }
    }
});

Deno.test("a tall viewport needs the camera farther away than a wide one", () => {
    const fov = Math.PI / 3;
    const wide = fitDistanceKm(100, fov, 1.8, Math.PI / 6);
    const tall = fitDistanceKm(100, fov, 0.4, Math.PI / 6);

    assertEquals(tall > wide, true);
});

Deno.test("easing starts and ends at rest and clamps outside 0 to 1", () => {
    assertEquals(ease(0), 0);
    assertEquals(ease(1), 1);
    assertEquals(ease(-1), 0);
    assertEquals(ease(2), 1);
    assertAlmostEquals(ease(0.5), 0.5);
});

Deno.test("a focus move lands on the target, halfway by ratio at the middle, moved as far as the distance", () => {
    const from = { distance: 100, position: { x: 0, y: 0, z: 0 } };
    const to = { distance: 400, position: { x: 10, y: -20, z: 30 } };

    const start = focusTween(from, to, 0);
    const end = focusTween(from, to, 1);

    assertAlmostEquals(start.distance, 100);
    assertAlmostEquals(end.distance, 400);
    assertEquals(end.position, to.position);

    const middle = focusTween(from, to, 0.5);

    assertAlmostEquals(middle.distance, 200);
    assertAlmostEquals(middle.position.x, 10 / 3);
    assertAlmostEquals(middle.position.y, -20 / 3);
    assertAlmostEquals(middle.position.z, 10);
});

Deno.test("zooming in on a focus never pushes the target further across the screen", () => {
    const from = { distance: 1000, position: { x: 0, y: 0, z: 0 } };
    const to = { distance: 1, position: { x: 500, y: 0, z: 0 } };

    for (let s = 0; s <= 1; s += 0.05) {
        const pose = focusTween(from, to, s);
        const offScreen = (to.position.x - pose.position.x) / pose.distance;

        assert(offScreen <= 0.5 + 1e-9);
    }
});

Deno.test("a focus move between equal distances moves by the eased progress", () => {
    const pose = { distance: 5, position: { x: 0, y: 0, z: 0 } };
    const to = { distance: 5, position: { x: 8, y: 0, z: 0 } };

    assertAlmostEquals(focusTween(pose, to, 0.5).position.x, 4);
});

Deno.test("the reach is the farthest planet's aphelion in km, and ignores dwarf planets", () => {
    const neptune = body("neptune");
    const { a = 0, e = 0 } = neptune.elements ?? {};

    assertAlmostEquals(reachKm(solarSystem), (a * (1 + e)) / 1000, 1);
});

Deno.test("moving a planet out to 100 AU moves the reach out with it", () => {
    const far = {
        ...solarSystem,
        bodies: solarSystem.bodies.map((b) =>
            b.id === "earth" && b.elements
                ? { ...b, elements: { ...b.elements, a: 100 * AU, e: 0 } }
                : b,
        ),
    };

    assertAlmostEquals(reachKm(far), (100 * AU) / 1000, 1);
});

Deno.test("the view shifts by the gap between its centre and the free band's, and not at all when the band is centred", () => {
    assertEquals(centreShift(740, { top: 48, bottom: 100 }), 296);
    assertEquals(centreShift(800, { top: 60, bottom: 740 }), 0);
    assertEquals(centreShift(800, { top: 0, bottom: 700 }), 50);
});
