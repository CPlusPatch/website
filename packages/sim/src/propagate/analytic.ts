import { stateAt } from "@cpluspatch/orbit";
import { elementsAt } from "../precession.ts";
import type { Propagator } from "./propagator.ts";

/** Kepler's equation on the body's orbit elements, with its precessions applied. */
export const analytic: Propagator = {
    name: "analytic",
    supports: () => true,
    prepare: (body, parent, precessions) => {
        const mu = parent.mass.mu + body.mass.mu;

        return {
            stateAt: (t) =>
                stateAt(elementsAt(body.orbit.elements, precessions, t), mu, t),
        };
    },
};
