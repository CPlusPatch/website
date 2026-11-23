/**
 * @module
 * The frame a chase camera turns with, and where it sits in that frame.
 */

import { cross, length, type Vec3 } from "@cpluspatch/orbit";
import { lvlhMatrix } from "./attitude.ts";

/** How far above the track the chase camera sits. */
export const BEHIND_ELEVATION_RAD = (15 * Math.PI) / 180;

/** Below this share of |r||v|, the orbit has no plane to speak of. */
const DEGENERATE = 1e-9;

/**
 * The local orbital frame of a body as a column-major rotation matrix, or `null` when `r` or `v`
 * leave it undefined: no distance, no speed, or a motion straight along `r`.
 * `r` and `v` are relative to the parent. The columns are along-track, orbit normal and zenith.
 */
export const chaseFrame = (r: Vec3, v: Vec3): number[] | null => {
    const radius = length(r);
    const speed = length(v);
    if (radius === 0 || speed === 0) return null;
    if (length(cross(r, v)) <= DEGENERATE * radius * speed) return null;

    return lvlhMatrix(r, v);
};

/** The unit direction of the chase camera in the frame: behind the body and a little above. */
export const behindDirection = (): Vec3 => ({
    x: -Math.cos(BEHIND_ELEVATION_RAD),
    y: 0,
    z: Math.sin(BEHIND_ELEVATION_RAD),
});
