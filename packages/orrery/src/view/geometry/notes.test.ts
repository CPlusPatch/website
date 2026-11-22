/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import type { Rect } from "./labels.ts";
import {
    blockSpots,
    type Clearance,
    firstClear,
    firstClearStack,
    nearPolyline,
    noteSpots,
} from "./notes.ts";

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
