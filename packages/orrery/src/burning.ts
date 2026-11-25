import {
    apoapsis,
    applyBurn,
    type Burn,
    type Elements,
    type ElementsResult,
    periapsis,
    period,
} from "@cpluspatch/orbit";
import type { Scenario, System } from "@cpluspatch/sim";

/** The step choices of a burn's controls, in m/s. */
export const STEPS = [1, 10, 100] as const;

/** The predicted orbit of a burn, in metres and seconds. */
export type Prediction = {
    periapsisAltitude: number;
    apoapsisAltitude: number;
    period: number;
};

/** Whether a burn changes nothing. */
export const isZero = (dv: Burn): boolean =>
    dv.prograde === 0 && dv.normal === 0 && dv.radial === 0;

/** `value` moved by `delta`, with 0 for a value that isn't a number, rounded to drop float noise. */
export const nudge = (value: number, delta: number): number =>
    Math.round(((Number.isNaN(value) ? 0 : value) + delta) * 1e6) / 1e6;

/** The altitudes and period of `el` around a parent of `parentRadius` and `mu`. */
export const predict = (
    el: Elements,
    parentRadius: number,
    mu: number,
): Prediction => ({
    periapsisAltitude: periapsis(el) - parentRadius,
    apoapsisAltitude: apoapsis(el) - parentRadius,
    period: period(el, mu),
});

/** Whether two orbits are the same. */
export const sameElements = (a: Elements, b: Elements): boolean =>
    a.a === b.a &&
    a.e === b.e &&
    a.i === b.i &&
    a.raan === b.raan &&
    a.argp === b.argp &&
    a.m0 === b.m0 &&
    a.epoch === b.epoch;

/** Why a burn can't be made, for the reader. */
export const failureMessage = (
    reason: "escape" | "degenerate",
    parent: string,
    body: string,
): string =>
    reason === "escape"
        ? `This burn would escape ${parent}. Escape orbits aren't supported.`
        : `This burn would leave ${body} with no orbit plane.`;

/** The orbit body `id` would have after burning `dv` at `t`, or throws if it has none to burn on. */
export const previewBurn = (
    scenario: Scenario,
    system: System,
    id: string,
    t: number,
    dv: Burn,
): ElementsResult => {
    const body = scenario.bodies.find((candidate) => candidate.id === id);
    if (!body) throw new Error(`There is no body "${id}".`);
    if (body.parent === null)
        throw new Error(`"${id}" has no orbit to burn on.`);
    const parent = scenario.bodies.find(
        (candidate) => candidate.id === body.parent,
    );
    if (!parent) throw new Error(`There is no body "${body.parent}".`);

    return applyBurn(system.elementsAt(id, t), parent.mu + body.mu, t, dv);
};
