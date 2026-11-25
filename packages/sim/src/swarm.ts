/**
 * @module
 * The satellite snapshot as a swarm of points: propagation in bulk, with no DOM.
 */

import {
    DAY,
    EARTH_RADIUS,
    OBLIQUITY_J2000,
    solveKepler,
    unixMsToJ2000s,
    wrapAngle,
} from "@cpluspatch/orbit";
import {
    type Catalogue,
    SATELLITE_GROUPS,
    type SatelliteGroup,
} from "./catalogue.ts";
import { type OrbitClass, orbitClass } from "./orbit-class.ts";
import { j2Precession } from "./precession.ts";
import type { Gravity } from "./scenario.ts";

/** How far from the snapshot's epoch the swarm is drawn, in seconds. Drag and decay make it drift. */
export const SNAPSHOT_WINDOW = 365 * DAY;

const COS_OBLIQUITY = Math.cos(OBLIQUITY_J2000);
const SIN_OBLIQUITY = Math.sin(OBLIQUITY_J2000);

/** The pole J2 precesses about: the catalogue's frame has Earth's pole on +z. */
const POLE = { x: 0, y: 0, z: 1 };

/** A catalogue with everything that doesn't change over time worked out. */
export type Swarm = {
    count: number;
    /** The snapshot's epoch in seconds since J2000. */
    epoch: number;
    /** Indices into `SATELLITE_GROUPS`. */
    groups: Uint8Array;
    classes: OrbitClass[];
    names: string[];
    /** Semi-major axes in metres. */
    a: Float64Array;
    e: Float64Array;
    i: Float64Array;
    raan: Float64Array;
    argp: Float64Array;
    /** Mean anomaly at `t0`. */
    m0: Float64Array;
    /** Mean motion in rad/s. */
    n: Float64Array;
    /** J2 secular rates of the node and periapsis in rad/s. */
    nodeRate: Float64Array;
    argpRate: Float64Array;
    /** Each satellite's own epoch in seconds since J2000. */
    t0: Float64Array;
};

/**
 * Prepares `catalogue` for a host with gravitational parameter `host.mu` (m³/s²) and `host.gravity`.
 * Without gravity the satellites don't precess.
 * The elements are TEME, which is taken as J2000 equatorial. That's about 0.4° off.
 */
export const prepareSwarm = (
    catalogue: Catalogue,
    host: { mu: number; gravity?: Gravity | undefined },
): Swarm => {
    const { mu: earthMu, gravity } = host;
    const count = catalogue.groups.length;
    const epoch = unixMsToJ2000s(catalogue.epoch);
    const field = () => new Float64Array(count);
    const swarm: Swarm = {
        count,
        epoch,
        groups: catalogue.groups,
        classes: [],
        names: catalogue.names,
        a: field(),
        e: field(),
        i: field(),
        raan: field(),
        argp: field(),
        m0: field(),
        n: field(),
        nodeRate: field(),
        argpRate: field(),
        t0: field(),
    };

    for (let k = 0; k < count; k++) {
        // NaN is what reading past the end used to give.
        const [
            dt = Number.NaN,
            n = Number.NaN,
            e = Number.NaN,
            i = Number.NaN,
            raan = Number.NaN,
            argp = Number.NaN,
            m0 = Number.NaN,
        ] = catalogue.elements.subarray(k * 7, k * 7 + 7);
        const elements = {
            a: (earthMu / n ** 2) ** (1 / 3),
            e,
            i,
            raan,
            argp,
            m0,
            epoch: epoch + dt,
        };
        const { nodeRate, argpRate } = gravity
            ? j2Precession(elements, earthMu, gravity.j2, gravity.radius, POLE)
            : { nodeRate: 0, argpRate: 0 };

        swarm.classes.push(orbitClass(elements));
        swarm.a[k] = elements.a;
        swarm.e[k] = e;
        swarm.i[k] = i;
        swarm.raan[k] = raan;
        swarm.argp[k] = argp;
        swarm.m0[k] = m0;
        swarm.n[k] = n;
        swarm.nodeRate[k] = nodeRate;
        swarm.argpRate[k] = argpRate;
        swarm.t0[k] = elements.epoch;
    }

    return swarm;
};

/**
 * The seconds by which `t` lies outside the window around `epoch` (both since J2000).
 * Positive after it, negative before it, 0 inside.
 */
export const snapshotGap = (t: number, epoch: number): number => {
    const offset = t - epoch;
    if (offset > SNAPSHOT_WINDOW) return offset - SNAPSHOT_WINDOW;
    if (offset < -SNAPSHOT_WINDOW) return offset + SNAPSHOT_WINDOW;

    return 0;
};

/** Whether `t` (seconds since J2000) is close enough to the snapshot's epoch to draw it. */
export const inSnapshotWindow = (swarm: Swarm, t: number): boolean =>
    snapshotGap(t, swarm.epoch) === 0;

/** The indices of the satellites in `groups`, in catalogue order. */
export const selectShown = (
    swarm: Swarm,
    groups: ReadonlySet<SatelliteGroup>,
): Uint32Array => {
    const on = SATELLITE_GROUPS.map((group) => groups.has(group));
    const shown = new Uint32Array(swarm.count);
    let count = 0;
    for (let k = 0; k < swarm.count; k++) {
        if (on[swarm.groups[k] ?? 0]) shown[count++] = k;
    }

    return shown.slice(0, count);
};

/**
 * Writes satellite `k` at time `t` (seconds since J2000) into `out` at `o`, given its eccentric
 * anomaly `ea`. The output is x, y, z in km from Earth's centre in ecliptic axes.
 */
const place = (
    swarm: Swarm,
    k: number,
    t: number,
    ea: number,
    out: Float32Array,
    o: number,
): void => {
    const e = swarm.e[k] as number;
    const a = swarm.a[k] as number;
    const dt = t - (swarm.t0[k] as number);

    const x = a * (Math.cos(ea) - e);
    const y = a * Math.sqrt(1 - e * e) * Math.sin(ea);

    const argp = (swarm.argp[k] as number) + (swarm.argpRate[k] as number) * dt;
    const raan = (swarm.raan[k] as number) + (swarm.nodeRate[k] as number) * dt;
    const i = swarm.i[k] as number;
    const u = x * Math.cos(argp) - y * Math.sin(argp);
    const v = x * Math.sin(argp) + y * Math.cos(argp);
    const vy = v * Math.cos(i);
    const eqX = u * Math.cos(raan) - vy * Math.sin(raan);
    const eqY = u * Math.sin(raan) + vy * Math.cos(raan);
    const eqZ = v * Math.sin(i);

    out[o] = eqX / 1000;
    out[o + 1] = (eqY * COS_OBLIQUITY + eqZ * SIN_OBLIQUITY) / 1000;
    out[o + 2] = (-eqY * SIN_OBLIQUITY + eqZ * COS_OBLIQUITY) / 1000;
};

/**
 * Writes the positions of the `shown` satellites at `t` (seconds since J2000) into `out`, as
 * x, y, z in km from Earth's centre in ecliptic axes. Slot `j` holds satellite `shown[j]`.
 * Returns the number of satellites written, which is less than `shown.length` if `out` is short.
 */
export const writePositions = (
    swarm: Swarm,
    shown: Uint32Array,
    t: number,
    out: Float32Array,
): number => {
    const count = Math.min(shown.length, Math.floor(out.length / 3));

    for (let j = 0; j < count; j++) {
        const k = shown[j] as number;
        const m = wrapAngle(
            (swarm.m0[k] as number) +
                (swarm.n[k] as number) * (t - (swarm.t0[k] as number)),
        );

        place(swarm, k, t, solveKepler(m, swarm.e[k] as number), out, j * 3);
    }

    return count;
};

/**
 * The orbit of satellite `k` at `t` (seconds since J2000), for drawing the selected satellite's
 * line. It has `samples` points evenly spaced in eccentric anomaly, then the first again to close
 * the loop: x, y, z in km from Earth's centre in ecliptic axes, `(samples + 1) * 3` numbers.
 */
export const satelliteOrbit = (
    swarm: Swarm,
    k: number,
    t: number,
    samples: number,
): Float32Array => {
    const out = new Float32Array((samples + 1) * 3);

    for (let s = 0; s < samples; s++) {
        place(swarm, k, t, (s / samples) * 2 * Math.PI, out, s * 3);
    }
    out.copyWithin(samples * 3, 0, 3);

    return out;
};

/** What the info panel says about a satellite. Altitudes are in km, the period in s. */
export type SatelliteFacts = {
    name: string;
    group: SatelliteGroup;
    orbitClass: OrbitClass;
    /** Height above the equatorial radius at the time asked. */
    altitudeKm: number;
    perigeeKm: number;
    apogeeKm: number;
    periodS: number;
    /** In radians, to the equator. */
    inclination: number;
};

/** The name, group, class, heights, period and inclination of satellite `k` at `t`. */
export const satelliteFacts = (
    swarm: Swarm,
    k: number,
    t: number,
): SatelliteFacts => {
    const a = swarm.a[k] as number;
    const e = swarm.e[k] as number;
    const at = new Float32Array(3);
    writePositions(swarm, Uint32Array.of(k), t, at);

    return {
        name: swarm.names[k] as string,
        group: SATELLITE_GROUPS[swarm.groups[k] as number] as SatelliteGroup,
        orbitClass: swarm.classes[k] as OrbitClass,
        altitudeKm: Math.hypot(...at) - EARTH_RADIUS / 1000,
        perigeeKm: (a * (1 - e) - EARTH_RADIUS) / 1000,
        apogeeKm: (a * (1 + e) - EARTH_RADIUS) / 1000,
        periodS: (2 * Math.PI) / (swarm.n[k] as number),
        inclination: swarm.i[k] as number,
    };
};
