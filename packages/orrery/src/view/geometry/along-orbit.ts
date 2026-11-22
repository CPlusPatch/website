/**
 * @module
 * Sampling along an orbit: the nearest sample, the near layout, the distance along a loop and the trail.
 */

import { wrapAngle } from "@cpluspatch/orbit";

/** The first of the `count` xyz points that is nearest to (x, y, z). */
export const nearestPoint = (
    points: ArrayLike<number>,
    count: number,
    x: number,
    y: number,
    z: number,
): number => {
    let best = 0;
    let bestSq = Infinity;
    for (let k = 0; k < count; k++) {
        const dx = (points[k * 3] ?? 0) - x;
        const dy = (points[k * 3 + 1] ?? 0) - y;
        const dz = (points[k * 3 + 2] ?? 0) - z;
        const sq = dx * dx + dy * dy + dz * dz;
        if (sq < bestSq) {
            bestSq = sq;
            best = k;
        }
    }

    return best;
};

/** An orbit closer to the camera than this fraction of its semi-major axis is drawn in the near layout. */
export const NEAR_FRACTION = 0.02;

/** Whether the camera, `distanceKm` from a body, is near enough to its orbit of semi-major axis `aKm`. */
export const orbitNear = (distanceKm: number, aKm: number): boolean =>
    distanceKm < NEAR_FRACTION * aKm;

/**
 * The `count + 1` eccentric anomalies of a near layout, from `center - π` to `center + π`.
 * The offsets from `center` grow geometrically from `first` to π, so samples crowd round the body.
 * `count` is even.
 */
export const nearAnomalies = (
    center: number,
    first: number,
    count: number,
): Float64Array => {
    const half = count / 2;
    const start = Math.min(first, Math.PI);
    const growth = half > 1 ? (Math.PI / start) ** (1 / (half - 1)) : 1;
    const out = new Float64Array(count + 1);

    out[half] = center;
    for (let k = 0; k < half; k++) {
        // The last offset is set outright so rounding can't leave a gap in the loop.
        const offset = k === half - 1 ? Math.PI : start * growth ** k;
        out[half + 1 + k] = center + offset;
        out[half - 1 - k] = center - offset;
    }

    return out;
};

/**
 * The distance along a loop at eccentric anomaly `anomaly`, from a table of its distance at each
 * of `cumulative.length - 1` anomalies spaced evenly from 0 to 2π, the last being the whole loop.
 * It keeps growing as the anomaly goes past 2π, so a pattern along the loop doesn't jump there.
 */
export const arcLengthAt = (
    cumulative: ArrayLike<number>,
    anomaly: number,
): number => {
    const count = cumulative.length - 1;
    const total = cumulative[count] ?? 0;
    const at = (wrapAngle(anomaly) / (2 * Math.PI)) * count;
    // Rounding can put `at` on `count` itself.
    const index = Math.min(Math.floor(at), count - 1);
    const from = cumulative[index] ?? 0;
    const to = cumulative[index + 1] ?? from;

    return (
        from +
        (to - from) * (at - index) +
        total * Math.floor(anomaly / (2 * Math.PI))
    );
};

/** The opacity of an orbit line `back` of `count` steps behind its body, which fades along the trail. */
export const trailAlpha = (
    back: number,
    count: number,
    picked: boolean,
): number => (picked ? 0.3 : 0.12) + (picked ? 0.7 : 0.45) * (1 - back / count);

/** How many samples behind the body a sample is, along the path it came by. */
export const trailBack = (
    sample: number,
    index: number,
    count: number,
    direction: number,
): number =>
    // Samples run with the motion, so the trail is behind the body's index.
    direction > 0
        ? (index - sample + count) % count
        : (sample - index + count) % count;
