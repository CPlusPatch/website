/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { type PickPoint, pickBody, pickLabel } from "./picking.ts";

const point = (
    id: string,
    x: number,
    y: number,
    depth = 1,
    radius?: number,
): PickPoint => ({ id, x, y, depth, radius });

Deno.test("a click picks the nearest body within 12 px", () => {
    const points = [point("a", 100, 100), point("b", 108, 100)];

    assertEquals(pickBody(points, 107, 100), "b");
    assertEquals(pickBody(points, 101, 100), "a");
});

Deno.test("a click farther than 12 px from every body picks nothing", () => {
    const points = [point("a", 100, 100)];

    assertEquals(pickBody(points, 112, 100), "a");
    assertEquals(pickBody(points, 113, 100), null);
    assertEquals(pickBody([], 0, 0), null);
});

Deno.test("the radius to search within can be changed", () => {
    assertEquals(pickBody([point("a", 100, 100)], 130, 100, 40), "a");
    assertEquals(pickBody([point("a", 100, 100)], 130, 100, 20), null);
});

Deno.test("bodies as far from the click as each other go to the nearer to the camera", () => {
    const points = [point("far", 100, 100, 9), point("near", 100.3, 100, 2)];

    assertEquals(pickBody(points, 100, 100), "near");
    assertEquals(pickBody([...points].reverse(), 100, 100), "near");
});

Deno.test("a clearly nearer body on screen wins over a body nearer the camera", () => {
    const points = [point("on", 100, 100, 9), point("off", 105, 100, 2)];

    assertEquals(pickBody(points, 100, 100), "on");
});

Deno.test("a sphere is hit within its radius plus 12 px", () => {
    const points = [point("earth", 100, 100, 1, 50)];

    assertEquals(pickBody(points, 100, 100), "earth");
    assertEquals(pickBody(points, 160, 100), "earth");
    assertEquals(pickBody(points, 162, 100), "earth");
    assertEquals(pickBody(points, 163, 100), null);
});

Deno.test("a marker in front of a sphere beats the sphere under the click", () => {
    const points = [
        point("earth", 100, 100, 9, 50),
        point("moon", 110, 100, 3, 4),
    ];

    assertEquals(pickBody(points, 108, 100), "moon");
    assertEquals(pickBody(points, 60, 100), "earth");
});

Deno.test("ties are measured from the nearest body, so a chain of near ties doesn't drift", () => {
    const points = [
        point("a", 100, 100, 5),
        point("b", 100.4, 100, 4),
        point("c", 100.8, 100, 3),
    ];

    assertEquals(pickBody(points, 100, 100), "b");
});

Deno.test("a click on a label picks its body when no body is near", () => {
    const rects = [
        { id: "a", left: 10, top: 10, right: 60, bottom: 24 },
        { id: "b", left: 10, top: 40, right: 60, bottom: 54 },
    ];

    assertEquals(pickLabel(rects, 30, 45), "b");
    assertEquals(pickLabel(rects, 10, 10), "a");
});

Deno.test("a click outside every label box picks no label", () => {
    const rects = [{ id: "a", left: 10, top: 10, right: 60, bottom: 24 }];

    assertEquals(pickLabel(rects, 61, 15), null);
    assertEquals(pickLabel(rects, 30, 25), null);
    assertEquals(pickLabel([], 0, 0), null);
});
