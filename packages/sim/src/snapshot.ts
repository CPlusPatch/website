import type { Elements, State, Vec3 } from "@cpluspatch/orbit";
import type { Document } from "./document.ts";
import { bodyOrientation } from "./orientation.ts";
import { elementsAt } from "./precession.ts";
import { isOrbiting, sortByDepth } from "./scenario.ts";
import { worldStates } from "./system.ts";

/** Every body at one time, packed into flat arrays indexed by `System.index`. */
export type Snapshot = {
    /** Seconds since J2000. */
    t: number;
    /** Positions relative to the root in metres, ecliptic J2000. 3 values (x, y, z) per body. */
    r: Float64Array;
    /** Velocities relative to the root in m/s. 3 values per body. */
    v: Float64Array;
    /** Body axes as the x, y and z axis in turn, 9 values per body. NaN if the body has no rotation. */
    orientation: Float64Array;
    /** Cloud id to 3 values per particle, relative to the host body. */
    clouds: ReadonlyMap<string, Float64Array>;
};

/** A scenario compiled for repeated evaluation. */
export type System = {
    /** Body ids with every parent before its children. */
    readonly ids: readonly string[];
    /** The position of each body id in `ids`. */
    readonly index: ReadonlyMap<string, number>;
    /** The state of every body at `t`. Only the last result is cached. */
    snapshot(t: number): Snapshot;
    /** The orbit of an orbiting body at `t`, with its perturbations applied. Throws for the root or an unknown id. */
    elementsAt(id: string, t: number): Elements;
};

/** Compiles the scenario of `doc` into a `System`. */
export const compile = (doc: Document): System => {
    const { scenario } = doc;
    const order = sortByDepth(scenario);
    const ids = order.map((body) => body.id);
    const index = new Map(ids.map((id, i) => [id, i]));
    const byId = new Map(order.map((body) => [body.id, body]));

    let cached: Snapshot | null = null;

    const snapshot = (t: number): Snapshot => {
        if (cached && cached.t === t) {
            return cached;
        }

        const states = worldStates(scenario, order, t);
        const r = new Float64Array(3 * order.length);
        const v = new Float64Array(3 * order.length);
        const orientation = new Float64Array(9 * order.length);

        for (const [i, body] of order.entries()) {
            const state = states.get(body.id);

            if (!state) {
                throw new Error(`No state for ${body.id}`);
            }

            r.set([state.r.x, state.r.y, state.r.z], 3 * i);
            v.set([state.v.x, state.v.y, state.v.z], 3 * i);

            const axes = bodyOrientation(body.model, t);

            if (axes) {
                orientation.set(
                    [axes.x, axes.y, axes.z].flatMap((axis) => [
                        axis.x,
                        axis.y,
                        axis.z,
                    ]),
                    9 * i,
                );
            } else {
                orientation.fill(Number.NaN, 9 * i, 9 * i + 9);
            }
        }

        // Clouds arrive in a later step.
        cached = { t, r, v, orientation, clouds: new Map() };

        return cached;
    };

    return {
        ids,
        index,
        snapshot,
        elementsAt: (id, t) => {
            const body = byId.get(id);

            if (!body) {
                throw new Error(`Unknown body ${id}`);
            }

            if (!isOrbiting(body)) {
                throw new Error(`${id} is the root and has no orbit`);
            }

            return elementsAt(body, t);
        },
    };
};

/** The state of every body of `system` at `t`, by id. */
export const statesAt = (system: System, t: number): Map<string, State> => {
    const { r, v } = system.snapshot(t);
    const states = new Map<string, State>();

    const at = (data: Float64Array, i: number): Vec3 => {
        const [x = 0, y = 0, z = 0] = data.subarray(3 * i, 3 * i + 3);

        return { x, y, z };
    };

    for (const [id, i] of system.index) {
        states.set(id, { r: at(r, i), v: at(v, i) });
    }

    return states;
};
