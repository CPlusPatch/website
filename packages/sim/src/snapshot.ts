import type { Elements, State, Vec3 } from "@cpluspatch/orbit";
import type { Document } from "./document.ts";
import { effectiveLifetimes } from "./lifetime.ts";
import { bodyOrientation } from "./orientation.ts";
import { elementsAt } from "./precession.ts";
import { expandPresets, type Presets } from "./presets.ts";
import type { Track } from "./propagate/index.ts";
import type { Body } from "./scenario.ts";
import { isOrbiting, sortByDepth } from "./scenario.ts";
import { worldStates } from "./system.ts";
import {
    type Segment,
    segmentIn,
    segmentsByBody,
} from "./timeline/segments.ts";
import { piecewiseTrack } from "./timeline/track.ts";

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
};

/** A scenario compiled for repeated evaluation. */
export type System = {
    /** Body ids with every parent before its children. */
    readonly ids: readonly string[];
    /** The position of each body id in `ids`. */
    readonly index: ReadonlyMap<string, number>;
    /** Body `id` with its preset filled in. Throws for an unknown id. */
    body(id: string): Body;
    /** The state of every body at `t`. Only the last result is cached. */
    snapshot(t: number): Snapshot;
    /** The orbit of an orbiting body at `t`, with its perturbations applied. Throws for the root or an unknown id. */
    elementsAt(id: string, t: number): Elements;
    /** The stretch of orbit of an orbiting body that covers `t`. Throws for the root or an unknown id. */
    segmentAt(id: string, t: number): Segment;
    /** Whether body `id` and all its ancestors exist at `t`. Throws for an unknown id. */
    presentAt(id: string, t: number): boolean;
};

/** Compiles `doc` into a `System`, with `presets` filling what its bodies leave out. Throws if a burn of `doc` fails. */
export const compile = (doc: Document, presets: Presets): System => {
    const scenario = expandPresets(doc.scenario, presets);
    const order = sortByDepth(scenario);
    const ids = order.map((body) => body.id);
    const index = new Map(ids.map((id, i) => [id, i]));
    const byId = new Map(order.map((body) => [body.id, body]));

    const result = segmentsByBody(order, doc.timeline);

    if (!result.ok) throw new Error(result.errors.join("; "));

    const tracks = new Map<string, Track>();

    for (const [id, segments] of result.segments) {
        const body = byId.get(id);
        const parent = body && isOrbiting(body) && byId.get(body.orbit.parent);

        if (body && isOrbiting(body) && parent) {
            tracks.set(id, piecewiseTrack(body, parent, segments));
        }
    }

    const known = (id: string): Body => {
        const body = byId.get(id);

        if (!body) {
            throw new Error(`Unknown body ${id}`);
        }

        return body;
    };

    const lifetimes = effectiveLifetimes(order);

    let cached: Snapshot | null = null;

    const snapshot = (t: number): Snapshot => {
        if (cached && cached.t === t) {
            return cached;
        }

        const states = worldStates(scenario, order, t, tracks);
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

            const axes = bodyOrientation(body.rotation, t);

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

        cached = { t, r, v, orientation };

        return cached;
    };

    const segmentAt = (id: string, t: number): Segment => {
        const body = known(id);
        const segments = result.segments.get(id);

        if (!isOrbiting(body) || !segments) {
            throw new Error(`${id} is the root and has no orbit`);
        }

        return segmentIn(segments, t);
    };

    return {
        ids,
        index,
        body: known,
        snapshot,
        elementsAt: (id, t) => {
            const segment = segmentAt(id, t);

            return elementsAt(segment.elements, segment.precessions, t);
        },
        segmentAt,
        presentAt: (id, t) => {
            known(id);

            const life = lifetimes.get(id);

            return life !== undefined && life.from <= t && t < life.to;
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
