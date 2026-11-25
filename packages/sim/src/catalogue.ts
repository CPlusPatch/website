/**
 * @module
 * The satellite snapshot: its packed file format.
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

/** A satellite as the encoder takes it: angles in radians, mean motion in rad/s. */
export type CatalogueEntry = {
    name: string;
    group: SatelliteGroup;
    /** Unix ms. */
    epoch: number;
    meanMotion: number;
    eccentricity: number;
    inclination: number;
    raan: number;
    argp: number;
    m0: number;
};

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

const MAGIC = "SATS";
const VERSION = 1;
const HEADER_BYTES = 20;
const FIELDS = 7;

/** Packs `entries` in order. The same entries always give the same bytes. */
export const encodeCatalogue = (entries: CatalogueEntry[]): Uint8Array => {
    if (entries.some((entry) => entry.name.includes("\n"))) {
        throw new Error("A satellite name can't contain a newline.");
    }

    const epoch = entries.reduce((latest, e) => Math.max(latest, e.epoch), 0);
    const names = new TextEncoder().encode(
        entries.map((entry) => entry.name).join("\n"),
    );

    const count = entries.length;
    const groupsAt = HEADER_BYTES + count * FIELDS * 4;
    const bytes = new Uint8Array(groupsAt + count + names.length);
    const view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode(MAGIC), 0);
    view.setUint8(4, VERSION);
    view.setFloat64(8, epoch, true);
    view.setUint32(16, count, true);

    entries.forEach((entry, i) => {
        const at = HEADER_BYTES + i * FIELDS * 4;
        const fields = [
            (entry.epoch - epoch) / 1000,
            entry.meanMotion,
            entry.eccentricity,
            entry.inclination,
            entry.raan,
            entry.argp,
            entry.m0,
        ];
        fields.forEach((value, j) => {
            view.setFloat32(at + j * 4, value, true);
        });
        bytes[groupsAt + i] = SATELLITE_GROUPS.indexOf(entry.group);
    });
    bytes.set(names, groupsAt + count);

    return bytes;
};

/** The snapshot in `bytes`, as written by `encodeCatalogue`. */
export const decodeCatalogue = (bytes: Uint8Array): Catalogue => {
    if (bytes.length < HEADER_BYTES) {
        throw new Error("The satellite file is shorter than its header.");
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = new TextDecoder().decode(bytes.subarray(0, 4));
    if (magic !== MAGIC) {
        throw new Error(`Not a satellite file: it starts with "${magic}".`);
    }
    const version = view.getUint8(4);
    if (version !== VERSION) {
        throw new Error(`Unsupported satellite file version ${version}.`);
    }

    const count = view.getUint32(16, true);
    const groupsAt = HEADER_BYTES + count * FIELDS * 4;
    if (bytes.length < groupsAt + count) {
        throw new Error("The satellite file is shorter than its count says.");
    }

    const elements = new Float32Array(count * FIELDS);
    for (let i = 0; i < elements.length; i++) {
        elements[i] = view.getFloat32(HEADER_BYTES + i * 4, true);
    }
    const groups = bytes.slice(groupsAt, groupsAt + count);
    if (groups.some((group) => group >= SATELLITE_GROUPS.length)) {
        throw new Error("The satellite file has an unknown group.");
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(groupsAt + count),
    );
    const names = count === 0 ? [] : text.split("\n");
    if (names.length !== count) {
        throw new Error(
            `The satellite file has ${names.length} names for ${count} satellites.`,
        );
    }

    return { epoch: view.getFloat64(8, true), names, groups, elements };
};
