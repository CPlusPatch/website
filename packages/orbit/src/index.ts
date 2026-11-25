/**
 * @module
 * Two-body orbit math in SI units (metres, seconds, radians), with no DOM.
 */

export type { Burn } from "./burn.ts";
export { applyBurn } from "./burn.ts";
export {
    AU,
    DAY,
    deg,
    EARTH_J2,
    EARTH_RADIUS,
    G,
    J2000_UNIX_MS,
    km,
    OBLIQUITY_J2000,
} from "./constants.ts";
export type { ElementsResult } from "./elements.ts";
export { elementsFromState, nextApsisTime, reepoch } from "./elements.ts";
export {
    equatorialToEcliptic,
    rotateEclipticToEquatorial,
    rotateEquatorialToEcliptic,
} from "./frames.ts";
export type { Elements, State } from "./kepler.ts";
export {
    apoapsis,
    axes,
    eccentricAnomalyOf,
    meanAnomalyAt,
    meanMotion,
    orbitPoints,
    orbitPointsAt,
    periapsis,
    period,
    solveKepler,
    stateAt,
    trueAnomalyAt,
    wrapAngle,
} from "./kepler.ts";
export {
    j2000sToUnixMs,
    MAX_TIME,
    MAX_YEAR,
    MIN_TIME,
    MIN_YEAR,
    unixMsToJ2000s,
} from "./time.ts";
export type { Vec3 } from "./vec.ts";
export {
    add,
    cross,
    dot,
    length,
    normalize,
    rotate,
    scale,
    sub,
} from "./vec.ts";
