import { AU, DAY, G, km } from "../constants.ts";
import type { Elements } from "../kepler.ts";
import { wrapAngle } from "../kepler.ts";
import type { Body, Scenario } from "../scenario.ts";
import { moonBodies } from "./moons.ts";
import { satellites } from "./satellites.ts";
import { smallBodies } from "./small-bodies.ts";

const deg = (x: number): number => (x * Math.PI) / 180;
const au = (x: number): number => x * AU;

type Table1Row = {
    /** Semi-major axis in au. */
    a: number;
    e: number;
    /** Inclination in degrees. */
    I: number;
    /** Mean longitude in degrees. */
    L: number;
    /** Longitude of periapsis in degrees. */
    peri: number;
    /** Longitude of the ascending node in degrees. */
    node: number;
};

/** Converts a row of the JPL table to elements at the J2000 epoch. */
const table1 = (row: Table1Row): Elements => {
    // A negative I is the same orbit as -I with the node and periapsis turned by π.
    const flip = row.I < 0 ? Math.PI : 0;

    return {
        a: au(row.a),
        e: row.e,
        i: deg(Math.abs(row.I)),
        raan: wrapAngle(deg(row.node) + flip),
        argp: wrapAngle(deg(row.peri - row.node) + flip),
        m0: wrapAngle(deg(row.L - row.peri)),
        epoch: 0,
    };
};

// JPL, Approximate Positions of the Planets, Table 1 (1800-2050), J2000 values, rates ignored.
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
// Earth is the Earth-Moon barycentre row; the offset of about 4 700 km is accepted.
// Pluto isn't on the current page. Its row is from the older
// https://ssd.jpl.nasa.gov/txt/p_elem_t1.txt (archived copy).
const ORBITS: Record<string, Table1Row> = {
    mercury: {
        a: 0.38709927,
        e: 0.20563593,
        I: 7.00497902,
        L: 252.2503235,
        peri: 77.45779628,
        node: 48.33076593,
    },
    venus: {
        a: 0.72333566,
        e: 0.00677672,
        I: 3.39467605,
        L: 181.9790995,
        peri: 131.60246718,
        node: 76.67984255,
    },
    earth: {
        a: 1.00000261,
        e: 0.01671123,
        I: -0.00001531,
        L: 100.46457166,
        peri: 102.93768193,
        node: 0.0,
    },
    mars: {
        a: 1.52371034,
        e: 0.0933941,
        I: 1.84969142,
        L: -4.55343205,
        peri: -23.94362959,
        node: 49.55953891,
    },
    jupiter: {
        a: 5.202887,
        e: 0.04838624,
        I: 1.30439695,
        L: 34.39644051,
        peri: 14.72847983,
        node: 100.47390909,
    },
    saturn: {
        a: 9.53667594,
        e: 0.05386179,
        I: 2.48599187,
        L: 49.95424423,
        peri: 92.59887831,
        node: 113.66242448,
    },
    uranus: {
        a: 19.18916464,
        e: 0.04725744,
        I: 0.77263783,
        L: 313.23810451,
        peri: 170.9542763,
        node: 74.01692503,
    },
    neptune: {
        a: 30.06992276,
        e: 0.00859048,
        I: 1.77004347,
        L: -55.12002969,
        peri: 44.96476227,
        node: 131.78422574,
    },
    pluto: {
        a: 39.48211675,
        e: 0.2488273,
        I: 17.14001206,
        L: 238.92903833,
        peri: 224.06891629,
        node: 110.30393684,
    },
};

// JPL, planetary physical parameters: mass in 10^24 kg and mean radius in km.
// https://ssd.jpl.nasa.gov/planets/phys_par.html
const PHYSICAL: Record<string, { mass: number; radius: number }> = {
    mercury: { mass: 0.330103, radius: 2439.4 },
    venus: { mass: 4.86731, radius: 6051.8 },
    earth: { mass: 5.97217, radius: 6371.0084 },
    mars: { mass: 0.641691, radius: 3389.5 },
    jupiter: { mass: 1898.125, radius: 69911 },
    saturn: { mass: 568.317, radius: 58232 },
    uranus: { mass: 86.8099, radius: 25362 },
    neptune: { mass: 102.4092, radius: 24622 },
    pluto: { mass: 0.0130246, radius: 1188.3 },
};

const planet = (id: string, name: string, kind: "planet" | "dwarf"): Body => {
    const { mass, radius } = PHYSICAL[id];

    return {
        id,
        name,
        kind,
        parent: "sun",
        mu: G * mass * 1e24,
        radius: km(radius),
        elements: table1(ORBITS[id]),
    };
};

const EARTH_MU = G * PHYSICAL.earth.mass * 1e24;

const MOON_MU = 4.9028e12;
// Meeus's mean longitude rate, 481 267.8813° per century: a sidereal month of 27.3216 d.
const MOON_N = deg(481_267.8813) / (36_525 * DAY);

// Meeus, Astronomical Algorithms ch. 47, mean elements at J2000 with ω = (L′ − M′) − Ω.
// Cross-checked against JPL's mean lunar elements (https://ssd.jpl.nasa.gov/sats/elem/):
// e 0.0554, i 5.16°, Ω 125.08°, ω 318.15°. `a` comes from the mean motion (≈ 384 750 km).
const MOON: Elements = {
    // Set from the mean motion, as 384 400 km gives 27.285 d and the Moon drifts ~6° a year.
    a: ((EARTH_MU + MOON_MU) / MOON_N ** 2) ** (1 / 3),
    e: 0.0549,
    i: deg(5.145),
    raan: deg(125.045),
    argp: deg(318.31),
    m0: deg(134.963),
    epoch: 0,
};

/** The gravitational parameter of each planet and Pluto, for the moons' orbits. */
const PARENT_MU = Object.fromEntries(
    Object.entries(PHYSICAL).map(([id, { mass }]) => [id, G * mass * 1e24]),
);

/**
 * The Sun, the planets, Pluto, four more dwarf planets, Vesta, Halley, 21 moons
 * (including ours), the ISS and six more Earth satellites.
 */
export const solarSystem: Scenario = {
    version: 1,
    name: "Solar System",
    bodies: [
        {
            id: "sun",
            name: "Sun",
            kind: "star",
            parent: null,
            // JPL astrodynamic parameters: https://ssd.jpl.nasa.gov/astro_par.html
            mu: 1.32712440041e20,
            radius: km(695_700),
            elements: null,
        },
        planet("mercury", "Mercury", "planet"),
        planet("venus", "Venus", "planet"),
        planet("earth", "Earth", "planet"),
        planet("mars", "Mars", "planet"),
        planet("jupiter", "Jupiter", "planet"),
        planet("saturn", "Saturn", "planet"),
        planet("uranus", "Uranus", "planet"),
        planet("neptune", "Neptune", "planet"),
        planet("pluto", "Pluto", "dwarf"),
        ...smallBodies,
        {
            id: "moon",
            name: "Moon",
            kind: "moon",
            parent: "earth",
            mu: MOON_MU,
            radius: km(1737.4),
            elements: MOON,
        },
        ...satellites(EARTH_MU),
        ...moonBodies(PARENT_MU),
    ],
};
