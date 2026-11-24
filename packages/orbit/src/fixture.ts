import { assert } from "@std/assert";
import type { Elements } from "./kepler.ts";
import type { Vec3 } from "./vec.ts";
import { length, sub } from "./vec.ts";

/** The Sun's gravitational parameter in m³/s². */
export const MU = 1.32712440018e20;

/** A seeded generator of numbers in [0, 1). */
export const mulberry32 = (seed: number): (() => number) => {
    let s = seed;

    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Random elliptic elements with epoch 0. */
export const randomElements = (rand: () => number): Elements => ({
    a: 7e6 + rand() * (5e12 - 7e6),
    e: rand() * 0.95,
    i: rand() * Math.PI,
    raan: rand() * 2 * Math.PI,
    argp: rand() * 2 * Math.PI,
    m0: rand() * 2 * Math.PI,
    epoch: 0,
});

/** Asserts that two vectors differ by at most `tol` times the length of `expected`. */
export const assertVecClose = (
    actual: Vec3,
    expected: Vec3,
    tol = 1e-9,
): void => {
    const error = length(sub(actual, expected));

    assert(
        error <= tol * length(expected),
        `vectors differ by ${error} (relative ${error / length(expected)})`,
    );
};

/** The `k`th point of a packed xyz array, such as the output of `orbitPoints`. */
export const pointAt = (points: Float64Array, k: number): Vec3 => {
    const [x, y, z] = points.subarray(3 * k, 3 * k + 3);

    if (x === undefined || y === undefined || z === undefined) {
        throw new Error(`no point ${k} in an array of ${points.length / 3}`);
    }

    return { x, y, z };
};
