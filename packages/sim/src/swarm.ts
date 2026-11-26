/**
 * @module
 * The satellite snapshot as a swarm of points: propagation in bulk, with no DOM.
 */

import { DAY } from "@cpluspatch/orbit";
import {
    type Catalogue,
    SATELLITE_GROUPS,
    type SatelliteGroup,
} from "./catalogue.ts";
import { type OrbitClass, orbitClass } from "./orbit-class.ts";
import { type Cloud, type CloudHost, prepareCloud } from "./propagate/cloud.ts";

/** How far from the snapshot's epoch the swarm is drawn, in seconds. Drag and decay make it drift. */
export const SNAPSHOT_WINDOW = 365 * DAY;

/** A catalogue with everything that doesn't change over time worked out. */
export type Swarm = Cloud & {
    /** Indices into `SATELLITE_GROUPS`. */
    groups: Uint8Array;
    classes: OrbitClass[];
    names: string[];
    /** The host's radius in metres, which altitudes are measured from. */
    radius: number;
};

/**
 * Prepares `catalogue` for `host`. Its radius and rotation set the orbit classes.
 * The elements are read relative to the host's equator at the catalogue's epoch.
 * Without gravity the satellites don't precess.
 */
export const prepareSwarm = (catalogue: Catalogue, host: CloudHost): Swarm => {
    const cloud = prepareCloud(catalogue, host);
    const classes: OrbitClass[] = [];

    for (let k = 0; k < cloud.count; k++) {
        classes.push(
            orbitClass(
                {
                    a: cloud.a[k] as number,
                    e: cloud.e[k] as number,
                    epoch: cloud.t0[k] as number,
                },
                host,
            ),
        );
    }

    return {
        ...cloud,
        groups: catalogue.groups,
        classes,
        names: catalogue.names,
        radius: host.radius,
    };
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
    swarm.positionsAt(t, Uint32Array.of(k), at);

    return {
        name: swarm.names[k] as string,
        group: SATELLITE_GROUPS[swarm.groups[k] as number] as SatelliteGroup,
        orbitClass: swarm.classes[k] as OrbitClass,
        altitudeKm: Math.hypot(...at) - swarm.radius / 1000,
        perigeeKm: (a * (1 - e) - swarm.radius) / 1000,
        apogeeKm: (a * (1 + e) - swarm.radius) / 1000,
        periodS: (2 * Math.PI) / (swarm.n[k] as number),
        inclination: swarm.i[k] as number,
    };
};
