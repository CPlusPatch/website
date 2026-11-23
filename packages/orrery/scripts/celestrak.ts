import type { SatelliteGroup } from "../src/catalogue.ts";

/** One row of a CelesTrak OMM CSV. Angles are in radians. */
export type OmmRecord = {
    name: string;
    /** NORAD catalog number. */
    norad: number;
    /** Unix ms. */
    epoch: number;
    /** In rev/day. */
    meanMotion: number;
    eccentricity: number;
    inclination: number;
    raan: number;
    argp: number;
    m0: number;
};

const COLUMNS = [
    "OBJECT_NAME",
    "EPOCH",
    "MEAN_MOTION",
    "ECCENTRICITY",
    "INCLINATION",
    "RA_OF_ASC_NODE",
    "ARG_OF_PERICENTER",
    "MEAN_ANOMALY",
    "NORAD_CAT_ID",
];

const RADIANS = Math.PI / 180;

/** The records of an OMM CSV, in file order. Columns are found by their header name. */
export const parseOmmCsv = (text: string): OmmRecord[] => {
    const lines = text.split(/\r?\n/).filter((line) => line !== "");
    if (lines.length === 0) throw new Error("The CSV is empty.");

    const header = lines[0].split(",");
    const at = new Map(header.map((name, i) => [name, i]));
    for (const column of COLUMNS) {
        if (!at.has(column))
            throw new Error(`The CSV has no ${column} column.`);
    }

    return lines.slice(1).map((line, row) => {
        // Line 1 is the header, so the first record is on line 2.
        const where = `line ${row + 2}`;
        if (line.includes('"')) {
            throw new Error(`Quoted fields aren't supported (${where}).`);
        }
        const fields = line.split(",");
        if (fields.length !== header.length) {
            throw new Error(
                `Expected ${header.length} fields, got ${fields.length} (${where}).`,
            );
        }

        const field = (column: string): string => fields[at.get(column) ?? 0];
        const number = (column: string): number => {
            const text = field(column).trim();
            const value = text === "" ? Number.NaN : Number(text);
            if (!Number.isFinite(value)) {
                throw new Error(
                    `${column} is "${text}", not a number (${where}).`,
                );
            }

            return value;
        };

        // CelesTrak gives UTC with no zone.
        const epoch = Date.parse(`${field("EPOCH")}Z`);
        if (!Number.isFinite(epoch)) {
            throw new Error(
                `EPOCH is "${field("EPOCH")}", not a date (${where}).`,
            );
        }

        return {
            name: field("OBJECT_NAME"),
            norad: number("NORAD_CAT_ID"),
            epoch,
            meanMotion: number("MEAN_MOTION"),
            eccentricity: number("ECCENTRICITY"),
            inclination: number("INCLINATION") * RADIANS,
            raan: number("RA_OF_ASC_NODE") * RADIANS,
            argp: number("ARG_OF_PERICENTER") * RADIANS,
            m0: number("MEAN_ANOMALY") * RADIANS,
        };
    });
};

const startsWithWord = (name: string, prefix: string): boolean =>
    name.startsWith(prefix) && !/^[A-Za-z]/.test(name.slice(prefix.length));

type Rule = {
    group: SatelliteGroup;
    prefixes: string[];
    /** For names that don't start with the constellation's name. */
    patterns?: RegExp[];
};

// The first match wins, so weather comes before imaging: GEO-KOMPSAT-2A is weather, KOMPSAT-3A isn't.
const RULES: Rule[] = [
    { group: "starlink", prefixes: ["STARLINK"] },
    { group: "oneweb", prefixes: ["ONEWEB"] },
    { group: "kuiper", prefixes: ["KUIPER"] },
    { group: "guowang-qianfan", prefixes: ["QIANFAN", "HULIANWANG"] },
    {
        group: "phone-iot",
        prefixes: [
            "IRIDIUM",
            "GLOBALSTAR",
            "ORBCOMM",
            "TIANQI",
            "KINEIS",
            "CENTISPACE",
            "RASSVET",
            "GONETS",
            "SPACEMOBILE",
            "BLUEBIRD",
            "LYNK",
            "ASTROCAST",
            "APRIZESAT",
        ],
    },
    {
        group: "navigation",
        prefixes: ["NAVSTAR", "GPS", "BEIDOU", "IRNSS", "QZS"],
        // Galileo is "GSAT0101 (GALILEO-PFM)" and GLONASS is "COSMOS 2433 [GLONASS-M]".
        patterns: [/^GSAT0\d{3}/, /\(GALILEO/, /[[(]GLONASS/],
    },
    {
        group: "weather",
        prefixes: [
            "NOAA",
            "GOES",
            "EWS-G",
            "METEOSAT",
            "METEOR",
            "METOP",
            "FENGYUN",
            "HIMAWARI",
            "GEO-KOMPSAT",
            "ELEKTRO",
            "JPSS",
            "DMSP",
            "INSAT-3D",
            "INSAT-3DR",
            "INSAT-3DS",
        ],
    },
    {
        group: "imaging",
        prefixes: [
            "FLOCK",
            "SKYSAT",
            "ICEYE",
            "JILIN",
            "GAOFEN",
            "SUPERVIEW",
            "CAPELLA",
            "SENTINEL",
            "LANDSAT",
            "WORLDVIEW",
            "PLEIADES",
            "GRUS",
            "QPS",
            "STRIX",
            "UMBRA",
            "NUSAT",
            "PELICAN",
            "YAOGAN",
            "SPOT",
            "KOMPSAT",
            "ARIRANG",
            "PIESAT",
            "TIANHUI",
            "ZIYUAN",
            "CBERS",
            "CARTOSAT",
            "RESURS",
            "KANOPUS",
            "HAIYANG",
            "BLACKSKY",
            "GHGSAT",
            "SIWEI",
        ],
    },
];

/** The group a satellite is drawn in, from its name. */
export const satelliteGroup = (name: string): SatelliteGroup => {
    const rule = RULES.find(
        ({ prefixes, patterns = [] }) =>
            prefixes.some((prefix) => startsWithWord(name, prefix)) ||
            patterns.some((pattern) => pattern.test(name)),
    );

    return rule?.group ?? "other";
};
