/// <reference types="deno" />
import { assertAlmostEquals, assertEquals } from "@std/assert";
import {
    finiteVelocity,
    SATELLITE_PREFIX,
    satelliteIndex,
} from "./satellite-focus.ts";

Deno.test("the velocity is the change of position over the span either side of now", () => {
    const position = (t: number) => ({ x: 2 * t, y: -t, z: 5 });

    const state = finiteVelocity(position, 10, 1);

    assertEquals(state?.r, { x: 20, y: -10, z: 5 });
    assertAlmostEquals(state?.v.x ?? 0, 2);
    assertAlmostEquals(state?.v.y ?? 0, -1);
    assertAlmostEquals(state?.v.z ?? 1, 0);
});

Deno.test("the velocity over a wider span is the same for a straight track", () => {
    const position = (t: number) => ({ x: 3 * t, y: 0, z: 0 });

    assertAlmostEquals(finiteVelocity(position, 0, 5)?.v.x ?? 0, 3);
});

Deno.test("the velocity of a position missing before, now or after is null", () => {
    const at = (missing: number) => (t: number) =>
        t === missing ? null : { x: t, y: 0, z: 0 };

    assertEquals(finiteVelocity(at(9), 10, 1), null);
    assertEquals(finiteVelocity(at(10), 10, 1), null);
    assertEquals(finiteVelocity(at(11), 10, 1), null);
});

Deno.test("a satellite's pointer id gives its index back, and a body's id gives none", () => {
    assertEquals(satelliteIndex(`${SATELLITE_PREFIX}42`), 42);
    assertEquals(satelliteIndex("earth"), null);
});
