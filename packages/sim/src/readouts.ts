import {
    apoapsis,
    length,
    nextApsisTime,
    periapsis,
    period,
    type State,
    sub,
    trueAnomalyAt,
} from "@cpluspatch/orbit";
import type { Body } from "./scenario.ts";
import { isOrbiting } from "./scenario.ts";
import type { System } from "./snapshot.ts";

/** A body's orbit around its parent, in SI units and radians. */
export type Readouts = {
    /** The distance to the parent in metres. */
    distance: number;
    /** The speed relative to the parent in m/s. */
    speed: number;
    /** The orbital period in seconds. */
    period: number;
    /** The periapsis distance above the parent's surface in metres. */
    periapsisAltitude: number;
    /** The apoapsis distance above the parent's surface in metres. */
    apoapsisAltitude: number;
    /** The true anomaly in [0, 2π). */
    trueAnomaly: number;
    /** The time until the next periapsis in seconds. */
    timeToPeriapsis: number;
    /** The time until the next apoapsis in seconds. */
    timeToApoapsis: number;
};

/** The distance in metres from `body` to its parent, or `null` for the root. */
export const distanceOf = (
    states: Map<string, State>,
    body: Body,
): number | null => {
    if (!isOrbiting(body)) return null;

    const state = states.get(body.id);
    const parentState = states.get(body.orbit.parent);
    if (!state || !parentState) {
        throw new Error(`There is no state for "${body.id}" or its parent.`);
    }

    return length(sub(state.r, parentState.r));
};

/** The readouts of body `id` at time `t`, or `null` for a body with no orbit. */
export const readouts = (
    system: System,
    id: string,
    states: Map<string, State>,
    t: number,
): Readouts | null => {
    const body = system.body(id);
    if (!isOrbiting(body)) return null;

    const parent = system.body(body.orbit.parent);
    const state = states.get(body.id);
    const parentState = states.get(body.orbit.parent);
    if (!state || !parentState) {
        throw new Error(`There is no state for "${id}" or its parent.`);
    }

    const mu = parent.mass.mu + body.mass.mu;
    const { elements } = system.segmentAt(id, t);

    // Precession only turns `i`, `raan` and `argp`, and these read only `a`, `e`, `m0` and `epoch`.
    return {
        distance: length(sub(state.r, parentState.r)),
        speed: length(sub(state.v, parentState.v)),
        period: period(elements, mu),
        periapsisAltitude: periapsis(elements) - parent.mass.radius,
        apoapsisAltitude: apoapsis(elements) - parent.mass.radius,
        trueAnomaly: trueAnomalyAt(elements, mu, t),
        timeToPeriapsis: nextApsisTime(elements, mu, t, "periapsis") - t,
        timeToApoapsis: nextApsisTime(elements, mu, t, "apoapsis") - t,
    };
};
