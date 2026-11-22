/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { labelRect, placeLabels, type Rect } from "./labels.ts";
import { labelRank } from "./visibility.ts";

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

Deno.test("a lower-ranked label loses a spot to a higher-ranked one, whatever its radius", () => {
    const labels = [
        box("moon", 100, 100, labelRank("moon", 4.9e12)),
        box("mars", 108, 101, labelRank("planet", 4.3e13)),
    ];

    assertEquals(placeLabels(labels, view, "x").get("mars"), "right");
    assertEquals(placeLabels(labels, view, "x").get("moon"), "left");
});

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
