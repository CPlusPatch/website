import { add, type State, stateAt } from "@cpluspatch/orbit";
import { elementsAt } from "./precession.ts";
import type { Body, Scenario } from "./scenario.ts";
import { isOrbiting } from "./scenario.ts";

/** The state of every body relative to the root at time `t`, given `sortByDepth(scenario)`. */
export const worldStates = (
    _scenario: Scenario,
    order: Body[],
    t: number,
): Map<string, State> => {
    const byId = new Map(order.map((body) => [body.id, body]));
    const states = new Map<string, State>();

    for (const body of order) {
        if (!isOrbiting(body)) {
            states.set(body.id, {
                r: { x: 0, y: 0, z: 0 },
                v: { x: 0, y: 0, z: 0 },
            });

            continue;
        }

        const parent = byId.get(body.orbit.parent);
        const parentState = states.get(body.orbit.parent);

        if (!parent || !parentState) {
            throw new Error(
                `${body.id} comes before its parent ${body.orbit.parent} in the order`,
            );
        }

        const local = stateAt(
            elementsAt(body, t),
            parent.mass.mu + body.mass.mu,
            t,
        );

        states.set(body.id, {
            r: add(parentState.r, local.r),
            v: add(parentState.v, local.v),
        });
    }

    return states;
};
