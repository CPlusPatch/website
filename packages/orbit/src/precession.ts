import type { Elements } from "./kepler.ts";
import { axes, wrapAngle } from "./kepler.ts";
import type { Body } from "./scenario.ts";
import type { Vec3 } from "./vec.ts";
import { cross, dot, length, normalize, rotate } from "./vec.ts";

/** How an orbit turns over time, about a fixed pole. */
export type Precession = {
    /** Unit vector of the pole the node turns about, in ecliptic J2000. */
    pole: Vec3;
    /** The node's rate about the pole in rad/s. Negative is regression. */
    nodeRate: number;
    /** The rate of the argument of periapsis, from the node on the pole's plane, in rad/s. */
    argpRate: number;
};

/** The orbit `el` after it has precessed by `p` from its epoch to time `t`. */
export const precess = (el: Elements, p: Precession, t: number): Elements => {
    const dt = t - el.epoch;
    const { p: periapsis, q } = axes(el);
    const normal = cross(periapsis, q);

    const turned = rotate(periapsis, normal, p.argpRate * dt);
    const h = normalize(rotate(normal, p.pole, p.nodeRate * dt));
    const peri = rotate(turned, p.pole, p.nodeRate * dt);

    const i = Math.atan2(Math.hypot(h.x, h.y), h.z);

    // Same convention as `elementsFromState`: an equatorial orbit has its node on +x.
    const node = { x: -h.y, y: h.x, z: 0 };
    const equatorial = length(node) < 1e-9;
    const raan = equatorial ? 0 : Math.atan2(node.y, node.x);
    const n = equatorial ? { x: 1, y: 0, z: 0 } : normalize(node);
    const argp = Math.atan2(dot(peri, cross(h, n)), dot(peri, n));

    return { ...el, i, raan: wrapAngle(raan), argp: wrapAngle(argp) };
};

/** The orbit of `body` at time `t`: its elements, turned by its precession if it has one. */
export const elementsAt = (body: Body, t: number): Elements | null =>
    body.elements && body.precession
        ? precess(body.elements, body.precession, t)
        : body.elements;
