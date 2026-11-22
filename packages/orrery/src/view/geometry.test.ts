/// <reference types="deno" />
import { AU, type Body, solarSystem } from "@cpluspatch/orbit";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
    centreShift,
    ease,
    fitDistanceKm,
    focusDistanceKm,
    focusTween,
    hiddenBehindSpheres,
    hiddenMarkers,
    minDistanceKm,
    nearestPoint,
    ORBIT_MAX_VIEWPORTS,
    ORBIT_MIN_PX,
    orbitShown,
    placeLabels,
    projectedRadiusPx,
    reachKm,
    trailAlpha,
    trailBack,
} from "./geometry.ts";

const body = (id: string): Body => {
    const found = solarSystem.bodies.find((b) => b.id === id);
    if (!found) throw new Error(`No body ${id}`);

    return found;
};

Deno.test("a sphere that fills the field of view is half the viewport tall", () => {
    const fov = Math.PI / 2;

    assertAlmostEquals(projectedRadiusPx(1, 1, fov, 800), 400);
});

Deno.test("a sphere twice as far away looks half as big", () => {
    const near = projectedRadiusPx(10, 100, 0.8, 600);
    const far = projectedRadiusPx(10, 200, 0.8, 600);

    assertAlmostEquals(far, near / 2);
});

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

const view = { width: 800, height: 600 };

const box = (id: string, x: number, y: number, radius: number) => ({
    id,
    x,
    y,
    width: 50,
    height: 14,
    offset: 6,
    disc: false,
    radius,
});

Deno.test("a label sits right of its body when nothing is in the way", () => {
    const placements = placeLabels([box("a", 100, 100, 10)], view, "x");

    assertEquals(placements.get("a"), "right");
});

Deno.test("a label touching a larger body's label goes left, or hides if that's taken too", () => {
    const labels = [box("big", 230, 100, 10), box("moon", 200, 105, 1)];
    const crowded = [...labels, box("probe", 200, 105, 0.5)];

    assertEquals(placeLabels(labels, view, "x").get("moon"), "left");
    assertEquals(placeLabels(crowded, view, "x").get("probe"), "hidden");
});

Deno.test("a label whose right side passes the viewport goes left", () => {
    const placements = placeLabels([box("neptune", 780, 100, 1)], view, "x");

    assertEquals(placements.get("neptune"), "left");
});

Deno.test("a label that fits neither side of the viewport is hidden", () => {
    const wide = { ...box("a", 30, 100, 1), width: 60 };
    const placements = placeLabels([wide], { width: 80, height: 600 }, "x");

    assertEquals(placements.get("a"), "hidden");
});

Deno.test("the focus's label hides any label it touches, whatever the radius", () => {
    const labels = [box("sun", 100, 100, 1e9), box("iss", 108, 101, 0.05)];

    assertEquals(placeLabels(labels, view, "iss").get("iss"), "right");
    assertEquals(placeLabels(labels, view, "iss").get("sun"), "left");
    assertEquals(placeLabels(labels, view, "sun").get("iss"), "left");
});

Deno.test("a label whose anchor is on a larger body's anchor is hidden, unless it's the focus", () => {
    const labels = [
        box("earth", 300, 300, 6.4e6),
        box("moon", 303, 302, 1.7e6),
    ];

    assertEquals(placeLabels(labels, view, "x").get("earth"), "right");
    assertEquals(placeLabels(labels, view, "x").get("moon"), "hidden");
    assertEquals(placeLabels(labels, view, "moon").get("moon"), "right");
    assertEquals(placeLabels(labels, view, "moon").get("earth"), "hidden");
});

Deno.test("a label avoids another body's marker, unless it's the focus", () => {
    const labels = [box("earth", 300, 300, 6.4e6)];
    const dots = [
        { id: "earth", x: 300, y: 300, size: 3 },
        { id: "sun", x: 330, y: 302, size: 6 },
    ];

    assertEquals(placeLabels(labels, view, "x", dots).get("earth"), "left");
    assertEquals(
        placeLabels(labels, view, "x", [
            ...dots,
            { id: "venus", x: 270, y: 300, size: 3 },
        ]).get("earth"),
        "hidden",
    );
    assertEquals(placeLabels(labels, view, "earth", dots).get("earth"), "left");
});

Deno.test("the focus's label stays right even when it can't fit anywhere", () => {
    const wide = { ...box("a", 30, 100, 1), width: 60 };
    const placements = placeLabels([wide], { width: 80, height: 600 }, "a");

    assertEquals(placements.get("a"), "right");
});

Deno.test("a label avoids a blocked rect, like a panel, on the side it overlaps", () => {
    const labels = [box("a", 100, 100, 1)];
    // Covers the right side (x 106 to 156) but not the left (x 44 to 94).
    const right = { left: 120, top: 90, right: 300, bottom: 110 };
    const left = { left: 0, top: 90, right: 90, bottom: 110 };

    assertEquals(
        placeLabels(labels, view, "x", [], [], new Map(), [right]).get("a"),
        "left",
    );
    assertEquals(
        placeLabels(labels, view, "x", [], [], new Map(), [left]).get("a"),
        "right",
    );
});

Deno.test("a label with both sides blocked hides, unless it's the focus or pinned", () => {
    const labels = [box("a", 100, 100, 1)];
    const covered = { left: 0, top: 0, right: 400, bottom: 400 };
    const place = (focus: string, pinned: string[]) =>
        placeLabels(labels, view, focus, [], pinned, new Map(), [covered]).get(
            "a",
        );

    assertEquals(place("x", []), "hidden");
    assertEquals(place("a", []), "right");
    assertEquals(place("x", ["a"]), "right");
});

Deno.test("a blocked rect that only touches a label's box doesn't block it", () => {
    // The label's right box spans x 106 to 156.
    const touching = { left: 156, top: 0, right: 400, bottom: 400 };
    const placements = placeLabels(
        [box("a", 100, 100, 1)],
        view,
        "x",
        [],
        [],
        new Map(),
        [touching],
    );

    assertEquals(placements.get("a"), "right");
});

Deno.test("labels on different lines or of equal size don't move each other", () => {
    const lines = [box("a", 100, 100, 10), box("b", 100, 120, 1)];
    const equal = [box("a", 0, 0, 5), box("b", 7, 1, 5)];

    assertEquals(placeLabels(lines, view, "x").get("b"), "right");
    assertEquals(placeLabels(equal, view, "x").get("b"), "right");
});

Deno.test("a label's box counts 4 px of space around it", () => {
    const near = [box("a", 100, 100, 10), box("b", 153, 100, 1)];
    const far = [box("a", 100, 100, 10), box("b", 154, 100, 1)];

    assertEquals(placeLabels(near, view, "x").get("b"), "hidden");
    assertEquals(placeLabels(far, view, "x").get("b"), "right");
});

Deno.test("a label is hidden when its anchor is more than its width off screen", () => {
    const labels = [box("near", -49, 100, 1), box("far", -51, 100, 1)];
    const placements = placeLabels(labels, view, "x");

    assertEquals(placements.get("near"), "right");
    assertEquals(placements.get("far"), "hidden");
});

Deno.test("a sphere's label is hidden when its disc is bigger than half the viewport", () => {
    const disc = { ...box("earth", 400, 300, 1), offset: 700, disc: true };

    assertEquals(placeLabels([disc], view, "x").get("earth"), "hidden");
    assertEquals(placeLabels([disc], view, "earth").get("earth"), "right");
});

Deno.test("a sphere's label is hidden when its centre is off screen", () => {
    const disc = { ...box("earth", -10, 100, 1), offset: 900, disc: true };

    assertEquals(placeLabels([disc], view, "x").get("earth"), "hidden");
});

Deno.test("a marker within 6 px of a larger body's marker is hidden unless it is kept", () => {
    const markers = [
        { id: "earth", x: 100, y: 100, radius: 6e6 },
        { id: "moon", x: 104, y: 103, radius: 1.7e6 },
        { id: "mars", x: 112, y: 100, radius: 3e6 },
    ];

    assertEquals(hiddenMarkers(markers, new Set()), new Set(["moon"]));
    assertEquals(hiddenMarkers(markers, new Set(["moon"])), new Set());
});

Deno.test("a label behind a nearer sphere is hidden", () => {
    const spheres = [{ id: "earth", pos: { x: 0, y: 0, z: -10 }, radius: 4 }];
    const anchors = [
        { id: "moon", pos: { x: 3, y: 0, z: -12 } },
        { id: "iss", pos: { x: 3, y: 0, z: -8 } },
        { id: "mars", pos: { x: 20, y: 0, z: -12 } },
        { id: "behind", pos: { x: 0, y: 0, z: 5 } },
    ];

    assertEquals(
        hiddenBehindSpheres(anchors, spheres, new Set()),
        new Set(["moon"]),
    );
    assertEquals(
        hiddenBehindSpheres(anchors, spheres, new Set(["moon"])),
        new Set(),
    );
});

Deno.test("a sphere hides what lies within its angular radius, which is 4.3 degrees here", () => {
    const spheres = [{ id: "earth", pos: { x: 20, y: 0, z: -2 }, radius: 1.5 }];
    // 2.85 and 6.8 degrees off the sphere's centre.
    const inside = { id: "in", pos: { x: 200, y: 10, z: -20 } };
    const outside = { id: "out", pos: { x: 200, y: 24, z: -20 } };

    assertEquals(
        hiddenBehindSpheres([inside, outside], spheres, new Set()),
        new Set(["in"]),
    );
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

Deno.test("a label keeps the side it had when it still fits there", () => {
    const labels = [box("sun", 100, 100, 1e9), box("moon", 108, 101, 1)];
    const previous = new Map([["moon", "left" as const]]);

    const placements = placeLabels(labels, view, "x", [], ["moon"], previous);

    assertEquals(placements.get("moon"), "left");
    assertEquals(placements.get("sun"), "right");
    assertEquals(
        placeLabels(
            [box("a", 100, 100, 1)],
            view,
            "x",
            [],
            [],
            new Map([["a", "left" as const]]),
        ).get("a"),
        "left",
    );
    assertEquals(
        placeLabels(
            [box("a", 20, 100, 1)],
            view,
            "x",
            [],
            [],
            new Map([["a", "left" as const]]),
        ).get("a"),
        "right",
    );
});

Deno.test("the selection's label is placed right after the focus's, and hides a bigger body's label it touches", () => {
    const labels = [box("sun", 100, 100, 1e9), box("moon", 108, 101, 1)];

    assertEquals(placeLabels(labels, view, "x").get("moon"), "left");
    assertEquals(
        placeLabels(labels, view, "x", [], ["moon"]).get("moon"),
        "right",
    );
    assertEquals(
        placeLabels(labels, view, "x", [], ["moon"]).get("sun"),
        "left",
    );
});

Deno.test("the focus is placed before the selection", () => {
    const labels = [box("a", 100, 100, 1), box("b", 108, 101, 1e9)];
    const placements = placeLabels(labels, view, "a", [], ["b"]);

    assertEquals(placements.get("a"), "right");
    assertEquals(placements.get("b"), "left");
});

Deno.test("the selection's label isn't hidden for sitting on a larger body's anchor", () => {
    const labels = [
        box("earth", 300, 300, 6.4e6),
        box("moon", 303, 302, 1.7e6),
    ];

    assertEquals(placeLabels(labels, view, "x").get("moon"), "hidden");
    assertEquals(
        placeLabels(labels, view, "x", [], ["moon"]).get("moon"),
        "right",
    );
});

Deno.test("the selection's label is still drawn when markers block both sides", () => {
    const labels = [box("moon", 400, 300, 1)];
    const dots = [
        { id: "a", x: 430, y: 300, size: 5 },
        { id: "b", x: 370, y: 300, size: 5 },
    ];

    assertEquals(placeLabels(labels, view, "x", dots).get("moon"), "hidden");
    assertEquals(
        placeLabels(labels, view, "x", dots, ["moon"]).get("moon"),
        "right",
    );
});

Deno.test("a hovered body's label shows like the selection's, after it", () => {
    const labels = [
        box("earth", 300, 300, 6.4e6),
        box("moon", 303, 302, 1.7e6),
        box("probe", 309, 301, 1),
    ];
    const placements = placeLabels(labels, view, "x", [], ["moon", "probe"]);

    assertEquals(placeLabels(labels, view, "x").get("probe"), "hidden");
    assertEquals(placements.get("moon"), "right");
    assertEquals(placements.get("probe"), "left");
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

Deno.test("an orbit is drawn from 16px up to four times the viewport's longer side", () => {
    assertEquals(ORBIT_MIN_PX, 16);
    assertEquals(ORBIT_MAX_VIEWPORTS, 4);
    assertEquals(orbitShown(15.9, 800, 600), false);
    assertEquals(orbitShown(16, 800, 600), true);
    assertEquals(orbitShown(3200, 800, 600), true);
    assertEquals(orbitShown(3200.1, 800, 600), false);
});

Deno.test("the largest orbit allowed follows the longer side of a tall viewport", () => {
    assertEquals(orbitShown(3000, 600, 800), true);
    assertEquals(orbitShown(3300, 600, 800), false);
});

Deno.test("the nearest point is the one closest to the position, among the first count", () => {
    const points = [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 0, 0];

    assertEquals(nearestPoint(points, 3, 9, 1, 0), 1);
    assertEquals(nearestPoint(points, 3, 8, 12, 0), 2);
    assertEquals(nearestPoint(points, 3, 0, 0, 1), 0);
    assertEquals(nearestPoint([5, 5, 5, 5, 5, 6], 2, 5, 5, 7), 1);
});

Deno.test("an orbit line is brightest at its body and fades along the trail", () => {
    assertAlmostEquals(trailAlpha(0, 100, false), 0.57);
    assertAlmostEquals(trailAlpha(100, 100, false), 0.12);
    assertAlmostEquals(trailAlpha(0, 100, true), 1);
    assertAlmostEquals(trailAlpha(50, 100, true), 0.65);
    assertAlmostEquals(trailAlpha(100, 100, true), 0.3);
});

Deno.test("the trail runs back against the motion, wrapping round the loop", () => {
    assertEquals(trailBack(10, 10, 100, 1), 0);
    assertEquals(trailBack(7, 10, 100, 1), 3);
    assertEquals(trailBack(12, 10, 100, 1), 98);
    assertEquals(trailBack(12, 10, 100, -1), 2);
    assertEquals(trailBack(7, 10, 100, -1), 97);
});
