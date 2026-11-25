/**
 * @module
 * The three.js scene of the Orrery, and the text and DOM helpers it shares with the UI.
 */

export { createAssets } from "./assets.ts";
export { ROLE_ICONS, type RoleKey, roleOf } from "./bodies/role-icons.ts";
export { Clock, DEFAULT_RATE, presetOf, RATES, stepRate } from "./clock.ts";
export {
    type DateParts,
    formatYear,
    fromParts,
    MAX_YEAR,
    MIN_YEAR,
    MONTHS,
    PART_NAMES,
    type PartName,
    parsePasted,
    partsProblem,
    stepPart,
    toParts,
} from "./date-parts.ts";
export { h, NARROW_QUERY, setText } from "./dom.ts";
export {
    formatAngle,
    formatDistance,
    formatDuration,
    formatEscapeSpeed,
    formatGravity,
    formatMass,
    formatPlateDistance,
    formatRadius,
    formatRange,
    formatScaleLength,
    formatSoon,
    formatSpeed,
    listUnit,
} from "./format.ts";
export type { Band } from "./geometry/framing.ts";
export type { Rect } from "./geometry/labels.ts";
export type { EditScene, Field, GripTarget } from "./grips/types.ts";
export { scaleBar } from "./scale.ts";
export {
    type ChaseState,
    createView,
    type SatelliteEvent,
    type View,
} from "./scene.ts";
export type { SceneEvent, SceneSource } from "./source.ts";
export { colorOf, ORBIT_CLASS_COLORS } from "./theme.ts";
export {
    dateText,
    isLive,
    offsetText,
    rateText,
    stampParts,
} from "./time-text.ts";
export {
    type AUnit,
    aUnit,
    createUnits,
    DEGREES,
    fromMetres,
    otherUnit,
    toMetres,
    type Units,
} from "./units.ts";
