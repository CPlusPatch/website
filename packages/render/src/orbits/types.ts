import type { Elements } from "@cpluspatch/orbit";
import type { OrbitingBody, Segment } from "@cpluspatch/sim";
import type { InterleavedBufferAttribute } from "three";
import type { Line2 } from "three/addons/lines/Line2.js";
import type { LineFade } from "./fade-material.ts";

export type Paint = {
    /** The loop point nearest the body, where the trail starts. */
    index: number;
    /** The way the clock runs: 1 forward, -1 backward, which flips the trail to the other side. */
    direction: -1 | 1;
    picked: boolean;
    /** A picked orbit's trail alpha: `GHOST_DIM` while a ghost shows, else 1. */
    dim: number;
};

export type Orbit = {
    body: OrbitingBody;
    /** The orbit's coloured line. */
    line: Line2;
    /** A wider dark line drawn under `line`, so it shows over bright backgrounds. */
    casing: Line2;
    /** The line's depth and size fade. */
    fade: LineFade;
    /** The loop's points, in km. */
    positions: Float32Array;
    /** The line's vertex colours, which are rewritten as the body moves. */
    colors: InterleavedBufferAttribute["data"];
    /** The line's segments, as start and end xyz triples. */
    segments: InterleavedBufferAttribute["data"];
    /** Whether the segments hold the near layout. */
    near: boolean;
    /** The segment the geometry was built from, or `null` if the next update must build it again. */
    segment: Segment | null;
    /** What the colours show now, or `null` if they're stale. */
    paint: Paint | null;
    /** The linear colour at each step back along the trail. */
    ramp: Float32Array;
};

export type Ghost = {
    body: OrbitingBody;
    line: Line2;
    elements: Elements;
    /** The loop's points, in km. */
    positions: Float32Array;
    /** The distance along the loop at each of its points, in km. */
    cumulative: Float64Array;
    /** The line's segments, as start and end xyz triples. */
    segments: InterleavedBufferAttribute["data"];
    /** The line's dash distances, as start and end pairs. */
    distances: InterleavedBufferAttribute["data"];
    /** Whether the segments hold the near layout. */
    near: boolean;
};
