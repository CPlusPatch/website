import { applyBurn, type Elements } from "@cpluspatch/orbit";
import type { TimelineEvent } from "../document.ts";
import { precessionsOf } from "../perturb/index.ts";
import { elementsAt, type Precession } from "../precession.ts";
import type { Body, OrbitingBody } from "../scenario.ts";
import { isOrbiting } from "../scenario.ts";

/** One stretch of a body's orbit, covering `from <= t < to`. */
export type Segment = {
    /** Seconds since J2000. `-Infinity` for the first segment. */
    from: number;
    /** Seconds since J2000. `Infinity` for the last segment. */
    to: number;
    /** The orbit at its epoch, before `precessions` turn it. */
    elements: Elements;
    /** The perturbations resolved for `elements`, in order. */
    precessions: readonly Precession[];
};

export const BURN_FAILURES = {
    escape: "the burn would leave the parent's gravity",
    degenerate: "the burn would leave no orbit to describe",
};

/** The burn that can't be applied: which one, on which body, and why. */
export type BurnFailure = {
    bodyId: string;
    eventId: string;
    t: number;
    reason: keyof typeof BURN_FAILURES;
};

type BodySegments =
    | { ok: true; segments: Segment[] }
    | { ok: false; error: string; failure: BurnFailure };

/**
 * The result of `segmentsByBody`: the segments of every orbiting body, or one error and one
 * failure per body that can't be burnt.
 */
export type SegmentsResult =
    | { ok: true; segments: Map<string, Segment[]> }
    | { ok: false; errors: string[]; failures: BurnFailure[] };

const segmentOf = (
    body: OrbitingBody,
    parent: Body,
    from: number,
    elements: Elements,
): Segment => ({
    from,
    to: Number.POSITIVE_INFINITY,
    elements,
    // J2 rates depend on the elements, so each segment resolves its own.
    precessions: precessionsOf(
        { ...body, orbit: { ...body.orbit, elements } },
        parent,
    ),
});

/** `events` are all for `body`, in time order. `body` and `parent` have their presets filled in. */
const bodySegments = (
    body: OrbitingBody,
    parent: Body,
    events: readonly TimelineEvent[],
): BodySegments => {
    const segments = [segmentOf(body, parent, -Infinity, body.orbit.elements)];

    for (const event of events) {
        const previous = segments[segments.length - 1] as Segment;
        let elements: Elements;

        if (event.type === "set-orbit") {
            elements = event.elements;
        } else {
            const burned = applyBurn(
                elementsAt(previous.elements, previous.precessions, event.t),
                parent.mass.mu + body.mass.mu,
                event.t,
                event.dv,
            );

            if (!burned.ok) {
                return {
                    ok: false,
                    error: `timeline: can't burn "${body.id}" at t=${event.t}: ${BURN_FAILURES[burned.reason]}`,
                    failure: {
                        bodyId: body.id,
                        eventId: event.id,
                        t: event.t,
                        reason: burned.reason,
                    },
                };
            }

            elements = burned.elements;
        }

        previous.to = event.t;
        segments.push(segmentOf(body, parent, event.t, elements));
    }

    return { ok: true, segments };
};

/**
 * The segments of every orbiting body of `bodies` by id: its base orbit, then the result of each
 * of its events in time order. The bodies have their presets filled in. Events for other bodies
 * are ignored.
 */
export const segmentsByBody = (
    bodies: readonly Body[],
    timeline: readonly TimelineEvent[],
): SegmentsResult => {
    const byId = new Map(bodies.map((body) => [body.id, body]));
    // Sorting is stable, so events at the same time keep their timeline order.
    const sorted = [...timeline].sort((a, b) => a.t - b.t);
    const eventsByBody = new Map<string, TimelineEvent[]>();
    const segments = new Map<string, Segment[]>();
    const errors: string[] = [];
    const failures: BurnFailure[] = [];

    for (const event of sorted) {
        const list = eventsByBody.get(event.bodyId);

        if (list) list.push(event);
        else eventsByBody.set(event.bodyId, [event]);
    }

    for (const body of bodies) {
        const parent = isOrbiting(body)
            ? byId.get(body.orbit.parent)
            : undefined;

        if (!isOrbiting(body) || !parent) continue;

        const result = bodySegments(
            body,
            parent,
            eventsByBody.get(body.id) ?? [],
        );

        if (result.ok) segments.set(body.id, result.segments);
        else {
            errors.push(result.error);
            failures.push(result.failure);
        }
    }

    return errors.length > 0
        ? { ok: false, errors, failures }
        : { ok: true, segments };
};

/** The index in `segments` of the one that covers `t`. `segments` start at `-Infinity` and are in order. */
export const segmentIndex = (
    segments: readonly Segment[],
    t: number,
): number => {
    for (let i = segments.length - 1; i > 0; i--) {
        if ((segments[i] as Segment).from <= t) return i;
    }

    return 0;
};

/** The segment of `segments` that covers `t`. */
export const segmentIn = (segments: readonly Segment[], t: number): Segment =>
    segments[segmentIndex(segments, t)] as Segment;
