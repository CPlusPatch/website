/**
 * @module
 * The maths of Saturn's ring strip, without any three.js in it.
 */

/** Where the strip in `saturn-ring.webp` starts and ends, in km from Saturn's centre. */
export const RING_INNER_KM = 74_500;
export const RING_OUTER_KM = 140_220;

/** The strip's inner and outer edge in Saturn radii, for a radius in m. */
export const ringSpan = (radius: number): { inner: number; outer: number } => ({
    inner: (RING_INNER_KM * 1000) / radius,
    outer: (RING_OUTER_KM * 1000) / radius,
});

/** Where a radius falls along the strip: 0 at the inner edge, 1 at the outer. */
export const ringU = (r: number, inner: number, outer: number): number =>
    (r - inner) / (outer - inner);

/** The UVs of flat ring vertices (x, y, z triples around z): u along the strip, v in its middle. */
export const ringUvs = (
    positions: ArrayLike<number>,
    inner: number,
    outer: number,
): Float32Array => {
    const uvs = new Float32Array((positions.length / 3) * 2);
    for (let i = 0; i < positions.length / 3; i++) {
        const r = Math.hypot(positions[i * 3] ?? 0, positions[i * 3 + 1] ?? 0);
        uvs[i * 2] = ringU(r, inner, outer);
        uvs[i * 2 + 1] = 0.5;
    }

    return uvs;
};
