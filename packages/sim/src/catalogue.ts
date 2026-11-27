/**
 * @module
 * The shape a satellite cloud is prepared from.
 */

/** The groups the sky tells satellites apart by. Stored as an index into this list. */
export const SATELLITE_GROUPS = [
    "starlink",
    "oneweb",
    "kuiper",
    "guowang-qianfan",
    "phone-iot",
    "navigation",
    "imaging",
    "weather",
    "other",
] as const;

export type SatelliteGroup = (typeof SATELLITE_GROUPS)[number];

/**
 * A snapshot of satellites, one array per field so they can be propagated in bulk.
 *
 * The elements are CelesTrak's TEME mean elements in Earth's equatorial frame, with no
 * conversion. `elements` holds 7 floats per satellite: seconds from `epoch` (never
 * positive), mean motion in rad/s, eccentricity, then inclination, RAAN, argument of
 * pericentre and mean anomaly in radians.
 */
export type Catalogue = {
    /** The latest element epoch, in unix ms. */
    epoch: number;
    names: string[];
    /** Indices into `SATELLITE_GROUPS`. */
    groups: Uint8Array;
    elements: Float32Array;
};
