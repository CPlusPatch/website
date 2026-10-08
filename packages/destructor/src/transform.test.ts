/// <reference types="deno" />
import { assertAlmostEquals, assertEquals } from "@std/assert";
import { bodyTransform, decompose } from "./transform.ts";

const matrix = (rotate: number, scale: number) => ({
    m11: scale * Math.cos(rotate),
    m12: scale * Math.sin(rotate),
});

Deno.test("the identity decomposes to no rotation and unit scale", () => {
    assertEquals(decompose({ m11: 1, m12: 0 }), { rotate: 0, scale: 1 });
});

Deno.test("rotation and scale round-trip, including at a quarter turn", () => {
    for (const rotate of [0.3, -1.2, Math.PI / 2, -Math.PI / 2]) {
        const result = decompose(matrix(rotate, 1.5));
        assertAlmostEquals(result.rotate, rotate);
        assertAlmostEquals(result.scale, 1.5);
    }
});

Deno.test("a zero-scale matrix decomposes to zero scale", () => {
    assertEquals(decompose({ m11: 0, m12: 0 }).scale, 0);
});

Deno.test("the element is centred on the body, then rotated and scaled", () => {
    assertEquals(
        bodyTransform({ x: 100, y: 50 }, 0.5, { width: 40, height: 20 }, 2, {
            x: 0,
            y: 0,
        }),
        "translate(80px, 40px) rotate(0.5rad) scale(2)",
    );
});

Deno.test("an offset body shifts the element back by the offset", () => {
    assertEquals(
        bodyTransform({ x: 0, y: 0 }, 0, { width: 0, height: 0 }, 1, {
            x: 3,
            y: -4,
        }),
        "translate(0px, 0px) rotate(0rad) scale(1) translate(-3px, 4px)",
    );
});
