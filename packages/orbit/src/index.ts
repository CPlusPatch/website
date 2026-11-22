/**
 * @module
 * Two-body orbit math in SI units (metres, seconds, radians), with no DOM.
 */

export type { Burn } from "./burn.ts";
export { applyBurn } from "./burn.ts";
export { AU, DAY, G, J2000_UNIX_MS, OBLIQUITY_J2000 } from "./constants.ts";
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
export type { Orientation, RotationModel } from "./orientation.ts";
export { bodyOrientation, orientationFromPole } from "./orientation.ts";
export type { Body, BodyKind, Scenario, ScenarioResult } from "./scenario.ts";
export { sortByDepth, validateScenario } from "./scenario.ts";
export { worldStates } from "./system.ts";
export { j2000sToUnixMs, unixMsToJ2000s } from "./time.ts";
export type { Vec3 } from "./vec.ts";
export { add, cross, dot, length, normalize, scale, sub } from "./vec.ts";
