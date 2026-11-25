/// <reference types="deno" />
import type { Vec3 } from "@cpluspatch/orbit";
import { assert, assertEquals, assertFalse } from "@std/assert";
import type { Placement } from "./labels.ts";
import {
    countText,
    heldPlacements,
    isMajor,
    layoutBodies,
    MODEL_MIN_PX,
    orbitSizes,
    type ScreenBody,
    type Settled,
    SPHERE_MIN_PX,
    settleLabels,
} from "./screen-pass.ts";

const viewport = { width: 800, height: 600 };
const fov = Math.PI / 2;
const camera = { x: 0, y: 0, z: 0 };

// Every km of depth and every km across is one px, so a sphere shows as radius / depth * 300 px.
const project = (position: Vec3) =>
    position.z >= 0
        ? null
        : { x: 400 + position.x, y: 300 - position.y, view: position };

const body = (id: string, over: Partial<ScreenBody> = {}): ScreenBody => ({
    id,
    parent: "sun",
    kind: "moon",
    mu: 1,
    radius: 1000,
    a: 1e9,
    model: false,
    markerPx: 9,
    ...over,
});

const sun = body("sun", { parent: null, kind: "star", a: null, radius: 1e3 });

const at = (x: number, y: number, z = -1000): Vec3 => ({ x, y, z });

const run = (
    bodies: ScreenBody[],
    positions: Record<string, Vec3>,
    options: { selected?: string; hovered?: string; focus?: string } = {},
) => {
    const { selected = null, hovered = null, focus = "sun" } = options;
    const map = new Map(Object.entries(positions));
    const keep = new Set([focus]);
    if (selected) keep.add(selected);
    const sizes = orbitSizes(bodies, map, camera, fov, viewport, keep);
    const layout = layoutBodies({
        bodies,
        positions: map,
        sizes,
        text: new Map(bodies.map(({ id }) => [id, { width: 50, height: 14 }])),
        camera,
        fov,
        viewport,
        focus,
        selected,
        hovered,
        keep,
        project,
    });
    const settle = (
        extra: { bare?: boolean; held?: Map<string, Placement> } = {},
    ): Settled =>
        settleLabels({
            bodies,
            layout,
            viewport,
            focus,
            selected,
            hovered,
            keep,
            folded: sizes.folded,
            bare: extra.bare ?? false,
            previous: new Map(),
            held: extra.held ?? new Map(),
            sides: new Map(),
            blocked: [],
        });

    return { sizes, layout, settle };
};

Deno.test("an orbit under the minimum px folds its body into the parent, unless it's kept", () => {
    const bodies = [sun, body("tiny", { a: 1e3 })];
    const positions = { sun: at(0, 0), tiny: at(0, 0) };

    const folded = run(bodies, positions);
    const kept = run(bodies, positions, { selected: "tiny" });

    assert((folded.sizes.orbitPx.get("tiny") ?? Infinity) < 1);
    assertEquals(folded.sizes.folds.get("sun"), ["tiny"]);
    assert(folded.sizes.folded.has("tiny"));
    assertFalse(folded.layout.bodies.has("tiny"));
    assertFalse(kept.sizes.folded.has("tiny"));
    assert(kept.layout.bodies.has("tiny"));
});

Deno.test("a body without a position gets no layout, and the root has no orbit size", () => {
    const { sizes, layout } = run([sun, body("moon")], { sun: at(0, 0) });

    assertFalse(sizes.orbitPx.has("sun"));
    assertFalse(layout.bodies.has("moon"));
    assert(layout.bodies.has("sun"));
});

Deno.test("a sphere shows from 4 px, and a model from 12 px", () => {
    // 1 km at 1000 km shows as 0.3 px, so 20 km is 6 px and 50 km is 15 px.
    const six = { radius: 2e4 };
    const fifteen = { radius: 5e4 };
    const bodies = [
        sun,
        body("six", six),
        body("six-model", { ...six, model: true }),
        body("fifteen-model", { ...fifteen, model: true }),
        body("small"),
    ];
    const positions = Object.fromEntries(
        bodies.map(({ id }) => [id, at(0, 0)]),
    );

    const { layout } = run(bodies, positions);

    assertEquals(SPHERE_MIN_PX, 4);
    assertEquals(MODEL_MIN_PX, 12);
    assert(layout.bodies.get("six")?.big);
    assertFalse(layout.bodies.get("six-model")?.big);
    assert(layout.bodies.get("fifteen-model")?.big);
    assertFalse(layout.bodies.get("small")?.big);
});

Deno.test("the label offset clears the disc when big and the marker when not", () => {
    const bodies = [sun, body("disc", { radius: 2e4 }), body("dot")];
    const positions = Object.fromEntries(
        bodies.map(({ id }) => [id, at(0, 0)]),
    );

    const { layout } = run(bodies, positions);

    assertEquals(layout.bodies.get("disc")?.offset, 6 + 6);
    assertEquals(layout.bodies.get("dot")?.offset, 6 + Math.round(4.5));
});

Deno.test("a sphere taller than the viewport asks for the fine geometry", () => {
    const bodies = [sun, body("near", { radius: 5e4, a: 1e12 })];

    const { layout } = run(bodies, {
        sun: at(0, 0, -1e9),
        near: at(0, 0, -20),
    });

    assert(layout.bodies.get("near")?.fine);
    assertFalse(layout.bodies.get("sun")?.fine);
});

Deno.test("a body behind the camera gets no pick, label, marker or anchor", () => {
    const bodies = [sun, body("behind")];

    const { layout } = run(bodies, { sun: at(0, 0), behind: at(10, 10, 500) });

    assertEquals(layout.bodies.get("behind")?.screen, null);
    assertEquals(
        layout.picks.map(({ id }) => id),
        ["sun"],
    );
    assertEquals(
        layout.labels.map(({ id }) => id),
        ["sun"],
    );
    assertEquals(layout.markers.length + layout.spheres.length, 1);
    assertEquals(layout.anchors.length, 1);
});

Deno.test("a label is built only when the orbit is big enough or the body is kept", () => {
    const bodies = [sun, body("far", { a: 1e6 }), body("kept", { a: 1e6 })];
    const positions = Object.fromEntries(
        bodies.map(({ id }) => [id, at(0, 0)]),
    );

    // 1000 km at 1000 km shows as 300 px, so shrink it with the depth.
    const near = run(bodies, positions, { selected: "kept" });
    const farAway = run(
        bodies,
        Object.fromEntries(bodies.map(({ id }) => [id, at(0, 0, -1e5)])),
        { selected: "kept" },
    );
    const labelled = (layout: typeof near.layout) =>
        layout.labels.map(({ id }) => id);

    assert(labelled(near.layout).includes("far"));
    assertFalse(labelled(farAway.layout).includes("far"));
    assert(labelled(farAway.layout).includes("kept"));
});

Deno.test("the drawn disc is only the selected body, and only when it's big", () => {
    const bodies = [sun, body("big", { radius: 2e4 }), body("dot")];
    const positions = {
        sun: at(0, 0),
        big: at(100, 50),
        dot: at(-100, 0),
    };

    const none = run(bodies, positions);
    const big = run(bodies, positions, { selected: "big" });
    const dot = run(bodies, positions, { selected: "dot" });

    assertEquals(none.layout.drawn, null);
    assertEquals(dot.layout.drawn, null);
    assertEquals(big.layout.drawn?.id, "big");
    assertEquals(big.layout.drawn?.x, 500);
    assertEquals(big.layout.drawn?.y, 250);
    assertEquals(
        big.layout.drawn?.radiusPx,
        big.layout.bodies.get("big")?.radiusPx,
    );
});

Deno.test("only the selected body gets room for readouts", () => {
    const bodies = [sun, body("a"), body("b")];
    const positions = { sun: at(0, 0), a: at(100, 0), b: at(-100, 0) };

    const { layout } = run(bodies, positions, { selected: "a" });

    assert(layout.labels.find(({ id }) => id === "a")?.readout);
    assertEquals(
        layout.labels.find(({ id }) => id === "b")?.readout,
        undefined,
    );
});

Deno.test("a label hides behind a sphere in front of it, and its marker and pick go with it", () => {
    const bodies = [
        sun,
        body("earth", { kind: "planet", radius: 6.4e6 }),
        body("moon"),
    ];
    const positions = {
        sun: at(300, 0),
        earth: at(0, 0, -20000),
        moon: at(0, 0, -40000),
    };

    const settled = run(bodies, positions).settle();

    assertEquals(settled.placements.get("moon") ?? "hidden", "hidden");
    assert(settled.unnamed.has("moon"));
    assertFalse(settled.picks.some(({ id }) => id === "moon"));
    assert(settled.picks.some(({ id }) => id === "earth"));
    assertFalse(settled.shown.get("moon")?.marker);
});

Deno.test("a marker next to a larger body's marker is covered, so its pick and marker go", () => {
    const bodies = [
        sun,
        body("big", { radius: 2000 }),
        body("small", { radius: 1000 }),
    ];
    const positions = { sun: at(300, 0), big: at(0, 0), small: at(3, 0) };

    const settled = run(bodies, positions).settle();

    assertFalse(settled.picks.some(({ id }) => id === "small"));
    assert(settled.picks.some(({ id }) => id === "big"));
    assert(settled.shown.get("big")?.marker);
    assertFalse(settled.shown.get("small")?.marker);
});

Deno.test("a kept or hovered body is never covered or unnamed", () => {
    const bodies = [sun, body("big", { radius: 2000 }), body("small")];
    const positions = { sun: at(300, 0), big: at(0, 0), small: at(3, 0) };

    const selected = run(bodies, positions, { selected: "small" }).settle();
    const hovered = run(bodies, positions, { hovered: "small" }).settle();

    assert(selected.picks.some(({ id }) => id === "small"));
    assertFalse(selected.unnamed.has("small"));
    assertFalse(hovered.unnamed.has("small"));
});

Deno.test("an unnamed moon is counted under its parent, and a planet is never unnamed", () => {
    const bodies = [
        sun,
        body("earth", { kind: "planet", radius: 6.4e6 }),
        body("moon", { parent: "earth" }),
        body("hidden-planet", { kind: "planet", radius: 6.4e6 }),
    ];
    const positions = {
        sun: at(300, 0),
        earth: at(0, 0, -20000),
        moon: at(0, 0, -40000),
        "hidden-planet": at(0, 0, -60000),
    };

    const settled = run(bodies, positions).settle();

    assertEquals(settled.culled.get("earth"), ["moon"]);
    assertFalse(settled.unnamed.has("hidden-planet"));
});

Deno.test("a folded moon is not counted as culled", () => {
    const bodies = [sun, body("moon", { a: 1e3 })];
    const run1 = run(bodies, { sun: at(0, 0), moon: at(0, 0) });

    const settled = run1.settle();

    assertEquals(settled.culled.size, 0);
    assertFalse(settled.shown.has("moon"));
});

Deno.test("the count text is empty, the number, or the names when hovered", () => {
    const names = new Map([
        ["a", "Alpha"],
        ["b", "Beta"],
    ]);

    assertEquals(countText([], names, true), "");
    assertEquals(countText(["a", "b"], names, false), "+2");
    assertEquals(countText(["a", "b"], names, true), "+ Alpha, Beta");
});

Deno.test("bare mode hides the markers of icon kinds only", () => {
    const bodies = [
        sun,
        body("craft", { kind: "spacecraft" }),
        body("rock", { kind: "asteroid" }),
        body("comet", { kind: "comet" }),
        body("moon"),
        body("dwarf", { kind: "dwarf" }),
    ];
    const positions = {
        sun: at(300, 0),
        craft: at(0, 0),
        rock: at(0, 100),
        comet: at(0, 200),
        moon: at(0, -100),
        dwarf: at(0, -200),
    };
    const { settle } = run(bodies, positions, { selected: "moon" });

    const bare = settle({ bare: true });
    const shown = settle();

    assertEquals([...bare.bareHidden].sort(), ["comet", "craft", "rock"]);
    assertFalse(bare.shown.get("rock")?.marker);
    assert(bare.shown.get("moon")?.marker);
    assert(bare.shown.get("dwarf")?.marker);
    assertEquals(shown.bareHidden.size, 0);
    assert(shown.shown.get("rock")?.marker);
    assertFalse(bare.picks.some(({ id }) => id === "craft"));
});

Deno.test("bare mode leaves a drawn spacecraft alone", () => {
    const bodies = [sun, body("craft", { kind: "spacecraft", radius: 2e4 })];

    const settled = run(bodies, { sun: at(300, 0), craft: at(0, 0) }).settle({
        bare: true,
    });

    assertEquals(settled.bareHidden.size, 0);
    assertFalse(settled.shown.get("craft")?.marker);
});

Deno.test("a hidden marker keeps its corona when its sphere is drawn, and loses it otherwise", () => {
    const bodies = [
        sun,
        body("big", { kind: "star", radius: 2e4 }),
        body("dot", { kind: "asteroid" }),
    ];
    const positions = { sun: at(300, 0), big: at(0, 100), dot: at(0, 0) };

    const settled = run(bodies, positions).settle({ bare: true });

    assert(settled.shown.get("big")?.corona);
    assertFalse(settled.shown.get("dot")?.corona);
});

Deno.test("a placed label's box is reported, and a hidden one has none", () => {
    const bodies = [
        sun,
        body("earth", { kind: "planet", radius: 6.4e6 }),
        body("moon"),
    ];
    const positions = {
        sun: at(300, 0),
        earth: at(0, 0, -20000),
        moon: at(0, 0, -40000),
    };

    const settled = run(bodies, positions).settle();

    assert(settled.placed.has("earth"));
    assertFalse(settled.placed.has("moon"));
});

Deno.test("a label that changed placement is reported against the previous ones", () => {
    const bodies = [sun, body("a"), body("b")];
    const positions = { sun: at(300, 0), a: at(0, 0), b: at(0, 100) };
    const { layout, sizes } = run(bodies, positions);

    const settle = (previous: Map<string, Placement>) =>
        settleLabels({
            bodies,
            layout,
            viewport,
            focus: "sun",
            selected: null,
            hovered: null,
            keep: new Set(["sun"]),
            folded: sizes.folded,
            bare: false,
            previous,
            held: new Map(),
            sides: new Map(),
            blocked: [],
        });

    const first = settle(new Map());
    const same = settle(first.placements);

    assertEquals([...first.changed].sort(), ["a", "b", "sun"]);
    assertEquals(same.changed, []);
});

Deno.test("a held placement is kept even where another label would push it off", () => {
    const bodies = [
        sun,
        body("planet", { kind: "planet", radius: 2e4 }),
        body("moon"),
    ];
    const positions = {
        sun: at(-390, 290),
        planet: at(-170, 200),
        moon: at(-200, 195),
    };
    const { layout, sizes } = run(bodies, positions);
    const settle = (held: Map<string, Placement>) =>
        settleLabels({
            bodies,
            layout,
            viewport,
            focus: "sun",
            selected: null,
            hovered: null,
            keep: new Set(["sun"]),
            folded: sizes.folded,
            bare: false,
            previous: new Map(),
            held,
            sides: new Map(),
            blocked: [],
        });

    const free = settle(new Map());
    const held = settle(new Map([["moon", "right"]]));

    assertEquals(held.placements.get("moon"), "right");
    assert(free.placements.get("moon") !== "right");
});

Deno.test("a placement is held for 500 ms after it changed", () => {
    const placements = new Map<string, Placement>([
        ["fresh", "left"],
        ["old", "right"],
        ["never", "above"],
    ]);
    const changed = new Map([
        ["fresh", 800],
        ["old", 100],
    ]);

    const held = heldPlacements(placements, changed, 1000);

    assertEquals([...held], [["fresh", "left"]]);
});

Deno.test("stars, planets and the focus are major", () => {
    assert(isMajor({ id: "a", kind: "star" }, "x"));
    assert(isMajor({ id: "a", kind: "planet" }, "x"));
    assert(isMajor({ id: "a", kind: "moon" }, "a"));
    assertFalse(isMajor({ id: "a", kind: "moon" }, "x"));
});
