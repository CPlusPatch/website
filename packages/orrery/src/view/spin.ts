/**
 * @module
 * How a body's sphere turns to match its IAU pole and prime meridian.
 */

import type { Orientation } from "@cpluspatch/sim";

/**
 * The rotation of a `SphereGeometry` onto `orientation`, as a column-major matrix for `Matrix4.fromArray`.
 *
 * The geometry has its pole on +y and the map's centre (lon 0) on +x. Its +z is 270°E, so it
 * maps to the body's −y.
 */
export const spinMatrix = ({ x, y, z }: Orientation): number[] => [
    x.x,
    x.y,
    x.z,
    0,
    z.x,
    z.y,
    z.z,
    0,
    -y.x,
    -y.y,
    -y.z,
    0,
    0,
    0,
    0,
    1,
];
