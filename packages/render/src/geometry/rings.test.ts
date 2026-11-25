/// <reference types="deno" />
import { assertAlmostEquals, assertEquals } from "@std/assert";
import { ringSpan, ringU, ringUvs } from "./rings.ts";

Deno.test("the strip's edges are u = 0 and u = 1", () => {
    assertEquals(ringU(2, 2, 5), 0);
    assertEquals(ringU(5, 2, 5), 1);
    assertAlmostEquals(ringU(3.5, 2, 5), 0.5, 1e-12);
});

Deno.test("the span is in body radii, from edges and a radius in m", () => {
    const { inner, outer } = ringSpan(74_500_000, 140_220_000, 58_232_000);

    assertAlmostEquals(inner, 74_500 / 58_232, 1e-12);
    assertAlmostEquals(outer, 140_220 / 58_232, 1e-12);
});

Deno.test("each vertex gets u from its distance to the axis and v in the middle", () => {
    // Inner edge, a point 3 from the axis, outer edge.
    const uvs = ringUvs([2, 0, 0, 0, 3, 0, -4, 0, 0], 2, 4);

    assertEquals(Array.from(uvs), [0, 0.5, 0.5, 0.5, 1, 0.5]);
});
