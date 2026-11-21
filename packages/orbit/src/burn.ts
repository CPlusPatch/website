import type { ElementsResult } from "./elements.ts";
import { elementsFromState } from "./elements.ts";
import type { Elements } from "./kepler.ts";
import { stateAt } from "./kepler.ts";
import { add, cross, normalize, scale } from "./vec.ts";

/** A burn in m/s along the velocity, the orbit normal and the radial direction. */
export type Burn = { prograde: number; normal: number; radial: number };

/** Applies an instant burn at time `t` and returns the new orbit, with epoch `t`. */
export const applyBurn = (
    el: Elements,
    mu: number,
    t: number,
    dv: Burn,
): ElementsResult => {
    const { r, v } = stateAt(el, mu, t);
    const prograde = normalize(v);
    const normal = normalize(cross(r, v));
    // KSP convention: this is the true radial direction only on a circular orbit.
    const radial = cross(prograde, normal);

    const v2 = add(
        v,
        add(
            scale(prograde, dv.prograde),
            add(scale(normal, dv.normal), scale(radial, dv.radial)),
        ),
    );

    return elementsFromState(r, v2, mu, t);
};
