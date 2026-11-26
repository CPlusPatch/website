import type { State } from "@cpluspatch/orbit";
import type { Precession } from "../precession.ts";
import type { Body, OrbitingBody } from "../scenario.ts";

/** A body's motion around its parent, ready to evaluate at any time. */
export type Track = {
    /** The state relative to the parent at `t` seconds since J2000, ecliptic J2000, SI. */
    stateAt(t: number): State;
};

/** A way to move an orbiting body around its parent. */
export type Propagator = {
    readonly name: string;
    /** Whether this propagator can move `body` around `parent`. */
    supports(body: OrbitingBody, parent: Body): boolean;
    /** The track of `body` around `parent`, with its resolved `precessions`. */
    prepare(
        body: OrbitingBody,
        parent: Body,
        precessions: readonly Precession[],
    ): Track;
};
