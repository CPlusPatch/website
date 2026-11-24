/**
 * @module
 * Two-body orbit math in SI units (metres, seconds, radians), with no DOM.
 */

export type { Burn } from "./burn.ts";
export { applyBurn } from "./burn.ts";
export { AU, DAY, G, J2000_UNIX_MS, OBLIQUITY_J2000 } from "./constants.ts";
export { builtInScenarios } from "./data/built-in.ts";
export { eridani, gargantua, kerbol, tauCeti } from "./data/fiction.ts";
export {
    CURATED_CATALOG_NUMBERS,
    CURATED_NAMES,
    EARTH_J2,
    EARTH_RADIUS,
} from "./data/satellites.ts";
export { solarSystem } from "./data/solar-system.ts";
export type { ElementsResult } from "./elements.ts";
export { elementsFromState, nextApsisTime, reepoch } from "./elements.ts";
export { equatorialToEcliptic, rotateEquatorialToEcliptic } from "./frames.ts";
export type { Elements, State } from "./kepler.ts";
export {
    apoapsis,
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
export type { OrbitClass } from "./orbit-class.ts";
export { orbitClass } from "./orbit-class.ts";
export type { Orientation, RotationModel } from "./orientation.ts";
export {
    bodyOrientation,
    orientationFromPole,
    rotationPeriod,
    spinAxis,
} from "./orientation.ts";
export type { Precession, Turn } from "./precession.ts";
export {
    elementsAt,
    j2Precession,
    precess,
    precessionTurns,
} from "./precession.ts";
export type {
    Body,
    BodyKind,
    Scenario,
    ScenarioResult,
    SpacecraftRole,
} from "./scenario.ts";
export {
    MAX_BODIES,
    MAX_NAME,
    sortByDepth,
    validateScenario,
} from "./scenario.ts";
export { worldStates } from "./system.ts";
export {
    j2000sToUnixMs,
    MAX_TIME,
    MAX_YEAR,
    MIN_TIME,
    MIN_YEAR,
    unixMsToJ2000s,
} from "./time.ts";
export type { Vec3 } from "./vec.ts";
export { add, cross, dot, length, normalize, scale, sub } from "./vec.ts";
