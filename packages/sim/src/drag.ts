import { AU, type Elements } from "@cpluspatch/orbit";

/** The longest semi-major axis the editor allows, in metres. */
export const A_MAX = 100 * AU;

/** The radians of tilt per px the Inc grip is dragged, a quarter degree. */
const TILT_PER_PX = Math.PI / 720;

/**
 * The inclination after the Inc grip is dragged `dy` px down the screen from `i0`. Up tilts more.
 * It goes by a fixed rate, since the orbit tilting about its nodes moves toward the camera in most
 * views, where following the pointer jerks.
 */
export const tiltInclination = (i0: number, dy: number): number =>
    Math.min(Math.max(i0 - dy * TILT_PER_PX, 0), Math.PI);

/** The farthest apsis is at most this many times the nearest, which keeps `e` to 0.99. */
const APSIS_RATIO = 199;

/**
 * The semi-major axis and eccentricity after dragging an apsis of `el0` by `delta` metres.
 * The other apsis stays put. Dragging past it swaps them: `swapped` is then true, and the axis
 * points the other way round, so the periapsis is at its other end.
 */
export const dragApsis = (
    kind: "pe" | "ap",
    el0: Elements,
    delta: number,
    minPeriapsis: number,
): { a: number; e: number; swapped: boolean } => {
    const pe0 = el0.a * (1 - el0.e);
    const ap0 = el0.a * (1 + el0.e);
    // The dragged apsis is `d` from the parent. The axis points to the periapsis, so moving the
    // apoapsis towards the periapsis is negative.
    const o = kind === "pe" ? ap0 : pe0;
    let d = kind === "pe" ? pe0 + delta : ap0 - delta;

    // Past `o` it's the far apsis, else the near one, which can't go under the minimum.
    d = Math.min(
        APSIS_RATIO * o,
        2 * A_MAX - o,
        Math.max(Math.min(o, Math.max(minPeriapsis, o / APSIS_RATIO)), d),
    );

    const pe = Math.min(d, o);
    const ap = Math.max(d, o);

    return {
        a: (pe + ap) / 2,
        e: (ap - pe) / (ap + pe),
        swapped: kind === "pe" ? d > o : d < o,
    };
};
