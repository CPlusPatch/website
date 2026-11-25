import { OBLIQUITY_J2000 } from "./constants.ts";
import { elementsFromState } from "./elements.ts";
import type { Elements } from "./kepler.ts";
import { stateAt } from "./kepler.ts";
import type { Vec3 } from "./vec.ts";

/** Rotates a vector about +x by the J2000 obliquity, from equatorial to ecliptic axes. */
export const rotateEquatorialToEcliptic = (v: Vec3): Vec3 => {
    const c = Math.cos(OBLIQUITY_J2000);
    const s = Math.sin(OBLIQUITY_J2000);

    return { x: v.x, y: v.y * c + v.z * s, z: -v.y * s + v.z * c };
};

/** Rotates a vector about +x by the J2000 obliquity, from ecliptic to equatorial axes. */
export const rotateEclipticToEquatorial = (v: Vec3): Vec3 => {
    const c = Math.cos(OBLIQUITY_J2000);
    const s = Math.sin(OBLIQUITY_J2000);

    return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
};

/** Re-expresses equatorial elements in the ecliptic frame, at the same epoch. */
export const equatorialToEcliptic = (el: Elements, mu: number): Elements => {
    const { r, v } = stateAt(el, mu, el.epoch);
    const result = elementsFromState(
        rotateEquatorialToEcliptic(r),
        rotateEquatorialToEcliptic(v),
        mu,
        el.epoch,
    );

    if (!result.ok) {
        throw new Error(`Elliptic elements gave no orbit (${result.reason})`);
    }

    return result.elements;
};
