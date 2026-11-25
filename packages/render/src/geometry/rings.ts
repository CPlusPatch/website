/**
 * @module
 * The maths of a ring strip, without any three.js in it.
 */

/** The strip's inner and outer edge in body radii, for edges and a radius in m. */
export const ringSpan = (
    inner: number,
    outer: number,
    radius: number,
): { inner: number; outer: number } => ({
    inner: inner / radius,
    outer: outer / radius,
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
