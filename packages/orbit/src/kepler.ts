import type { Vec3 } from "./vec.ts";

/** Keplerian elements of an orbit around a parent, in SI units and radians. */
export type Elements = {
    /** Semi-major axis in metres, above 0. */
    a: number;
    /** Eccentricity, from 0 up to but not including 1. */
    e: number;
    /** Inclination in radians, in [0, π]. */
    i: number;
    /** Longitude of the ascending node in radians, in [0, 2π). */
    raan: number;
    /** Argument of periapsis in radians, in [0, 2π). */
    argp: number;
    /** Mean anomaly at the epoch in radians, in [0, 2π). */
    m0: number;
    /** The epoch, in seconds since J2000. */
    epoch: number;
};

/** Position (m) and velocity (m/s) relative to the parent. */
export type State = { r: Vec3; v: Vec3 };

const TAU = 2 * Math.PI;

/** Wraps an angle into [0, 2π). */
export const wrapAngle = (x: number): number => {
    const wrapped = x - TAU * Math.floor(x / TAU);

    // A tiny negative input rounds up to exactly 2π.
    return wrapped >= TAU ? 0 : wrapped;
};

/** The mean motion in rad/s. */
export const meanMotion = (el: Elements, mu: number): number =>
    Math.sqrt(mu / el.a ** 3);

/** The orbital period in seconds. */
export const period = (el: Elements, mu: number): number =>
    TAU / meanMotion(el, mu);

/** The periapsis distance in metres. */
export const periapsis = (el: Elements): number => el.a * (1 - el.e);

/** The apoapsis distance in metres. */
export const apoapsis = (el: Elements): number => el.a * (1 + el.e);

/** The mean anomaly at time `t` (seconds since J2000), in [0, 2π). */
export const meanAnomalyAt = (el: Elements, mu: number, t: number): number =>
    wrapAngle(el.m0 + meanMotion(el, mu) * (t - el.epoch));

/** Solves Kepler's equation `M = E - e sin E` for the eccentric anomaly. */
export const solveKepler = (m: number, e: number): number => {
    let ea = e < 0.8 ? m : Math.PI;

    for (let n = 0; n < 50; n++) {
        const delta = (ea - e * Math.sin(ea) - m) / (1 - e * Math.cos(ea));
        ea -= delta;

        if (Math.abs(delta) < 1e-12) {
            break;
        }
    }

    return ea;
};

/** The true anomaly at time `t` (seconds since J2000), in [0, 2π). */
export const trueAnomalyAt = (el: Elements, mu: number, t: number): number => {
    const ea = solveKepler(meanAnomalyAt(el, mu, t), el.e);
    const half = ea / 2;

    return wrapAngle(
        2 *
            Math.atan2(
                Math.sqrt(1 + el.e) * Math.sin(half),
                Math.sqrt(1 - el.e) * Math.cos(half),
            ),
    );
};

/** The perifocal x and y axes in the parent frame. */
export const axes = (el: Elements): { p: Vec3; q: Vec3 } => {
    const cO = Math.cos(el.raan);
    const sO = Math.sin(el.raan);
    const cw = Math.cos(el.argp);
    const sw = Math.sin(el.argp);
    const ci = Math.cos(el.i);
    const si = Math.sin(el.i);

    return {
        p: { x: cO * cw - sO * sw * ci, y: sO * cw + cO * sw * ci, z: sw * si },
        q: {
            x: -cO * sw - sO * cw * ci,
            y: -sO * sw + cO * cw * ci,
            z: cw * si,
        },
    };
};

/** The position and velocity at time `t` (seconds since J2000). */
export const stateAt = (el: Elements, mu: number, t: number): State => {
    const n = meanMotion(el, mu);
    const ea = solveKepler(meanAnomalyAt(el, mu, t), el.e);
    const cosE = Math.cos(ea);
    const sinE = Math.sin(ea);
    const b = el.a * Math.sqrt(1 - el.e * el.e);
    const eDot = n / (1 - el.e * cosE);
    const { p, q } = axes(el);

    const x = el.a * (cosE - el.e);
    const y = b * sinE;
    const vx = -el.a * sinE * eDot;
    const vy = b * cosE * eDot;

    return {
        r: {
            x: x * p.x + y * q.x,
            y: x * p.y + y * q.y,
            z: x * p.z + y * q.z,
        },
        v: {
            x: vx * p.x + vy * q.x,
            y: vx * p.y + vy * q.y,
            z: vx * p.z + vy * q.z,
        },
    };
};

/** The positions at these eccentric anomalies, relative to the parent in metres, as xyz triples. */
export const orbitPointsAt = (
    el: Elements,
    anomalies: ArrayLike<number>,
): Float64Array => {
    const out = new Float64Array(anomalies.length * 3);
    const b = el.a * Math.sqrt(1 - el.e * el.e);
    const { p, q } = axes(el);

    for (let k = 0; k < anomalies.length; k++) {
        const ea = anomalies[k] ?? 0;
        const x = el.a * (Math.cos(ea) - el.e);
        const y = b * Math.sin(ea);

        out[k * 3] = x * p.x + y * q.x;
        out[k * 3 + 1] = x * p.y + y * q.y;
        out[k * 3 + 2] = x * p.z + y * q.z;
    }

    return out;
};

/** `count` positions around the orbit, uniform in eccentric anomaly, as xyz triples. */
export const orbitPoints = (el: Elements, count = 256): Float64Array =>
    orbitPointsAt(
        el,
        Array.from({ length: count }, (_, k) => (TAU * k) / count),
    );

/** The eccentric anomaly in (-π, π] of a point on the orbit, from its position relative to the parent. */
export const eccentricAnomalyOf = (el: Elements, r: Vec3): number => {
    const { p, q } = axes(el);
    const b = el.a * Math.sqrt(1 - el.e * el.e);
    const x = r.x * p.x + r.y * p.y + r.z * p.z;
    const y = r.x * q.x + r.y * q.y + r.z * q.z;

    return Math.atan2(y / b, x / el.a + el.e);
};
