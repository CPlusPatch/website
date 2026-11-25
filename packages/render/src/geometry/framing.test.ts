/// <reference types="deno" />
import { eridani, solarSystem } from "@cpluspatch/catalog";
import { AU } from "@cpluspatch/orbit";
import type { Body } from "@cpluspatch/sim";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
    approachDistance,
    centreShift,
    ease,
    fitDistanceKm,
    focusTween,
    frameDistanceKm,
    keepSizeDistanceKm,
    minDistanceKm,
    openingReachKm,
    pointFrameDistanceKm,
    reachKm,
} from "./framing.ts";

const body = (id: string): Body => {
    const found = solarSystem.bodies.find((b) => b.id === id);
    if (!found) throw new Error(`No body ${id}`);

    return found;
};

Deno.test("the camera stays where a body's sphere spans 80% of the view, and at least 10 m", () => {
    const fov = (50 * Math.PI) / 180;
    const iss: Body = {
        ...body("iss"),
        mass: { ...body("iss").mass, radius: 1 },
    };

    assertAlmostEquals(
        minDistanceKm(body("earth"), fov),
        6371 / Math.sin(0.4 * fov),
        1,
    );
    assertEquals(minDistanceKm(iss, fov), 0.01);
    assertAlmostEquals(minDistanceKm(body("iss"), fov), 0.2, 0.01);
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

const TAN_HALF_FOV = Math.tan((25 * Math.PI) / 180);

Deno.test("a focus move lands on the target, and a move in place zooms by ratio", () => {
    const from = { distance: 100, position: { x: 0, y: 0, z: 0 } };
    const to = { distance: 400, position: { x: 10, y: -20, z: 30 } };

    const start = focusTween(from, to, 0, TAN_HALF_FOV);
    const end = focusTween(from, to, 1, TAN_HALF_FOV);

    assertAlmostEquals(start.distance, 100);
    assertAlmostEquals(end.distance, 400);
    assertEquals(end.position, to.position);

    const inPlace = { ...to, position: from.position };

    assertAlmostEquals(
        focusTween(from, inPlace, 0.5, TAN_HALF_FOV).distance,
        200,
    );
});

Deno.test("a far focus move pulls back until the view is as tall as the move", () => {
    const from = { distance: 1166, position: { x: 0, y: 0, z: 0 } };
    const to = { distance: 2185, position: { x: 1e10, y: 0, z: 0 } };
    let widest = 0;

    for (let s = 0; s <= 1; s += 0.001) {
        const pose = focusTween(from, to, s, TAN_HALF_FOV);
        widest = Math.max(widest, 2 * pose.distance * TAN_HALF_FOV);

        assert(Number.isFinite(pose.distance));
        assert(pose.position.x >= -1e-3 && pose.position.x <= 1e10 + 1e-3);
    }

    assert(widest >= 0.99 * 1e7);
});

Deno.test("a focus move between equal distances is halfway at the middle", () => {
    const pose = { distance: 5, position: { x: 0, y: 0, z: 0 } };
    const to = { distance: 5, position: { x: 8000, y: 0, z: 0 } };

    assertAlmostEquals(
        focusTween(pose, to, 0.5, TAN_HALF_FOV).position.x,
        4000,
    );
});

Deno.test("a key zoom closes the gap by ratio, faster for a longer step", () => {
    assertAlmostEquals(approachDistance(100, 400, Math.LN2 * 0.05, 0.05), 200);
    assertEquals(approachDistance(100, 400, 0, 0.05), 100);
    assertAlmostEquals(approachDistance(100, 400, 10, 0.05), 400);
});

Deno.test("the reach is the farthest planet's aphelion in km, and ignores dwarf planets", () => {
    const neptune = body("neptune");
    const { a = 0, e = 0 } = neptune.orbit?.elements ?? {};

    assertAlmostEquals(reachKm(solarSystem), (a * (1 + e)) / 1000, 1);
});

Deno.test("moving a planet out to 100 AU moves the reach out with it", () => {
    const far = {
        ...solarSystem,
        bodies: solarSystem.bodies.map((b) =>
            b.id === "earth" && b.orbit
                ? {
                      ...b,
                      orbit: {
                          ...b.orbit,
                          elements: { ...b.orbit.elements, a: 100 * AU, e: 0 },
                      },
                  }
                : b,
        ),
    };

    assertAlmostEquals(reachKm(far), (100 * AU) / 1000, 1);
});

Deno.test("a companion star around the root counts toward the reach", () => {
    const b = eridani.bodies.find((body) => body.id === "40-eridani-b");

    assertAlmostEquals(reachKm(eridani), (b?.orbit?.elements.a ?? 0) / 1000, 1);
});

Deno.test("the view shifts by the gap between its centre and the free band's, and not at all when the band is centred", () => {
    assertEquals(centreShift(740, { top: 48, bottom: 100 }), 296);
    assertEquals(centreShift(800, { top: 60, bottom: 740 }), 0);
    assertEquals(centreShift(800, { top: 0, bottom: 700 }), 50);
});

Deno.test("the opening view frames Mars's apoapsis, the 4th planet out", () => {
    const mars = body("mars");
    const { a = 0, e = 0 } = mars.orbit?.elements ?? {};

    assertAlmostEquals(openingReachKm(solarSystem), (a * (1 + e)) / 1000, 1);
});

Deno.test("the opening view falls back to the farthest planet, then to the reach", () => {
    const planets = solarSystem.bodies.filter((b) => b.tags.includes("planet"));
    const keep = new Set(["sun", "mercury", "venus"]);
    const few = {
        ...solarSystem,
        bodies: solarSystem.bodies.filter(
            (b) => !b.tags.includes("planet") || keep.has(b.id),
        ),
    };
    const venus = body("venus");
    const { a = 0, e = 0 } = venus.orbit?.elements ?? {};

    assertEquals(planets.length > 3, true);
    assertAlmostEquals(openingReachKm(few), (a * (1 + e)) / 1000, 1);

    const none = {
        ...solarSystem,
        bodies: solarSystem.bodies.filter((b) => !b.tags.includes("planet")),
    };

    assertAlmostEquals(openingReachKm(none), reachKm(none), 1);
});

Deno.test("a body with moons is framed so its farthest moon's orbit fits the narrower side", () => {
    const fov = (50 * Math.PI) / 180;
    const callisto = body("callisto");
    const { a = 0, e = 0 } = callisto.orbit?.elements ?? {};
    const reach = (a * (1 + e)) / 1000;

    assertAlmostEquals(
        frameDistanceKm(solarSystem, "jupiter", fov, 2),
        (reach * 1.1) / Math.tan(fov / 2),
        1,
    );
    assertAlmostEquals(
        frameDistanceKm(solarSystem, "jupiter", fov, 0.5),
        (reach * 1.1) / (Math.tan(fov / 2) * 0.5),
        1,
    );
});

Deno.test("a body with only spacecraft is framed by their farthest orbit", () => {
    const fov = (50 * Math.PI) / 180;
    const reach = Math.max(
        ...solarSystem.bodies
            .filter((candidate) => candidate.orbit?.parent === "moon")
            .map(
                ({ orbit }) =>
                    ((orbit?.elements.a ?? 0) *
                        (1 + (orbit?.elements.e ?? 0))) /
                    1000,
            ),
    );

    assertAlmostEquals(
        frameDistanceKm(solarSystem, "moon", fov, 2),
        (reach * 1.1) / Math.tan(fov / 2),
        1e-6,
    );
});

Deno.test("a body with no moons is framed so its sphere spans 25% of the view's height", () => {
    const fov = (50 * Math.PI) / 180;
    const mercury = body("mercury");

    assertAlmostEquals(
        frameDistanceKm(solarSystem, "mercury", fov, 1.5),
        mercury.mass.radius / 1000 / Math.sin(0.125 * fov),
        1e-6,
    );
});

Deno.test("a focus that keeps its size scales the distance by the radii's ratio", () => {
    assertAlmostEquals(
        keepSizeDistanceKm(1000, 6371, 1737),
        (1000 * 1737) / 6371,
    );
});

Deno.test("a point's sphere is framed with a 10% margin along the narrower field of view", () => {
    const fov = (50 * Math.PI) / 180;

    assertAlmostEquals(
        pointFrameDistanceKm(1000, fov, 2),
        1100 / Math.tan(fov / 2),
        1e-6,
    );
    assertAlmostEquals(
        pointFrameDistanceKm(1000, fov, 0.5),
        1100 / (Math.tan(fov / 2) * 0.5),
        1e-6,
    );
});
