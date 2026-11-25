import { type Elements, orbitPoints } from "@cpluspatch/orbit";
import { InterleavedBufferAttribute } from "three";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import type { Orbit } from "./types.ts";

/** Few samples bow the chords of a big orbit off a spacecraft's path. */
export const SAMPLES = 2048;

export const LINE_PX = 1.1;
export const SELECTED_LINE_PX = 2.25;
export const GHOST_LINE_PX = 2;
const CASING_PX = 4;

/** The casing is the line plus a margin, so it grows with the line. */
export const casingPx = (linePx: number): number =>
    CASING_PX + (linePx - LINE_PX);

/** The closed loop of an orbit's points, in km. */
export const orbitPositions = (elements: Elements): Float32Array => {
    const points = orbitPoints(elements, SAMPLES);
    const positions = new Float32Array(points.length + 3);
    for (let k = 0; k < points.length; k++) {
        positions[k] = (points[k] ?? 0) / 1000;
    }
    // Repeat the first point to close the loop.
    positions.set(positions.subarray(0, 3), points.length);

    return positions;
};

/** Writes a vertex into the segment that ends there and the one that starts there. */
export const setVertex = (
    array: InterleavedBufferAttribute["data"]["array"],
    vertex: number,
    x: number,
    y: number,
    z: number,
): void => {
    if (vertex > 0) {
        array[6 * (vertex - 1) + 3] = x;
        array[6 * (vertex - 1) + 4] = y;
        array[6 * (vertex - 1) + 5] = z;
    }
    if (vertex < SAMPLES) {
        array[6 * vertex] = x;
        array[6 * vertex + 1] = y;
        array[6 * vertex + 2] = z;
    }
};

/** The line geometry of an orbit, in km, with room for vertex colours. */
export const orbitGeometry = (
    elements: Elements,
): Pick<Orbit, "positions" | "colors" | "segments"> & {
    geometry: LineGeometry;
} => {
    const positions = orbitPositions(elements);
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    geometry.setColors(new Float32Array(positions.length));

    const colors = geometry.getAttribute("instanceColorStart");
    const segments = geometry.getAttribute("instanceStart");
    if (
        !(colors instanceof InterleavedBufferAttribute) ||
        !(segments instanceof InterleavedBufferAttribute)
    ) {
        throw new Error("The orbit's attributes aren't interleaved.");
    }

    return {
        geometry,
        positions,
        colors: colors.data,
        segments: segments.data,
    };
};

/** The distance along a polyline of x, y, z triples at each of its vertices. */
export const arcLengths = (positions: Float32Array): Float64Array => {
    const out = new Float64Array(positions.length / 3);
    for (let k = 1; k < out.length; k++) {
        out[k] =
            (out[k - 1] ?? 0) +
            Math.hypot(
                (positions[3 * k] ?? 0) - (positions[3 * k - 3] ?? 0),
                (positions[3 * k + 1] ?? 0) - (positions[3 * k - 2] ?? 0),
                (positions[3 * k + 2] ?? 0) - (positions[3 * k - 1] ?? 0),
            );
    }

    return out;
};

/** Writes a vertex's distance along the line into the segment that ends there and the one that starts there. */
export const setDistance = (
    array: InterleavedBufferAttribute["data"]["array"],
    vertex: number,
    distance: number,
): void => {
    if (vertex > 0) array[2 * (vertex - 1) + 1] = distance;
    if (vertex < SAMPLES) array[2 * vertex] = distance;
};

/** The dashes and gaps along a ghost line, so an orbit has this many of each. */
export const GHOST_DASHES = 160;
