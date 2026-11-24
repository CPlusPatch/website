import type { Elements } from "./kepler.ts";
import { meanAnomalyAt, meanMotion, wrapAngle } from "./kepler.ts";
import type { Vec3 } from "./vec.ts";
import { cross, dot, length, normalize, scale, sub } from "./vec.ts";

/** The elements of a state, or why there are none. */
export type ElementsResult =
    | { ok: true; elements: Elements }
    | { ok: false; reason: "escape" | "degenerate" };

/** Converts a state at time `t` to elements with that epoch. */
export const elementsFromState = (
    r: Vec3,
    v: Vec3,
    mu: number,
    t: number,
): ElementsResult => {
    const rLen = length(r);
    const v2 = dot(v, v);
    const h = cross(r, v);
    const hLen = length(h);

    // A radial orbit has no plane; `<=` also catches r = 0 or v = 0.
    if (hLen <= 1e-12 * rLen * Math.sqrt(v2)) {
        return { ok: false, reason: "degenerate" };
    }

    const eVec = scale(
        sub(scale(r, v2 - mu / rLen), scale(v, dot(r, v))),
        1 / mu,
    );
    const e = length(eVec);
    const energy = v2 / 2 - mu / rLen;

    // Written as a negation so that a NaN `mu` is rejected too.
    if (!(energy < 0 && e < 1 - 1e-9)) {
        return { ok: false, reason: "escape" };
    }

    const a = -mu / (2 * energy);
    const i = Math.atan2(Math.hypot(h.x, h.y), h.z);

    // The node vector is zero on an equatorial orbit, so the node is taken as +x.
    const node = { x: -h.y, y: h.x, z: 0 };
    const equatorial = length(node) / hLen < 1e-9;
    const circular = e < 1e-9;

    const raan = equatorial ? 0 : Math.atan2(node.y, node.x);
    const p = equatorial ? { x: 1, y: 0, z: 0 } : normalize(node);
    const q = cross(normalize(h), p);
    const argp = circular ? 0 : Math.atan2(dot(eVec, q), dot(eVec, p));

    const u = Math.atan2(dot(r, q), dot(r, p));
    const nu = u - argp;
    const ea = Math.atan2(
        Math.sqrt(1 - e * e) * Math.sin(nu),
        e + Math.cos(nu),
    );
    const m = ea - e * Math.sin(ea);

    return {
        ok: true,
        elements: {
            a,
            e,
            i,
            raan: wrapAngle(raan),
            argp: wrapAngle(argp),
            m0: wrapAngle(m),
            epoch: t,
        },
    };
};

/** The same orbit with its epoch moved to `t`. */
export const reepoch = (el: Elements, mu: number, t: number): Elements => ({
    ...el,
    m0: meanAnomalyAt(el, mu, t),
    epoch: t,
});

/** The next time after `t` the orbit reaches periapsis or apoapsis. */
export const nextApsisTime = (
    el: Elements,
    mu: number,
    t: number,
    apsis: "periapsis" | "apoapsis",
): number => {
    const target = apsis === "periapsis" ? 0 : Math.PI;
    const delta = wrapAngle(target - meanAnomalyAt(el, mu, t));

    return t + (delta === 0 ? 2 * Math.PI : delta) / meanMotion(el, mu);
};
