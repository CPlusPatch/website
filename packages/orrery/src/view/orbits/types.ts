import type { Body, Elements } from "@cpluspatch/orbit";
import type { InterleavedBufferAttribute } from "three";
import type { Line2 } from "three/addons/lines/Line2.js";
import type { LineFade } from "./fade-material.ts";

export type Paint = {
    index: number;
    direction: number;
    picked: boolean;
    dim: number;
};

export type Orbit = {
    body: Body;
    parent: string;
    line: Line2;
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
    /** What the colours show now, or `null` if they're stale. */
    paint: Paint | null;
    /** The linear colour at each step back along the trail. */
    ramp: Float32Array;
};

export type Ghost = {
    body: Body;
    parent: string;
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
