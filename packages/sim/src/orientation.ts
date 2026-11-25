import { scale, type Vec3 } from "@cpluspatch/orbit";
import {
    type Orientation,
    orientationAt,
    type Rotation,
    spinRateAt,
} from "./rotation/index.ts";

/** The orientation of a body with `rotation` at `t` seconds since J2000, or null if it has no rotation. */
export const bodyOrientation = (
    rotation: Rotation | undefined,
    t: number,
): Orientation | null => (rotation ? orientationAt(rotation, t) : null);

/** The sidereal rotation period of a body with `rotation` in seconds at `t`, or null if it has no rotation or doesn't spin. */
export const rotationPeriod = (
    rotation: Rotation | undefined,
    t: number,
): number | null => {
    if (!rotation) {
        return null;
    }

    const rate = Math.abs(spinRateAt(rotation, t));

    return rate === 0 ? null : (2 * Math.PI) / rate;
};

/** The unit spin axis (angular momentum direction) of a body with `rotation` in the ecliptic J2000 frame, or null. */
export const spinAxis = (
    rotation: Rotation | undefined,
    t: number,
): Vec3 | null => {
    const orientation = bodyOrientation(rotation, t);

    if (!rotation || !orientation) {
        return null;
    }

    // A retrograde body's IAU north pole is on the orbit-normal side of its equator.
    return spinRateAt(rotation, t) < 0
        ? scale(orientation.z, -1)
        : orientation.z;
};
