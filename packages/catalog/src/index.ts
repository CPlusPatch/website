/**
 * @module
 * The built-in scenarios (the solar system and the fictional systems) and the satellite snapshot.
 */

export { builtInScenarios } from "./built-in.ts";
export type { CatalogueEntry } from "./catalogue.ts";
export {
    decodeCatalogue,
    encodeCatalogue,
    loadSatellites,
} from "./catalogue.ts";
export {
    GROUP_CLASSES,
    SNAPSHOT_DATE,
    SNAPSHOT_EPOCH,
} from "./catalogue-snapshot.ts";
export { eridani, gargantua, kerbol, tauCeti } from "./fiction.ts";
export { KERBOL_LOCKED, PRESETS } from "./presets/index.ts";
export { PRESET_NAMES } from "./presets/names.ts";
export {
    CURATED_CATALOG_NUMBERS,
    CURATED_NAMES,
    satellites,
} from "./satellites.ts";
export { solarSystem } from "./solar-system.ts";
