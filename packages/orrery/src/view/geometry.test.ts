/// <reference types="deno" />
import {
    AU,
    type Body,
    type Elements,
    orbitPoints,
    solarSystem,
} from "@cpluspatch/orbit";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
    axisPosition,
    blockSpots,
    type Clearance,
    centreShift,
    ease,
    firstClear,
    firstClearStack,
    fitDistanceKm,
    focusDistanceKm,
    focusTween,
    foldOrbits,
    gripNoteSpots,
    hiddenBehindSpheres,
    hiddenMarkers,
    LABEL_MIN_ORBIT_PX,
    labelRank,
    labelRect,
    labelShownForOrbit,
    minDistanceKm,
    nearAnomalies,
    nearestPoint,
    nearPolyline,
    nodeAnomaly,
    noteSpots,
    ORBIT_MAX_VIEWPORTS,
    ORBIT_MIN_PX,
    orbitShown,
    placeLabels,
    planeAngle,
    pointAtAnomaly,
    projectedRadiusPx,
    type Rect,
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

const box = (id: string, x: number, y: number, rank: number) => ({
    id,
    x,
    y,
    width: 50,
    height: 14,
    offset: 6,
    disc: false,
    rank,
    big: false,
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

Deno.test("a label of a body just past the right edge goes left if it fits there, and hides if it doesn't", () => {
    const edge = placeLabels([box("a", 805, 100, 1)], view, "x");
    const past = placeLabels([box("b", 830, 100, 1)], view, "x");

    assertEquals(edge.get("a"), "left");
    assertEquals(past.get("b"), "hidden");
});

Deno.test("a label that fits neither side of the viewport is hidden", () => {
    const wide = { ...box("a", 30, 100, 1), width: 60 };
    const placements = placeLabels([wide], { width: 80, height: 600 }, "x");

    assertEquals(placements.get("a"), "hidden");
});

Deno.test("the focus's label hides any label it touches, whatever the rank", () => {
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

// Block the right and left boxes of a label at (100, 100) that is 50 wide and 14 tall.
const sides = [
    { left: 106, top: 90, right: 400, bottom: 110 },
    { left: 0, top: 90, right: 94, bottom: 110 },
];

Deno.test("a big label that fits neither side goes above, then below", () => {
    const labels = [{ ...box("a", 100, 100, 1), big: true }];
    // The above box spans y 72 to 86.
    const aboveTaken = { left: 90, top: 75, right: 110, bottom: 80 };

    assertEquals(
        placeLabels(labels, view, "x", [], [], new Map(), sides).get("a"),
        "above",
    );
    assertEquals(
        placeLabels(labels, view, "x", [], [], new Map(), [
            ...sides,
            aboveTaken,
        ]).get("a"),
        "below",
    );
});

Deno.test("a label that isn't big never goes above or below", () => {
    const labels = [box("a", 100, 100, 1)];

    assertEquals(
        placeLabels(labels, view, "x", [], [], new Map(), sides).get("a"),
        "hidden",
    );
});

Deno.test("an above label is centred and sits offset plus 8 px over its anchor", () => {
    const labels = [{ ...box("a", 100, 100, 1), big: true, offset: 10 }];
    // The box spans x 75 to 125 and y 68 to 82.
    const place = (rect: Rect) =>
        placeLabels(labels, view, "x", [], [], new Map(), [...sides, rect]).get(
            "a",
        );

    assertEquals(place({ left: 80, top: 82, right: 120, bottom: 90 }), "above");
    assertEquals(place({ left: 80, top: 81, right: 120, bottom: 90 }), "below");
    assertEquals(
        place({ left: 125, top: 60, right: 130, bottom: 90 }),
        "above",
    );
    assertEquals(
        place({ left: 124, top: 60, right: 130, bottom: 90 }),
        "below",
    );
    assertEquals(place({ left: 70, top: 60, right: 75, bottom: 90 }), "above");
    assertEquals(place({ left: 70, top: 60, right: 76, bottom: 90 }), "below");
});

Deno.test("a big label above the viewport's top goes below", () => {
    const labels = [{ ...box("a", 100, 10, 1), big: true }];
    const blocked = [
        { left: 106, top: 0, right: 400, bottom: 20 },
        { left: 0, top: 0, right: 94, bottom: 20 },
    ];

    assertEquals(
        placeLabels(labels, view, "x", [], [], new Map(), blocked).get("a"),
        "below",
    );
});

Deno.test("a big label keeps its above or below spot when it still fits", () => {
    const labels = [{ ...box("a", 100, 100, 1), big: true }];

    assertEquals(
        placeLabels(labels, view, "x", [], [], new Map([["a", "below"]])).get(
            "a",
        ),
        "below",
    );
    assertEquals(
        placeLabels(labels, view, "x", [], [], new Map([["a", "above"]])).get(
            "a",
        ),
        "above",
    );
});

Deno.test("a label that isn't big ignores an above spot it had", () => {
    const labels = [box("a", 100, 100, 1)];
    const previous = new Map([["a", "above" as const]]);

    assertEquals(
        placeLabels(labels, view, "x", [], [], previous).get("a"),
        "right",
    );
});

Deno.test("a label ranks the star over planets over the rest, then by mu", () => {
    assert(labelRank("star", 1) > labelRank("planet", 1e30));
    assert(labelRank("planet", 1) > labelRank("dwarf", 1e30));
    assert(labelRank("planet", 1e17) > labelRank("planet", 1e14));
    assertEquals(labelRank("moon", 5), labelRank("spacecraft", 5));
});

Deno.test("a lower-ranked label loses a spot to a higher-ranked one, whatever its radius", () => {
    const labels = [
        box("moon", 100, 100, labelRank("moon", 4.9e12)),
        box("mars", 108, 101, labelRank("planet", 4.3e13)),
    ];

    assertEquals(placeLabels(labels, view, "x").get("mars"), "right");
    assertEquals(placeLabels(labels, view, "x").get("moon"), "left");
});

Deno.test("an orbit under the minimum folds into its parent, in input order", () => {
    const folded = foldOrbits(
        [
            { id: "mars", parent: "sun", aPx: 400 },
            { id: "moon", parent: "earth", aPx: ORBIT_MIN_PX - 1 },
            { id: "iss", parent: "earth", aPx: 2 },
            { id: "phobos", parent: "mars", aPx: ORBIT_MIN_PX },
        ],
        new Set(),
    );

    assertEquals([...folded], [["earth", ["moon", "iss"]]]);
});

Deno.test("the focus and the selection don't fold", () => {
    const orbits = [
        { id: "moon", parent: "earth", aPx: 3 },
        { id: "iss", parent: "earth", aPx: 2 },
    ];

    assertEquals(
        [...foldOrbits(orbits, new Set(["moon"]))],
        [["earth", ["iss"]]],
    );
    assertEquals(foldOrbits(orbits, new Set(["moon", "iss"])).size, 0);
});

Deno.test("a label of a small orbit shows only when kept, and a body without an orbit always does", () => {
    assertEquals(labelShownForOrbit(LABEL_MIN_ORBIT_PX - 1, false), false);
    assertEquals(labelShownForOrbit(LABEL_MIN_ORBIT_PX - 1, true), true);
    assertEquals(labelShownForOrbit(LABEL_MIN_ORBIT_PX, false), true);
    assertEquals(labelShownForOrbit(undefined, false), true);
});

const room: Clearance = {
    viewport: { width: 400, height: 300 },
    taken: [],
    line: [],
    gap: 8,
};
const area = (
    left: number,
    top: number,
    right: number,
    bottom: number,
): Rect => ({
    left,
    top,
    right,
    bottom,
});

Deno.test("a polyline within the gap of a rect is near it, and one farther off isn't", () => {
    const rect = area(100, 100, 140, 120);
    // A horizontal line 5px above the rect.
    const line = [0, 95, 300, 95];

    assert(nearPolyline(rect, line, 8));
    assert(!nearPolyline(rect, line, 2));
});

Deno.test("a polyline that crosses a rect is near it even with no endpoint inside", () => {
    assert(nearPolyline(area(100, 100, 140, 120), [120, 0, 120, 300], 0));
});

Deno.test("a segment with a NaN end is skipped, and the line before it still counts", () => {
    const rect = area(100, 100, 140, 120);

    assert(!nearPolyline(rect, [0, 110, Number.NaN, Number.NaN, 300, 110], 0));
    assert(nearPolyline(rect, [0, 110, 200, 110, Number.NaN, Number.NaN], 0));
});

Deno.test("a note goes outward from the orbit's centre first, and inward last", () => {
    const spots = noteSpots(200, 100, 100, 100, 60);

    assertEquals(spots.length, 12);
    // Outward is +x: the box's centre is 9px plus half its width past the point.
    assertAlmostEquals(spots[0]?.left ?? 0, 209);
    assert((spots[5]?.right ?? 1000) < 200);
});

Deno.test("a note tries the same directions farther out once every near spot is taken", () => {
    const spots = noteSpots(200, 100, 100, 100, 60);

    assertAlmostEquals(spots[6]?.left ?? 0, 217);
    assert((spots[11]?.right ?? 1000) < 192);
});

Deno.test("a note's box is 14px tall, with its text's width and 2px each side", () => {
    const [spot] = noteSpots(200, 100, 100, 100, 60);

    assertAlmostEquals((spot?.right ?? 0) - (spot?.left ?? 0), 64);
    assertAlmostEquals((spot?.bottom ?? 0) - (spot?.top ?? 0), 14);
    // Level with the point, since the direction is horizontal.
    assertAlmostEquals(((spot?.top ?? 0) + (spot?.bottom ?? 0)) / 2, 100);
});

Deno.test("a point on the orbit's centre puts the first note above it", () => {
    const [spot] = noteSpots(100, 100, 100, 100, 60);

    assert((spot?.bottom ?? 1000) < 100);
});

Deno.test("a block tries below flush left first, then right, then above, all lines before one", () => {
    const tag = area(100, 50, 160, 70);
    const stacks = blockSpots(tag, [50, 80], 16);

    assertEquals(stacks.length, 8);
    assertEquals(
        stacks.map((stack) => stack.length),
        [2, 2, 2, 2, 1, 1, 1, 1],
    );
    // Below, flush left: the text starts at the tag's left edge.
    assertEquals(stacks[0]?.[0]?.left, 98);
    assertEquals(stacks[0]?.[0]?.top, 70 + 9 - 7);
    assertEquals(stacks[0]?.[1]?.top, 70 + 9 + 16 - 7);
    // Below, flush right: the text ends at the tag's right edge.
    assertEquals(stacks[1]?.[1]?.right, 162);
    // Above stacks upward, nearest line first.
    assertEquals(stacks[2]?.[0]?.bottom, 50 - 9 + 7);
    assertEquals(stacks[2]?.[1]?.bottom, 50 - 9 - 16 + 7);
});

Deno.test("a block of one line has four spots, since a one-line retry would repeat them", () => {
    assertEquals(blockSpots(area(0, 0, 10, 10), [30], 16).length, 4);
});

Deno.test("the first clear spot skips one off the viewport, one on a taken box and one near the line", () => {
    const spots = [
        area(-10, 10, 40, 24),
        area(100, 10, 150, 24),
        area(200, 10, 250, 24),
        area(300, 200, 350, 214),
    ];
    const clearance = {
        ...room,
        taken: [area(90, 0, 160, 40)],
        // A vertical line 3px off the third spot.
        line: [247 + 7, 0, 247 + 7, 300],
    };

    assertEquals(firstClear(spots, clearance), spots[3]);
    assertEquals(firstClear(spots.slice(0, 3), clearance), null);
});

Deno.test("a stack is clear only if every line of it is", () => {
    const high = [area(10, 10, 60, 24), area(10, 26, 60, 40)];
    const low = [area(10, 100, 60, 114), area(10, 116, 60, 130)];
    const clearance = { ...room, taken: [area(0, 30, 100, 35)] };

    assertEquals(firstClearStack([high, low], clearance), low);
});

Deno.test("a placed label's box is the one placeLabels tried", () => {
    const label = {
        id: "a",
        x: 100,
        y: 50,
        width: 60,
        height: 16,
        offset: 10,
        disc: false,
        rank: 1,
        big: true,
    };

    assertEquals(labelRect(label, "right"), area(110, 42, 170, 58));
    assertEquals(labelRect(label, "left"), area(30, 42, 90, 58));
    assertEquals(labelRect(label, "above"), area(70, 16, 130, 32));
});

const ORIGIN = { x: 0, y: 0, z: 0 };

const TILTED: Elements = {
    a: 7e6,
    e: 0.3,
    i: 0.9,
    raan: 1,
    argp: 2,
    m0: 0,
    epoch: 0,
};

Deno.test("a circular orbit's node is at minus its argument of periapsis", () => {
    assertAlmostEquals(nodeAnomaly(0, 1), 2 * Math.PI - 1);
    assertAlmostEquals(nodeAnomaly(0, 0), 0);
});

Deno.test("the node is level with the parent and the orbit climbs after it", () => {
    for (const e of [0, 0.3, 0.9]) {
        for (const argp of [0.5, 2, 4, 6]) {
            const el = { ...TILTED, e, argp, i: 0.7 };
            const at = nodeAnomaly(e, argp);

            assertAlmostEquals(pointAtAnomaly(el, at).z / el.a, 0, 1e-9);
            assert(pointAtAnomaly(el, at + 0.01).z > 0);
        }
    }
});

Deno.test("a point at an anomaly is where the orbit's samples are", () => {
    const samples = orbitPoints(TILTED, 24);

    for (const k of [0, 5, 12, 19]) {
        const point = pointAtAnomaly(TILTED, (2 * Math.PI * k) / 24);

        assertAlmostEquals(point.x, samples[3 * k] ?? Number.NaN, 1e-6);
        assertAlmostEquals(point.y, samples[3 * k + 1] ?? Number.NaN, 1e-6);
        assertAlmostEquals(point.z, samples[3 * k + 2] ?? Number.NaN, 1e-6);
    }
});

Deno.test("the pointer's place on an axis is a fraction of the axis", () => {
    assertAlmostEquals(axisPosition(50, 0, 100, 0, 100) ?? Number.NaN, 0.5);
    assertAlmostEquals(axisPosition(150, 30, 100, 0, 100) ?? Number.NaN, 1.5);
    assertAlmostEquals(axisPosition(0, 40, 0, 80, 100) ?? Number.NaN, 0.5);
});

Deno.test("the pointer behind the start of an axis is negative", () => {
    assertAlmostEquals(axisPosition(-50, 0, 100, 0, 100) ?? Number.NaN, -0.5);
});

Deno.test("an axis that points at the viewer can't place the pointer", () => {
    assertEquals(axisPosition(10, 10, 20, 0, 100), null);
    assert(axisPosition(10, 10, 30, 0, 100) !== null);
});

Deno.test("a ray down onto the plane gives the angle of its hit round the centre", () => {
    const centre = { x: 10, y: 0, z: 5 };
    const origin = { x: 10, y: 0, z: 25 };
    const dir = { x: 0, y: 1, z: -1 };

    assertAlmostEquals(
        planeAngle(origin, dir, centre) ?? Number.NaN,
        Math.PI / 2,
    );
    assertAlmostEquals(
        planeAngle(origin, { x: -1, y: 0, z: -1 }, centre) ?? Number.NaN,
        Math.PI,
    );
});

Deno.test("a ray along the plane doesn't hit it", () => {
    const origin = { x: 0, y: 0, z: 10 };

    assertEquals(planeAngle(origin, { x: 1, y: 0, z: -0.01 }, ORIGIN), null);
});

Deno.test("a ray going away from the plane doesn't hit it", () => {
    const origin = { x: 0, y: 0, z: 10 };

    assertEquals(planeAngle(origin, { x: 1, y: 0, z: 1 }, ORIGIN), null);
});

Deno.test("a drag note goes right of its grip, then left, then below", () => {
    const [right, left, below] = gripNoteSpots(100, 50, 60);

    assertEquals(right?.left, 114);
    assertEquals(left?.right, 86);
    assertEquals(below?.top, 63);
    assertEquals((right?.right ?? 0) - (right?.left ?? 0), 64);
});

Deno.test("near anomalies run once round the orbit, growing from the body", () => {
    const count = 2048;
    const center = 1.3;
    const first = 0.004;
    const anomalies = nearAnomalies(center, first, count);

    assertEquals(anomalies.length, count + 1);
    assertAlmostEquals(anomalies[0] ?? 0, center - Math.PI, 1e-12);
    assertAlmostEquals(anomalies[count] ?? 0, center + Math.PI, 1e-12);
    assertEquals(anomalies[count / 2], center);
    assertAlmostEquals((anomalies[count / 2 + 1] ?? 0) - center, first, 1e-12);
    assertAlmostEquals(center - (anomalies[count / 2 - 1] ?? 0), first, 1e-12);

    for (let k = 1; k <= count; k++) {
        assert((anomalies[k] ?? 0) > (anomalies[k - 1] ?? 0));
    }
});
