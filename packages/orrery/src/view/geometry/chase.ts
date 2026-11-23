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

/** Where the parent's centre sits on screen when it's small: 2/3 of the way down the half-frame. */
const PARENT_NDC = -2 / 3;
/** Where the craft sits on screen when the parent is small: 1/3 of the way up. */
const CRAFT_NDC = 1 / 3;

/** The chase camera's place and aim in the frame. */
export type ChaseView = {
    /** How far above the track the camera sits. */
    elevationRad: number;
    /** How far below the direction to the craft the camera looks. */
    pitchRad: number;
    /** The look target's distance below the craft, as a multiple of the camera's distance to it. */
    nadirOffset: number;
};

const smoothstep = (x: number): number => {
    const k = Math.min(Math.max(x, 0), 1);

    return k * k * (3 - 2 * k);
};

/**
 * The chase view for a parent of angular radius `parentAngularRadiusRad` seen from the craft.
 * While the parent's limb is at most a quarter of the FOV below the screen centre in the behind
 * view, that view stays. Over the next quarter it blends to one with the parent's centre 2/3 down
 * the half-frame and the craft 1/3 up. The parent is far, so its centre lies along nadir.
 */
export const chaseView = (
    parentAngularRadiusRad: number,
    verticalFovRad: number,
): ChaseView => {
    const half = verticalFovRad / 2;
    const tanHalf = Math.tan(half);

    const farPitch = Math.atan(CRAFT_NDC * tanHalf);
    const farParent = Math.atan(-PARENT_NDC * tanHalf);
    // The craft and the nadir are 90 degrees minus the elevation apart, as seen from the camera.
    const farElevation = Math.PI / 2 - farParent - farPitch;

    const limb = Math.PI / 2 - BEHIND_ELEVATION_RAD - parentAngularRadiusRad;
    const w = smoothstep((limb - half / 2) / (half / 2));

    const elevationRad =
        BEHIND_ELEVATION_RAD + (farElevation - BEHIND_ELEVATION_RAD) * w;
    const pitchRad = farPitch * w;
    // The angle at the camera between the craft and a point `m` below it is atan(m cos e / (1 + m sin e)).
    const t = Math.tan(pitchRad);
    const nadirOffset =
        t / (Math.cos(elevationRad) - t * Math.sin(elevationRad));

    return { elevationRad, pitchRad, nadirOffset };
};

/** The unit direction of the chase camera in the frame: behind the body and a little above. */
export const behindDirection = (elevationRad = BEHIND_ELEVATION_RAD): Vec3 => ({
    x: -Math.cos(elevationRad),
    y: 0,
    z: Math.sin(elevationRad),
});
