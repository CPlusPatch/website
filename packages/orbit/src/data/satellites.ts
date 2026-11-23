import { DAY, km } from "../constants.ts";
import { equatorialToEcliptic, rotateEquatorialToEcliptic } from "../frames.ts";
import type { Elements } from "../kepler.ts";
import { j2Precession } from "../precession.ts";
import type { Body, SpacecraftRole } from "../scenario.ts";
import { unixMsToJ2000s } from "../time.ts";

const deg = (x: number): number => (x * Math.PI) / 180;

// WGS 84 / EGM2008: the J2 of the geopotential and the equatorial radius in km.
const EARTH_J2 = 1.08262668e-3;
const EARTH_RADIUS = km(6378.137);

/** Converts a TLE to ecliptic elements around a parent with gravitational parameter `mu`. */
const fromTle = (line1: string, line2: string, mu: number): Elements => {
    const twoDigitYear = Number(line1.slice(18, 20));
    const year = twoDigitYear < 57 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
    const day = Number(line1.slice(20, 32));
    const revPerDay = Number(line2.slice(52, 63));

    // Day 1.0 is Jan 1 00:00 UTC.
    const epoch = unixMsToJ2000s(Date.UTC(year, 0, 1) + (day - 1) * DAY * 1000);
    const n = (revPerDay * 2 * Math.PI) / DAY;

    // The period comes from the mean motion, so a is chosen to match it for this mu.
    const equatorial: Elements = {
        a: (mu / n ** 2) ** (1 / 3),
        e: Number(`0.${line2.slice(26, 33)}`),
        i: deg(Number(line2.slice(8, 16))),
        raan: deg(Number(line2.slice(17, 25))),
        argp: deg(Number(line2.slice(34, 42))),
        m0: deg(Number(line2.slice(43, 51))),
        epoch,
    };

    // TLEs are TEME mean elements, treated as osculating J2000 equatorial.
    // The caller applies J2 precession. Drag is ignored, so the orbit drifts within days.
    return equatorialToEcliptic(equatorial, mu);
};

type Satellite = {
    id: string;
    name: string;
    /** NORAD catalog number, for the CelesTrak URL. */
    catalog: number;
    tle: readonly [string, string];
    /** The bounding radius of its model in the orrery, in m. */
    radius: number;
    /** What it does. Absent means other. */
    role?: SpacecraftRole;
};

// Fetched from CelesTrak at 2026-11-23T12:48:34Z,
// https://celestrak.org/NORAD/elements/gp.php?CATNR=<catalog>&FORMAT=tle
const SATELLITES: Satellite[] = [
    {
        id: "iss",
        name: "ISS",
        catalog: 25544,
        tle: [
            "1 25544U 98067A   26327.20353680  .00007096  00000+0  13418-3 0  9998",
            "2 25544  51.6320 233.1644 0007425  56.0849 304.0845 15.49560282596402",
        ],
        radius: 67.5,
        role: "station",
    },
    {
        id: "hubble",
        name: "Hubble",
        catalog: 20580,
        tle: [
            "1 20580U 90037B   26327.00639607  .00004292  00000+0  12600-3 0  9993",
            "2 20580  28.4727  73.7669 0002533 112.8756 247.2108 15.32397842812940",
        ],
        radius: 12,
        role: "telescope",
    },
    {
        id: "tiangong",
        name: "Tiangong",
        catalog: 48274,
        tle: [
            "1 48274U 21035A   26327.20372910  .00014662  00000+0  17385-3 0  9995",
            "2 48274  41.4699  75.5877 0004869 283.0054  77.0241 15.60901120318006",
        ],
        radius: 29.9,
        role: "station",
    },
    {
        id: "landsat-9",
        name: "Landsat 9",
        catalog: 49260,
        tle: [
            "1 49260U 21088A   26327.09832900  .00000188  00000+0  51832-4 0  9990",
            "2 49260  98.2119  35.2016 0000983  94.4337 265.6974 14.57118423274143",
        ],
        radius: 6.7,
        role: "earth-observation",
    },
    {
        id: "gps-biii-1",
        name: "GPS BIII-1",
        catalog: 43873,
        tle: [
            "1 43873U 18109A   26326.80176365  .00000003  00000+0  00000+0 0  9990",
            "2 43873  55.7910  85.9338 0041684 197.5727 334.4554  2.00567043 58256",
        ],
        radius: 8.7,
        role: "navigation",
    },
    {
        id: "goes-19",
        name: "GOES-19",
        catalog: 60133,
        tle: [
            "1 60133U 24119A   26327.23479124 -.00000226  00000+0  00000+0 0  9991",
            "2 60133   0.0065  67.0732 0001034 222.1135 142.3965  1.00271989  8550",
        ],
        radius: 11.7,
        role: "earth-observation",
    },
    {
        id: "meridian-10",
        name: "Meridian 10",
        catalog: 52145,
        tle: [
            "1 52145U 22030A   26326.49233843  .00000307  00000+0  00000+0 0  9997",
            "2 52145  62.6994 123.4926 6833520 272.8165  17.2977  2.00590701 34206",
        ],
        radius: 5.3,
    },
];

/** The NORAD catalog numbers of the satellites above. */
export const CURATED_CATALOG_NUMBERS: number[] = SATELLITES.map(
    ({ catalog }) => catalog,
);

/** The ISS and six more Earth satellites, with J2 precession, around an Earth of `earthMu`. */
export const satellites = (earthMu: number): Body[] => {
    const pole = rotateEquatorialToEcliptic({ x: 0, y: 0, z: 1 });

    return SATELLITES.map(({ id, name, tle, radius, role }) => {
        const elements = fromTle(tle[0], tle[1], earthMu);

        return {
            id,
            name,
            kind: "spacecraft",
            parent: "earth",
            mu: 0,
            radius,
            elements,
            precession: j2Precession(
                elements,
                earthMu,
                EARTH_J2,
                EARTH_RADIUS,
                pole,
            ),
            ...(role === undefined ? {} : { role }),
        };
    });
};
