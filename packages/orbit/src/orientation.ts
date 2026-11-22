import { DAY } from "./constants.ts";
import { ROTATION_MODELS } from "./data/rotation.ts";
import { rotateEquatorialToEcliptic } from "./frames.ts";
import type { Vec3 } from "./vec.ts";
import { add, cross, normalize, scale } from "./vec.ts";

/** The body-fixed axes in the ecliptic J2000 frame: `z` is the IAU north pole, `x` the prime meridian. */
export type Orientation = { x: Vec3; y: Vec3; z: Vec3 };

/** The IAU pole and prime meridian of a body in degrees, at `d` days since J2000. */
export type RotationModel = (d: number) => {
    ra: number;
    dec: number;
    w: number;
};

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

/** The orientation of body `id` at `t` seconds since J2000, or null if it has no rotation model. */
export const bodyOrientation = (id: string, t: number): Orientation | null => {
    const model = Object.hasOwn(ROTATION_MODELS, id)
        ? ROTATION_MODELS[id]
        : undefined;

    if (!model) {
        return null;
    }

    // `t` is UTC-based but IAU models use TDB. The ~69 s offset turns Earth by ~0.3°, which is fine here.
    const { ra, dec, w } = model(t / DAY);
    const rad = Math.PI / 180;

    return orientationFromPole(ra * rad, dec * rad, w * rad);
};
