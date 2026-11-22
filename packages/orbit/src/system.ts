import type { State } from "./kepler.ts";
import { stateAt } from "./kepler.ts";
import { elementsAt } from "./precession.ts";
import type { Body, Scenario } from "./scenario.ts";
import { add } from "./vec.ts";

/** The state of every body relative to the root at time `t`, given `sortByDepth(scenario)`. */
export const worldStates = (
    _scenario: Scenario,
    order: Body[],
    t: number,
): Map<string, State> => {
    const byId = new Map(order.map((body) => [body.id, body]));
    const states = new Map<string, State>();

    for (const body of order) {
        const elements = elementsAt(body, t);

        if (body.parent === null || elements === null) {
            states.set(body.id, {
                r: { x: 0, y: 0, z: 0 },
                v: { x: 0, y: 0, z: 0 },
            });

            continue;
        }

        const parent = byId.get(body.parent);
        const parentState = states.get(body.parent);

        if (!parent || !parentState) {
            throw new Error(
                `${body.id} comes before its parent ${body.parent} in the order`,
            );
        }

        const local = stateAt(elements, parent.mu + body.mu, t);

        states.set(body.id, {
            r: add(parentState.r, local.r),
            v: add(parentState.v, local.v),
        });
    }

    return states;
};
