/**
 * @module
 * How a nadir-pointing spacecraft is turned in its orbit.
 */

import { cross, normalize, type Vec3 } from "@cpluspatch/orbit";

/**
 * The rotation of a spacecraft model onto its local orbital frame, as a column-major matrix for `Matrix4.fromArray`.
 *
 * `r` and `v` are the position and velocity relative to the parent. The model has +z at zenith,
 * +y on the orbit normal and +x along the track, which is the velocity for a circular orbit.
 */
export const lvlhMatrix = (r: Vec3, v: Vec3): number[] => {
    const z = normalize(r);
    const y = normalize(cross(r, v));
    const x = cross(y, z);

    return [x.x, x.y, x.z, 0, y.x, y.y, y.z, 0, z.x, z.y, z.z, 0, 0, 0, 0, 1];
};
