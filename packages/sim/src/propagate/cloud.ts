/**
 * @module
 * Many small bodies around one host, propagated in bulk. Each particle is a Keplerian orbit read
 * relative to the host's equator at the catalogue epoch, precessing about the host's pole by J2.
 */

import {
    cross,
    length,
    normalize,
    solveKepler,
    unixMsToJ2000s,
    type Vec3,
    wrapAngle,
} from "@cpluspatch/orbit";
import type { Catalogue } from "../catalogue.ts";
import { bodyOrientation } from "../orientation.ts";
import { j2Precession } from "../precession.ts";
import type { Rotation } from "../rotation/index.ts";
import type { Gravity } from "../scenario.ts";

/** The body a cloud orbits. `mu` is in m³/s², `radius` in m. Without gravity the particles don't precess. */
export type CloudHost = {
    mu: number;
    radius: number;
    rotation?: Rotation | undefined;
    gravity?: Gravity | undefined;
};

/** A prepared cloud. The arrays hold one value per particle. */
export type Cloud = {
    readonly count: number;
    /** The catalogue's epoch in seconds since J2000. */
    readonly epoch: number;
    /** Semi-major axes in metres. */
    readonly a: Float64Array;
    readonly e: Float64Array;
    readonly i: Float64Array;
    /** Mean motion in rad/s. */
    readonly n: Float64Array;
    /** Each particle's own epoch in seconds since J2000. */
    readonly t0: Float64Array;
    /**
     * Writes the positions of the `shown` particles at `t` (seconds since J2000) into `out`, as
     * x, y, z in km from the host's centre in ecliptic J2000 axes. Slot `j` holds particle `shown[j]`.
     * Returns the number of particles written, which is less than `shown.length` if `out` is short.
     */
    positionsAt(
        t: number,
        shown: Uint32Array,
        out: Float32Array | Float64Array,
    ): number;
    /**
     * The orbit of particle `k` at `t`, for drawing its line. It has `samples` points evenly spaced
     * in eccentric anomaly, then the first again to close the loop: x, y, z in km, `(samples + 1) * 3` numbers.
     */
    orbitAt(k: number, t: number, samples: number): Float32Array;
};

const ECLIPTIC_X: Vec3 = { x: 1, y: 0, z: 0 };
const ECLIPTIC_Z: Vec3 = { x: 0, y: 0, z: 1 };

// A pole this close to the ecliptic's has no usable node.
const MIN_NODE = 1e-12;

/** The host's equatorial axes in ecliptic J2000: x on the ecliptic's ascending node on the host's equator (the vernal equinox for Earth), z on the pole. */
const equatorFrame = (
    rotation: Rotation | undefined,
    epoch: number,
): { x: Vec3; y: Vec3; z: Vec3 } => {
    const z = bodyOrientation(rotation, epoch)?.z ?? ECLIPTIC_Z;
    const node = cross(z, ECLIPTIC_Z);
    const x = length(node) < MIN_NODE ? ECLIPTIC_X : normalize(node);

    return { x, y: cross(z, x), z };
};

/** Prepares `catalogue` for `host`. The catalogue's elements are relative to the host's equator at its epoch. */
export const prepareCloud = (catalogue: Catalogue, host: CloudHost): Cloud => {
    const { mu, gravity } = host;
    const count = catalogue.groups.length;
    const epoch = unixMsToJ2000s(catalogue.epoch);
    const field = () => new Float64Array(count);
    const a = field();
    const e = field();
    const i = field();
    const raan = field();
    const argp = field();
    const m0 = field();
    const n = field();
    const nodeRate = field();
    const argpRate = field();
    const t0 = field();

    // In the host's frame its pole is +z.
    const pole = { x: 0, y: 0, z: 1 };

    for (let k = 0; k < count; k++) {
        // A short elements array gives NaN positions instead of throwing.
        const [
            dt = Number.NaN,
            motion = Number.NaN,
            ecc = Number.NaN,
            inc = Number.NaN,
            node = Number.NaN,
            peri = Number.NaN,
            anomaly = Number.NaN,
        ] = catalogue.elements.subarray(k * 7, k * 7 + 7);
        const elements = {
            a: (mu / motion ** 2) ** (1 / 3),
            e: ecc,
            i: inc,
            raan: node,
            argp: peri,
            m0: anomaly,
            epoch: epoch + dt,
        };
        const rates = gravity
            ? j2Precession(elements, mu, gravity.j2, gravity.radius, pole)
            : { nodeRate: 0, argpRate: 0 };

        a[k] = elements.a;
        e[k] = ecc;
        i[k] = inc;
        raan[k] = node;
        argp[k] = peri;
        m0[k] = anomaly;
        n[k] = motion;
        nodeRate[k] = rates.nodeRate;
        argpRate[k] = rates.argpRate;
        t0[k] = elements.epoch;
    }

    const frame = equatorFrame(host.rotation, epoch);

    /** Writes particle `k` at `t` given its eccentric anomaly `ea` into `out` at `o`, in km. */
    const place = (
        k: number,
        t: number,
        ea: number,
        out: Float32Array | Float64Array,
        o: number,
    ): void => {
        const ecc = e[k] as number;
        const axis = a[k] as number;
        const dt = t - (t0[k] as number);

        const x = axis * (Math.cos(ea) - ecc);
        const y = axis * Math.sqrt(1 - ecc * ecc) * Math.sin(ea);

        const argpNow = (argp[k] as number) + (argpRate[k] as number) * dt;
        const raanNow = (raan[k] as number) + (nodeRate[k] as number) * dt;
        const inc = i[k] as number;
        const u = x * Math.cos(argpNow) - y * Math.sin(argpNow);
        const v = x * Math.sin(argpNow) + y * Math.cos(argpNow);
        const vy = v * Math.cos(inc);
        const eqX = u * Math.cos(raanNow) - vy * Math.sin(raanNow);
        const eqY = u * Math.sin(raanNow) + vy * Math.cos(raanNow);
        const eqZ = v * Math.sin(inc);

        out[o] = (eqX * frame.x.x + eqY * frame.y.x + eqZ * frame.z.x) / 1000;
        out[o + 1] =
            (eqX * frame.x.y + eqY * frame.y.y + eqZ * frame.z.y) / 1000;
        out[o + 2] =
            (eqX * frame.x.z + eqY * frame.y.z + eqZ * frame.z.z) / 1000;
    };

    return {
        count,
        epoch,
        a,
        e,
        i,
        n,
        t0,
        positionsAt: (t, shown, out) => {
            const written = Math.min(shown.length, Math.floor(out.length / 3));

            for (let j = 0; j < written; j++) {
                const k = shown[j] as number;
                const m = wrapAngle(
                    (m0[k] as number) +
                        (n[k] as number) * (t - (t0[k] as number)),
                );

                place(k, t, solveKepler(m, e[k] as number), out, j * 3);
            }

            return written;
        },
        orbitAt: (k, t, samples) => {
            const out = new Float32Array((samples + 1) * 3);

            for (let s = 0; s < samples; s++) {
                place(k, t, (s / samples) * 2 * Math.PI, out, s * 3);
            }
            out.copyWithin(samples * 3, 0, 3);

            return out;
        },
    };
};
