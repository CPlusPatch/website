import { DAY, deg } from "./constants.ts";
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

/** The rotation model of body `id`, or undefined if it has none. */
const modelOf = (id: string): RotationModel | undefined =>
    Object.hasOwn(ROTATION_MODELS, id) ? ROTATION_MODELS[id] : undefined;

/** The orientation of body `id` at `t` seconds since J2000, or null if it has no rotation model. */
export const bodyOrientation = (id: string, t: number): Orientation | null => {
    const model = modelOf(id);

    if (!model) {
        return null;
    }

    // `t` is UTC-based but IAU models use TDB. The ~69 s offset turns Earth by ~0.3°, which is fine here.
    const { ra, dec, w } = model(t / DAY);

    return orientationFromPole(deg(ra), deg(dec), deg(w));
};

/** The rate of the prime-meridian angle of `model` in °/day at `t`, signed. */
const spinRate = (model: RotationModel, t: number): number => {
    const d = t / DAY;

    // A span of one day averages out the periodic terms of the moon models.
    return model(d + 0.5).w - model(d - 0.5).w;
};

/** The sidereal rotation period of body `id` in seconds at `t`, or null if it has no model or doesn't spin. */
export const rotationPeriod = (id: string, t: number): number | null => {
    const model = modelOf(id);
    if (!model) {
        return null;
    }

    const rate = Math.abs(spinRate(model, t));

    return rate === 0 ? null : (360 / rate) * DAY;
};

/** The unit spin axis (angular momentum direction) of body `id` in the ecliptic J2000 frame, or null. */
export const spinAxis = (id: string, t: number): Vec3 | null => {
    const model = modelOf(id);
    const orientation = bodyOrientation(id, t);
    if (!model || !orientation) {
        return null;
    }

    // A retrograde body's IAU north pole is on the orbit-normal side of its equator.
    return spinRate(model, t) < 0 ? scale(orientation.z, -1) : orientation.z;
};
