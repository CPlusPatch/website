/// <reference types="deno" />
import { assertAlmostEquals, assertEquals } from "@std/assert";
import { add, cross, dot, length, normalize, scale, sub } from "./vec.ts";

Deno.test("add, sub and scale work per component", () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 4, y: 5, z: 6 };

    assertEquals(add(a, b), { x: 5, y: 7, z: 9 });
    assertEquals(sub(b, a), { x: 3, y: 3, z: 3 });
    assertEquals(scale(a, 2), { x: 2, y: 4, z: 6 });
});

Deno.test("the cross product of x and y is z, and it is perpendicular to both", () => {
    const x = { x: 1, y: 0, z: 0 };
    const y = { x: 0, y: 1, z: 0 };

    assertEquals(cross(x, y), { x: 0, y: 0, z: 1 });
    assertEquals(
        dot(cross({ x: 1, y: 2, z: 3 }, { x: -2, y: 5, z: 1 }), {
            x: 1,
            y: 2,
            z: 3,
        }),
        0,
    );
});

Deno.test("normalize gives a vector of length 1", () => {
    assertAlmostEquals(length(normalize({ x: 3, y: 4, z: 12 })), 1, 1e-15);
});
