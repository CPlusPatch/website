/** A 3D vector. */
export type Vec3 = { x: number; y: number; z: number };

/** The sum of two vectors. */
export const add = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
});

/** The difference `a - b`. */
export const sub = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
});

/** A vector multiplied by a scalar. */
export const scale = (a: Vec3, k: number): Vec3 => ({
    x: a.x * k,
    y: a.y * k,
    z: a.z * k,
});

/** The dot product. */
export const dot = (a: Vec3, b: Vec3): number =>
    a.x * b.x + a.y * b.y + a.z * b.z;

/** The cross product `a × b`. */
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
});

/** The Euclidean length. */
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

/** The vector scaled to unit length. */
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / length(a));

/** The vector `v` turned by `angle` radians about the unit vector `axis` (Rodrigues). */
export const rotate = (v: Vec3, axis: Vec3, angle: number): Vec3 => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return add(
        add(scale(v, c), scale(cross(axis, v), s)),
        scale(axis, dot(axis, v) * (1 - c)),
    );
};
