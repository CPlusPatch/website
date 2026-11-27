import type { Body } from "./scenario.ts";

/** The seconds since J2000 `from <= t < to` in which a body and all its ancestors exist. */
export type Interval = { from: number; to: number };

/** Each body's own lifetime cut down to its ancestors'. `bodies` can be in any order. */
export const effectiveLifetimes = (
    bodies: readonly Body[],
): Map<string, Interval> => {
    const byId = new Map(bodies.map((body) => [body.id, body]));
    const intervals = new Map<string, Interval>();

    const resolve = (body: Body): Interval => {
        const known = intervals.get(body.id);

        if (known) return known;

        const parent = body.orbit && byId.get(body.orbit.parent);
        const outer = parent
            ? resolve(parent)
            : { from: -Infinity, to: Infinity };
        const interval = {
            from: Math.max(outer.from, body.lifetime?.from ?? -Infinity),
            to: Math.min(outer.to, body.lifetime?.to ?? Infinity),
        };

        intervals.set(body.id, interval);

        return interval;
    };

    for (const body of bodies) resolve(body);

    return intervals;
};
