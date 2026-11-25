import {
    add,
    cross,
    normalize,
    rotateEquatorialToEcliptic,
    scale,
    type Vec3,
} from "@cpluspatch/orbit";

/** The body-fixed axes in the ecliptic J2000 frame: `z` is the IAU north pole, `x` the prime meridian. */
export type Orientation = { x: Vec3; y: Vec3; z: Vec3 };

/** The body axes for an ICRF pole (`ra`, `dec`) and prime-meridian angle `w`, all in radians. */
export const orientationFromPole = (
    ra: number,
    dec: number,
    w: number,
): Orientation => {
    const pole = {
        x: Math.cos(dec) * Math.cos(ra),
        y: Math.cos(dec) * Math.sin(ra),
        z: Math.sin(dec),
    };
    // The ascending node of the body's equator on the ICRF equator, at RA ra + 90°.
    const node = normalize(cross({ x: 0, y: 0, z: 1 }, pole));
    const m = cross(pole, node);
    const x = add(scale(node, Math.cos(w)), scale(m, Math.sin(w)));
    const y = cross(pole, x);

    return {
        x: rotateEquatorialToEcliptic(x),
        y: rotateEquatorialToEcliptic(y),
        z: rotateEquatorialToEcliptic(pole),
    };
};
