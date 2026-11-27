/**
 * @module
 * Scenarios, rotations, documents and the simulation that turns them into body states.
 */

export type { Catalogue, SatelliteGroup } from "./catalogue.ts";
export { SATELLITE_GROUPS } from "./catalogue.ts";
export type { BodyPatch, Command, DocumentResult } from "./commands.ts";
export { apply } from "./commands.ts";
export type { Document, TimelineEvent } from "./document.ts";
export { documentOf } from "./document.ts";
export { A_MAX, dragApsis, tiltInclination } from "./drag.ts";
export { documentFile, validateDocument } from "./file.ts";
export type { OrbitClass, OrbitHost } from "./orbit-class.ts";
export { orbitClass, synchronousRadius } from "./orbit-class.ts";
export {
    bodyOrientation,
    rotationPeriod,
    spinAxis,
} from "./orientation.ts";
export {
    precessionsByBody,
    precessionsOf,
    resolvePerturbation,
} from "./perturb/index.ts";
export type { Precession, Turn } from "./precession.ts";
export {
    elementsAt,
    j2Precession,
    precess,
    precessionTurns,
    precessionTurnsThrough,
} from "./precession.ts";
export type { Preset, Presets } from "./presets.ts";
export { expandBody, expandPresets } from "./presets.ts";
export type { Cloud, CloudHost } from "./propagate/cloud.ts";
export { prepareCloud } from "./propagate/cloud.ts";
export type { Propagator, Track } from "./propagate/index.ts";
export { PROPAGATORS, prepareTrack, tracksByBody } from "./propagate/index.ts";
export type { Readouts } from "./readouts.ts";
export { distanceOf, readouts } from "./readouts.ts";
export type {
    IauAngle,
    IauRotation,
    Orientation,
    Rotation,
    Series,
    UniformRotation,
} from "./rotation/index.ts";
export { iauAngles, orientationFromPole } from "./rotation/index.ts";
export type {
    AppearanceValidator,
    Body,
    BodyOrbit,
    Gravity,
    J2,
    Mass,
    OrbitingBody,
    Perturbation,
    Scenario,
    ScenarioResult,
    Secular,
    ValidateOptions,
} from "./scenario.ts";
export {
    isOrbiting,
    MAX_BODIES,
    MAX_NAME,
    sortByDepth,
    subtreeIds,
    validateScenario,
} from "./scenario.ts";
export type { Snapshot, System } from "./snapshot.ts";
export { compile, statesAt } from "./snapshot.ts";
export type { SatelliteFacts, Swarm } from "./swarm.ts";
export {
    inSnapshotWindow,
    prepareSwarm,
    SNAPSHOT_WINDOW,
    satelliteFacts,
    selectShown,
    snapshotGap,
} from "./swarm.ts";
export { worldStates } from "./system.ts";
export type {
    BurnFailure,
    Segment,
    SegmentsResult,
} from "./timeline/segments.ts";
export {
    BURN_FAILURES,
    segmentIn,
    segmentsByBody,
} from "./timeline/segments.ts";
export { piecewiseTrack } from "./timeline/track.ts";
export type { TimelineResult } from "./timeline/validate.ts";
export { validateTimeline } from "./timeline/validate.ts";
