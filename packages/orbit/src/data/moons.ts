import { DAY, deg, km } from "../constants.ts";
import { elementsFromState } from "../elements.ts";
import { rotateEquatorialToEcliptic } from "../frames.ts";
import type { Elements } from "../kepler.ts";
import { stateAt } from "../kepler.ts";
import type { Body } from "../scenario.ts";
import type { Vec3 } from "../vec.ts";
import { add, cross, normalize, scale } from "../vec.ts";
import { ROTATION_MODELS } from "./rotation.ts";

/** The north pole of a reference plane in ICRF, in degrees. */
export type Pole = { ra: number; dec: number };

type Parent = "mars" | "jupiter" | "saturn" | "uranus" | "neptune" | "pluto";

/** One row of the JPL satellite tables: mean elements and physical parameters. */
export type MoonRow = {
    id: string;
    name: string;
    /** The id of the planet it orbits. */
    parent: Parent;
    /** The mean semi-major axis in km. Only used as a check, see `moonElements`. */
    a: number;
    e: number;
    /** Argument of periapsis in degrees, from the node on the reference plane. */
    w: number;
    /** Mean anomaly in degrees. */
    M: number;
    /** Inclination to the reference plane in degrees. */
    i: number;
    /** Node in degrees, from the reference plane's node on the ICRF equator. */
    node: number;
    /** Sidereal period in days. */
    P: number;
    /** Apsidal period in years, 0 if JPL gives none. */
    apsisYr: number;
    /** Nodal period in years, 0 if JPL gives none. */
    nodeYr: number;
    /** True when `P` is the period of the mean longitude, not of the mean anomaly. */
    meanLongitude?: boolean;
    /** GM in km³/s². */
    gm: number;
    /** Mean radius in km. */
    radius: number;
    /** The pole of the reference plane. */
    pole: Pole;
};

// JPL measures the Uranus and Pluto moons from the planet's equator, with i from the rotation pole.
// Uranus spins retrograde, so that pole is the IAU north pole negated. Pluto's W increases, so its
// IAU pole is already the spin pole.
const URANUS_POLE: Pole = { ra: 77.311, dec: 15.175 };
const PLUTO_POLE: Pole = { ra: 132.993, dec: -6.163 };
// Triton's frame is Neptune's equator at J2000, taken from the IAU model so it can't drift from it.
const NEPTUNE_POLE: Pole = ROTATION_MODELS.neptune(0);

// JPL, Planetary Satellite Mean Elements, epoch 2000-01-01.5 TDB (J2000, so the epoch is 0):
// https://ssd.jpl.nasa.gov/sats/elem/
// GM and mean radius are from Planetary Satellite Physical Parameters:
// https://ssd.jpl.nasa.gov/sats/phys_par/
// Mars, Jupiter and Saturn moons use their Laplace plane, Uranus, Neptune and Pluto moons the
// planet's equator. A "-" period in the source is 0 here.
// Checked against Horizons at J2000, 2015 and 2030, these differ from the table:
// - Io and Europa have a retrograde apsis (negative `apsisYr`).
// - Phobos, Triton and Mimas have `P` from Horizons: the table's doesn't hold over 30 years.
// - Tethys has no apsidal period: the table's 0.005 yr is shorter than its orbit.
// - Saturn's `M` is fitted to Horizons: the table's phases are up to 180° off at J2000.
export const MOON_ROWS: MoonRow[] = [
    {
        id: "phobos",
        name: "Phobos",
        parent: "mars",
        a: 9375,
        e: 0.015,
        w: 216.3,
        M: 189.7,
        i: 1.1,
        node: 169.2,
        P: 0.31891,
        apsisYr: 1.1,
        nodeYr: 2.3,
        meanLongitude: true,
        gm: 0.0007087,
        radius: 11.08,
        pole: { ra: 317.7, dec: 52.9 },
    },
    {
        id: "deimos",
        name: "Deimos",
        parent: "mars",
        a: 23457,
        e: 0,
        w: 0,
        M: 205,
        i: 1.8,
        node: 54.3,
        P: 1.2625,
        apsisYr: 0,
        nodeYr: 56.2,
        gm: 0.0000962,
        radius: 6.2,
        pole: { ra: 316.6, dec: 53.5 },
    },
    {
        id: "io",
        name: "Io",
        parent: "jupiter",
        a: 421800,
        e: 0.004,
        w: 49.1,
        M: 330.9,
        i: 0,
        node: 0,
        P: 1.762732,
        apsisYr: -1.333,
        nodeYr: 0,
        gm: 5959.91547,
        radius: 1821.49,
        pole: { ra: 268.1, dec: 64.5 },
    },
    {
        id: "europa",
        name: "Europa",
        parent: "jupiter",
        a: 671100,
        e: 0.009,
        w: 45,
        M: 345.4,
        i: 0.5,
        node: 184,
        P: 3.525463,
        apsisYr: -1.394,
        nodeYr: 30.202,
        gm: 3202.7121,
        radius: 1560.8,
        pole: { ra: 268.1, dec: 64.5 },
    },
    {
        id: "ganymede",
        name: "Ganymede",
        parent: "jupiter",
        a: 1070400,
        e: 0.001,
        w: 198.3,
        M: 324.8,
        i: 0.2,
        node: 58.5,
        P: 7.155588,
        apsisYr: 68.301,
        nodeYr: 137.812,
        gm: 9887.83275,
        radius: 2631.2,
        pole: { ra: 268.2, dec: 64.6 },
    },
    {
        id: "callisto",
        name: "Callisto",
        parent: "jupiter",
        a: 1882700,
        e: 0.007,
        w: 43.8,
        M: 87.4,
        i: 0.3,
        node: 309.1,
        P: 16.69044,
        apsisYr: 277.921,
        nodeYr: 577.264,
        gm: 7179.2834,
        radius: 2410.3,
        pole: { ra: 268.7, dec: 64.8 },
    },
    {
        id: "mimas",
        name: "Mimas",
        parent: "saturn",
        a: 186000,
        e: 0.02,
        w: 160.4,
        M: 324.1,
        i: 1.6,
        node: 66.2,
        P: 0.94244,
        apsisYr: 0.493,
        nodeYr: 0.986,
        meanLongitude: true,
        gm: 2.50349,
        radius: 198.2,
        pole: { ra: 40.6, dec: 83.5 },
    },
    {
        id: "enceladus",
        name: "Enceladus",
        parent: "saturn",
        a: 238400,
        e: 0.005,
        w: 119.5,
        M: 62.8,
        i: 0,
        node: 0,
        P: 1.370218,
        apsisYr: 2.916,
        nodeYr: 0,
        meanLongitude: true,
        gm: 7.21037,
        radius: 252.1,
        pole: { ra: 40.6, dec: 83.5 },
    },
    {
        id: "tethys",
        name: "Tethys",
        parent: "saturn",
        a: 295000,
        e: 0.001,
        w: 335.3,
        M: 298.8,
        i: 1.1,
        node: 273,
        P: 1.887802,
        apsisYr: 0,
        nodeYr: 4.982,
        meanLongitude: true,
        gm: 41.21353,
        radius: 531.1,
        pole: { ra: 40.6, dec: 83.5 },
    },
    {
        id: "dione",
        name: "Dione",
        parent: "saturn",
        a: 377700,
        e: 0.002,
        w: 116,
        M: 60.8,
        i: 0,
        node: 0,
        P: 2.736916,
        apsisYr: 11.698,
        nodeYr: 0,
        meanLongitude: true,
        gm: 73.11607,
        radius: 561.4,
        pole: { ra: 40.6, dec: 83.5 },
    },
    {
        id: "rhea",
        name: "Rhea",
        parent: "saturn",
        a: 527200,
        e: 0.001,
        w: 44.3,
        M: 234.2,
        i: 0.3,
        node: 133.7,
        P: 4.517503,
        apsisYr: 33.939,
        nodeYr: 35.775,
        meanLongitude: true,
        gm: 153.94175,
        radius: 763.5,
        pole: { ra: 40.6, dec: 83.5 },
    },
    {
        id: "titan",
        name: "Titan",
        parent: "saturn",
        a: 1221900,
        e: 0.029,
        w: 78.3,
        M: 215.5,
        i: 0.3,
        node: 78.6,
        P: 15.945448,
        apsisYr: 346.68,
        nodeYr: 687.37,
        meanLongitude: true,
        gm: 8978.1371,
        radius: 2574.76,
        pole: { ra: 36.4, dec: 84 },
    },
    {
        id: "iapetus",
        name: "Iapetus",
        parent: "saturn",
        a: 3561700,
        e: 0.028,
        w: 254.5,
        M: 219.4,
        i: 7.6,
        node: 86.5,
        P: 79.331002,
        apsisYr: 1662.9,
        nodeYr: 3130.302,
        meanLongitude: true,
        gm: 120.51511,
        radius: 734.3,
        pole: { ra: 288.7, dec: 78.9 },
    },
    {
        id: "miranda",
        name: "Miranda",
        parent: "uranus",
        a: 129846,
        e: 0.001,
        w: 154.8,
        M: 73,
        i: 4.4,
        node: 100.9,
        P: 1.413479,
        apsisYr: 8.939,
        nodeYr: 17.787,
        meanLongitude: true,
        gm: 4.3,
        radius: 235.8,
        pole: URANUS_POLE,
    },
    {
        id: "ariel",
        name: "Ariel",
        parent: "uranus",
        a: 190929,
        e: 0.001,
        w: 9.6,
        M: 193.5,
        i: 0,
        node: 0,
        P: 2.520379,
        apsisYr: 28.901,
        nodeYr: 0,
        meanLongitude: true,
        gm: 83.5,
        radius: 578.9,
        pole: URANUS_POLE,
    },
    {
        id: "umbriel",
        name: "Umbriel",
        parent: "uranus",
        a: 265986,
        e: 0.004,
        w: 183.4,
        M: 253,
        i: 0.1,
        node: 174.8,
        P: 4.144177,
        apsisYr: 64.126,
        nodeYr: 129.945,
        meanLongitude: true,
        gm: 85.1,
        radius: 584.7,
        pole: URANUS_POLE,
    },
    {
        id: "titania",
        name: "Titania",
        parent: "uranus",
        a: 436298,
        e: 0.002,
        w: 184,
        M: 68.1,
        i: 0.1,
        node: 29.5,
        P: 8.705869,
        apsisYr: 579.928,
        nodeYr: 1644.649,
        meanLongitude: true,
        gm: 226.9,
        radius: 788.9,
        pole: URANUS_POLE,
    },
    {
        id: "oberon",
        name: "Oberon",
        parent: "uranus",
        a: 583511,
        e: 0.002,
        w: 132.2,
        M: 143.6,
        i: 0.1,
        node: 76.8,
        P: 13.463237,
        apsisYr: 158.604,
        nodeYr: 192.798,
        meanLongitude: true,
        gm: 205.3,
        radius: 761.4,
        pole: URANUS_POLE,
    },
    {
        id: "triton",
        name: "Triton",
        parent: "neptune",
        a: 354800,
        e: 0,
        w: 0,
        M: 63,
        i: 157.3,
        node: 177.7,
        P: 5.876854,
        apsisYr: 675.2,
        nodeYr: 299.4,
        meanLongitude: true,
        gm: 1428.49546,
        radius: 1352.6,
        pole: NEPTUNE_POLE,
    },
    {
        id: "charon",
        name: "Charon",
        parent: "pluto",
        a: 19600,
        e: 0,
        w: 0,
        M: 304.1,
        i: 0,
        node: 0,
        P: 6.387222,
        apsisYr: 0,
        nodeYr: 0,
        gm: 106.1,
        radius: 606.0,
        pole: PLUTO_POLE,
    },
];

const JULIAN_YEAR = 365.25 * DAY;

const icrfPole = ({ ra, dec }: Pole): Vec3 => ({
    x: Math.cos(deg(dec)) * Math.cos(deg(ra)),
    y: Math.cos(deg(dec)) * Math.sin(deg(ra)),
    z: Math.sin(deg(dec)),
});

/** The pole of a row's reference plane in ecliptic J2000, as a unit vector. */
export const moonPole = (row: MoonRow): Vec3 =>
    rotateEquatorialToEcliptic(icrfPole(row.pole));

/** The rates in rad/s at which a row's orbit precesses, from its apsidal and nodal periods. */
const precessionRates = (
    row: MoonRow,
): { nodeRate: number; argpRate: number } => ({
    // J2 regresses a prograde node and advances a retrograde one.
    nodeRate:
        row.nodeYr === 0
            ? 0
            : (-Math.sign(Math.cos(deg(row.i))) * 2 * Math.PI) /
              (row.nodeYr * JULIAN_YEAR),
    argpRate:
        row.apsisYr === 0 ? 0 : (2 * Math.PI) / (row.apsisYr * JULIAN_YEAR),
});

/** The ecliptic elements of a moon around a parent with gravitational parameter `parentMu`. */
export const moonElements = (row: MoonRow, parentMu: number): Elements => {
    const mu = parentMu + row.gm * 1e9;
    // JPL's `P` is the period of the mean anomaly, except where `meanLongitude` is set. `precess`
    // adds the apsidal and nodal rates, so a mean-longitude period has them taken out first.
    const { nodeRate, argpRate } = precessionRates(row);
    const turn = row.meanLongitude
        ? argpRate + nodeRate * Math.cos(deg(row.i))
        : 0;
    const n = (2 * Math.PI) / (row.P * DAY) - turn;
    const a = (mu / n ** 2) ** (1 / 3);
    const local: Elements = {
        a,
        e: row.e,
        i: deg(row.i),
        raan: deg(row.node),
        argp: deg(row.w),
        m0: deg(row.M),
        epoch: 0,
    };

    // The plane's node on the ICRF equator is at RA + 90°, as in `orientationFromPole`.
    const z = icrfPole(row.pole);
    const x = normalize(cross({ x: 0, y: 0, z: 1 }, z));
    const y = cross(z, x);
    const toEcliptic = (u: Vec3): Vec3 =>
        rotateEquatorialToEcliptic(
            add(add(scale(x, u.x), scale(y, u.y)), scale(z, u.z)),
        );

    const { r, v } = stateAt(local, mu, 0);
    const result = elementsFromState(toEcliptic(r), toEcliptic(v), mu, 0);

    if (!result.ok) {
        throw new Error(
            `${row.name}: elliptic elements gave no orbit (${result.reason})`,
        );
    }

    return result.elements;
};

/** The moons of the planets in `parentMu`, a gravitational parameter in m³/s² by planet id. */
export const moonBodies = (
    parentMu: Record<MoonRow["parent"], number>,
): Body[] =>
    MOON_ROWS.map((row) => {
        const { nodeRate, argpRate } = precessionRates(row);
        const body: Body = {
            id: row.id,
            name: row.name,
            kind: "moon",
            parent: row.parent,
            mu: row.gm * 1e9,
            radius: km(row.radius),
            elements: moonElements(row, parentMu[row.parent]),
        };

        if (nodeRate !== 0 || argpRate !== 0) {
            body.precession = {
                pole: normalize(moonPole(row)),
                nodeRate,
                argpRate,
            };
        }

        return body;
    });
