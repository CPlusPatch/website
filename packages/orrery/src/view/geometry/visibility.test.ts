/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
    CORONA_MIN_PX,
    CORONA_RADII,
    coronaDiameter,
    culledByParent,
    foldOrbits,
    hiddenBehindSpheres,
    hiddenMarkers,
    LABEL_MIN_ORBIT_PX,
    labelRank,
    labelShownForOrbit,
    ORBIT_FADE_VIEWPORTS,
    ORBIT_FULL_PX,
    ORBIT_MAX_VIEWPORTS,
    ORBIT_MIN_PX,
    orbitFade,
    orbitShown,
    projectedRadiusPx,
} from "./visibility.ts";

Deno.test("a sphere that fills the field of view is half the viewport tall", () => {
    const fov = Math.PI / 2;

    assertAlmostEquals(projectedRadiusPx(1, 1, fov, 800), 400);
});

Deno.test("a sphere twice as far away looks half as big", () => {
    const near = projectedRadiusPx(10, 100, 0.8, 600);
    const far = projectedRadiusPx(10, 200, 0.8, 600);

    assertAlmostEquals(far, near / 2);
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

Deno.test("an orbit fades in from 16 px to 32 px and out from two to four viewports", () => {
    assertEquals(ORBIT_MIN_PX, 16);
    assertEquals(ORBIT_FULL_PX, 32);
    assertEquals(ORBIT_FADE_VIEWPORTS, 2);
    assertEquals(ORBIT_MAX_VIEWPORTS, 4);
    assertEquals(orbitFade(15.9, 800, 600), 0);
    assertAlmostEquals(orbitFade(24, 800, 600), 0.5);
    assertEquals(orbitFade(32, 800, 600), 1);
    assertEquals(orbitFade(400, 800, 600), 1);
    assertEquals(orbitFade(1600, 800, 600), 1);
    assertAlmostEquals(orbitFade(2400, 800, 600), 0.5);
    assertEquals(orbitFade(3200.1, 800, 600), 0);
});

Deno.test("an orbit is shown while it has any fade left", () => {
    assertEquals(orbitShown(15.9, 800, 600), false);
    assertEquals(orbitShown(16.1, 800, 600), true);
    assertEquals(orbitShown(3199, 800, 600), true);
    assertEquals(orbitShown(3200.1, 800, 600), false);
});

Deno.test("the fade out follows the longer side of a tall viewport", () => {
    assertEquals(orbitFade(1600, 600, 800), 1);
    assertAlmostEquals(orbitFade(2400, 600, 800), 0.5);
    assertEquals(orbitShown(3300, 600, 800), false);
});

Deno.test("a picked orbit doesn't fade out at any size over the minimum", () => {
    assertEquals(orbitFade(2400, 800, 600, true), 1);
    assertEquals(orbitFade(1e6, 800, 600, true), 1);
    assertEquals(orbitShown(1e6, 800, 600, true), true);
    assertEquals(orbitShown(15.9, 800, 600, true), false);
});

Deno.test("a label ranks the star over planets over the rest, then by mu", () => {
    assert(labelRank("star", 1) > labelRank("planet", 1e30));
    assert(labelRank("planet", 1) > labelRank("dwarf", 1e30));
    assert(labelRank("planet", 1e17) > labelRank("planet", 1e14));
    assertEquals(labelRank("moon", 5), labelRank("spacecraft", 5));
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

Deno.test("a parent's culled children are counted by parent, without the folded ones", () => {
    const bodies = [
        { id: "mars", parent: "sun" },
        { id: "phobos", parent: "mars" },
        { id: "mro", parent: "mars" },
        { id: "hope", parent: "mars" },
        { id: "tgo", parent: "mars" },
    ];
    const culled = new Set(["phobos", "mro", "hope", "mars"]);
    const folded = new Set(["hope"]);

    assertEquals(
        [...culledByParent(bodies, culled, folded)],
        [
            ["sun", ["mars"]],
            ["mars", ["phobos", "mro"]],
        ],
    );
});

Deno.test("a far star's corona projects to the px floor", () => {
    const diameter = coronaDiameter(700_000, 1e12, 0.8, 600);

    assertAlmostEquals(
        projectedRadiusPx(diameter / 2, 1e12, 0.8, 600) * 2,
        CORONA_MIN_PX,
    );
});

Deno.test("a near star's corona is its radius times CORONA_RADII across", () => {
    assertAlmostEquals(coronaDiameter(700_000, 2e6, 0.8, 600), 6 * 700_000);
    assertEquals(CORONA_RADII, 3);
});
