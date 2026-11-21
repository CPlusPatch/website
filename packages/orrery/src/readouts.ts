import type { Scenario, State } from "@cpluspatch/orbit";
import {
    apoapsis,
    length,
    periapsis,
    period,
    sub,
    trueAnomalyAt,
} from "@cpluspatch/orbit";

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
};

/** The readouts of body `id` at time `t`, or `null` for a body with no orbit. */
export const readouts = (
    scenario: Scenario,
    id: string,
    states: Map<string, State>,
    t: number,
): Readouts | null => {
    const body = scenario.bodies.find((candidate) => candidate.id === id);
    if (!body) throw new Error(`There is no body "${id}".`);
    if (body.parent === null || body.elements === null) return null;

    const parent = scenario.bodies.find(({ id }) => id === body.parent);
    const state = states.get(body.id);
    const parentState = states.get(body.parent);
    if (!parent || !state || !parentState) {
        throw new Error(`There is no state for "${id}" or its parent.`);
    }

    const mu = parent.mu + body.mu;

    return {
        distance: length(sub(state.r, parentState.r)),
        speed: length(sub(state.v, parentState.v)),
        period: period(body.elements, mu),
        periapsisAltitude: periapsis(body.elements) - parent.radius,
        apoapsisAltitude: apoapsis(body.elements) - parent.radius,
        trueAnomaly: trueAnomalyAt(body.elements, mu, t),
    };
};
