import { precessionsByBody } from "../perturb/index.ts";
import type { Precession } from "../precession.ts";
import type { Body, OrbitingBody } from "../scenario.ts";
import { isOrbiting } from "../scenario.ts";
import { analytic } from "./analytic.ts";
import type { Propagator, Track } from "./propagator.ts";

export type { Propagator, Track } from "./propagator.ts";

/** The propagators in order of preference. The first one that supports a body moves it. */
export const PROPAGATORS: readonly Propagator[] = [analytic];

/** The track of `body` around `parent` from the first of `propagators` that supports it. Throws if none does. */
export const prepareTrack = (
    body: OrbitingBody,
    parent: Body,
    precessions: readonly Precession[],
    propagators: readonly Propagator[] = PROPAGATORS,
): Track => {
    const propagator = propagators.find((p) => p.supports(body, parent));

    if (!propagator) {
        throw new Error(`No propagator supports ${body.id}`);
    }

    return propagator.prepare(body, parent, precessions);
};

/** The track of every orbiting body of `bodies` by id. The bodies have their presets filled in. */
export const tracksByBody = (
    bodies: readonly Body[],
    precessions: ReadonlyMap<string, readonly Precession[]> = precessionsByBody(
        bodies,
    ),
): Map<string, Track> => {
    const byId = new Map(bodies.map((body) => [body.id, body]));
    const tracks = new Map<string, Track>();

    for (const body of bodies) {
        const parent = isOrbiting(body)
            ? byId.get(body.orbit.parent)
            : undefined;

        if (isOrbiting(body) && parent) {
            tracks.set(
                body.id,
                prepareTrack(body, parent, precessions.get(body.id) ?? []),
            );
        }
    }

    return tracks;
};
