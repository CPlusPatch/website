/**
 * @module
 * Scenarios, rotation models, documents and the simulation that turns them into body states.
 */

export type {
    Catalogue,
    CatalogueEntry,
    SatelliteGroup,
} from "./catalogue.ts";
export {
    decodeCatalogue,
    encodeCatalogue,
    SATELLITE_GROUPS,
} from "./catalogue.ts";
export type { BodyPatch, Command, DocumentResult } from "./commands.ts";
export { apply } from "./commands.ts";
export type { Document, TimelineEvent } from "./document.ts";
export { documentOf } from "./document.ts";
export { A_MAX, dragApsis, tiltInclination } from "./drag.ts";
export type { Model } from "./models.ts";
export { isModel, MODELS } from "./models.ts";
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
export type { Readouts } from "./readouts.ts";
export { distanceOf, readouts } from "./readouts.ts";
export { KERBOL_LOCKED, ROTATION_MODELS } from "./rotation-models.ts";
export type {
    Body,
    BodyKind,
    OrbitingBody,
    RootBody,
    Scenario,
    ScenarioResult,
    SpacecraftRole,
} from "./scenario.ts";
export {
    fillModels,
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
    satelliteOrbit,
    selectShown,
    snapshotGap,
    writePositions,
} from "./swarm.ts";
export { worldStates } from "./system.ts";
