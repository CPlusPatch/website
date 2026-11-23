import type { Box3, PerspectiveCamera } from "three";
import { Vector3 } from "three";
import type { Rect } from "./labels.ts";

const corner = new Vector3();

/** The px box that a world-space `box` covers on screen, or undefined when a corner is behind the camera. */
export const projectedBox = (
    box: Box3,
    camera: PerspectiveCamera,
    width: number,
    height: number,
): Rect | undefined => {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (let i = 0; i < 8; i++) {
        corner.set(
            i & 1 ? box.max.x : box.min.x,
            i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z,
        );

        // A point behind the camera projects to a mirrored spot.
        corner.applyMatrix4(camera.matrixWorldInverse);
        if (corner.z >= 0) return undefined;

        corner.applyMatrix4(camera.projectionMatrix);
        const x = (corner.x * 0.5 + 0.5) * width;
        const y = (0.5 - corner.y * 0.5) * height;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
    }

    return { left, top, right, bottom };
};
