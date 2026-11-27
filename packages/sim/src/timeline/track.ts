import { prepareTrack, type Track } from "../propagate/index.ts";
import type { Body, OrbitingBody } from "../scenario.ts";
import { type Segment, segmentIndex } from "./segments.ts";

/** The track of `body` around `parent` that follows each of its `segments` in turn. */
export const piecewiseTrack = (
    body: OrbitingBody,
    parent: Body,
    segments: readonly Segment[],
): Track => {
    const tracks = segments.map((segment) =>
        prepareTrack(
            { ...body, orbit: { ...body.orbit, elements: segment.elements } },
            parent,
            segment.precessions,
        ),
    );

    return {
        stateAt: (t) => (tracks[segmentIndex(segments, t)] as Track).stateAt(t),
    };
};
