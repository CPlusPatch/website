/// <reference types="deno" />
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { projectedBox } from "./footprint.ts";

const camera = new PerspectiveCamera(90, 1, 0.1, 1000);
camera.position.set(0, 0, 10);
camera.updateMatrixWorld();

Deno.test("a box in front of the camera covers its corners' screen extent", () => {
    const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));

    const rect = projectedBox(box, camera, 200, 200);

    assert(rect);
    // The near face is 9 away and the far face 11, so the near face is the wider.
    assertAlmostEquals(rect.left, 100 - 100 / 9, 1e-6);
    assertAlmostEquals(rect.right, 100 + 100 / 9, 1e-6);
    assertAlmostEquals(rect.top, 100 - 100 / 9, 1e-6);
    assertAlmostEquals(rect.bottom, 100 + 100 / 9, 1e-6);
});

Deno.test("a box with a corner behind the camera has no footprint", () => {
    const box = new Box3(new Vector3(-1, -1, 5), new Vector3(1, 1, 15));

    assertEquals(projectedBox(box, camera, 200, 200), undefined);
});
