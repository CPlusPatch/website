import { AU, DAY, deg, km, OBLIQUITY_J2000 } from "../constants.ts";
import type { Elements } from "../kepler.ts";
import { meanMotion } from "../kepler.ts";
import type { Model } from "../models.ts";
import { isModel } from "../models.ts";
import type { RotationModel } from "../orientation.ts";
import type { Body, Scenario } from "../scenario.ts";
import { fillModels } from "../scenario.ts";

// JPL astrodynamic parameters: https://ssd.jpl.nasa.gov/astro_par.html
const GM_SUN = 1.32712440041e20;
const GM_EARTH = 3.986004418e14;
const R_SUN = km(695_700);
const R_EARTH = km(6371);
const C = 299_792_458;

// These systems have no known orientation, so the ecliptic stands in for each one's reference plane.
const orbit = (
    a: number,
    e: number,
    i: number,
    raan: number,
    argp: number,
    m0: number,
): Elements => ({
    a,
    e,
    i: deg(i),
    raan: deg(raan),
    argp: deg(argp),
    m0: deg(m0),
    epoch: 0,
});

/** A rocky planet's radius from its mass in Earth masses, R ∝ M^0.27 (Valencia et al. 2006). */
const rockyRadius = (earthMasses: number): number =>
    R_EARTH * earthMasses ** 0.27;

/** A planet of `earthMasses`, with its radius from `rockyRadius` unless one is given. */
const planet = (
    id: string,
    name: string,
    parent: string,
    earthMasses: number,
    elements: Elements,
    color: string,
    radius = rockyRadius(earthMasses),
): Body => ({
    id,
    name,
    kind: "planet",
    parent,
    mu: earthMasses * GM_EARTH,
    radius,
    elements,
    color,
});

// Interstellar (2014). Kip Thorne, The Science of Interstellar: Gargantua has 100 million solar
// masses and spins near the maximum, so its horizon radius is about GM/c².
const GARGANTUA_MU = 1e8 * GM_SUN;

// Thorne gives Miller's orbit as 1.7 hours, seen from far away. `a` matches that period.
const MILLER_PERIOD = 1.7 * 3600;

/** Interstellar's Gargantua. Mann's and Edmunds' orbits aren't given in the film or book, so they're made up. */
export const gargantua: Scenario = {
    version: 2,
    name: "Gargantua (Interstellar)",
    bodies: [
        {
            id: "gargantua",
            name: "Gargantua",
            kind: "star",
            parent: null,
            mu: GARGANTUA_MU,
            radius: GARGANTUA_MU / C ** 2,
            elements: null,
            color: "#2b2622",
        },
        // 130% of Earth's gravity, from the film.
        planet(
            "miller",
            "Miller's planet",
            "gargantua",
            1.3,
            orbit(
                (GARGANTUA_MU * (MILLER_PERIOD / (2 * Math.PI)) ** 2) **
                    (1 / 3),
                0,
                0,
                0,
                0,
                40,
            ),
            "#5f93ad",
            R_EARTH,
        ),
        // Thorne suggests a very eccentric orbit for Mann's frozen clouds.
        planet(
            "mann",
            "Mann's planet",
            "gargantua",
            1,
            orbit(20 * AU, 0.6, 3, 70, 30, 200),
            "#dfe7ea",
        ),
        planet(
            "edmunds",
            "Edmunds' planet",
            "gargantua",
            1,
            orbit(55 * AU, 0.05, 5, 160, 90, 300),
            "#b59a7a",
        ),
    ],
};

/**
 * Tau Ceti from Project Hail Mary, where planet e is Adrian. The four candidate planets are from
 * Feng et al. 2017 (AJ 154, 135); the masses are minimum masses.
 */
export const tauCeti: Scenario = {
    version: 2,
    name: "Tau Ceti (Project Hail Mary)",
    bodies: [
        {
            id: "tau-ceti",
            name: "Tau Ceti",
            kind: "star",
            parent: null,
            // Korolik et al. 2023 and Ibañez Bustos et al. 2026, via Wikipedia.
            mu: 0.8 * GM_SUN,
            radius: 0.801 * R_SUN,
            elements: null,
            color: "#ffe0a8",
        },
        planet(
            "tau-ceti-g",
            "Tau Ceti g",
            "tau-ceti",
            1.75,
            orbit(0.133 * AU, 0.06, 0, 0, 20, 10),
            "#b9a28c",
        ),
        planet(
            "tau-ceti-h",
            "Tau Ceti h",
            "tau-ceti",
            1.83,
            orbit(0.243 * AU, 0.23, 0, 0, 140, 120),
            "#a8968a",
        ),
        planet(
            "adrian",
            "Adrian",
            "tau-ceti",
            3.93,
            orbit(0.538 * AU, 0.18, 0, 0, 250, 230),
            "#9fb8a2",
        ),
        planet(
            "tau-ceti-f",
            "Tau Ceti f",
            "tau-ceti",
            3.93,
            orbit(1.334 * AU, 0.16, 0, 0, 320, 300),
            "#c4ccd4",
        ),
    ],
};

/**
 * 40 Eridani from Project Hail Mary, with Rocky's planet Erid as the candidate 40 Eridani b
 * (Ma et al. 2018, MNRAS 480, 2411). Star data is from Wikipedia's 40 Eridani page.
 */
export const eridani: Scenario = {
    version: 2,
    name: "40 Eridani (Project Hail Mary)",
    bodies: [
        {
            id: "40-eridani-a",
            name: "40 Eridani A",
            kind: "star",
            parent: null,
            mu: 0.78 * GM_SUN,
            radius: 0.804 * R_SUN,
            elements: null,
            color: "#ffcf8a",
        },
        planet(
            "erid",
            "Erid",
            "40-eridani-a",
            8.47,
            orbit(0.224 * AU, 0.04, 0, 0, 0, 60),
            "#c9a46a",
        ),
        // The B and C pair is about 400 au from A. Its eccentricity isn't known, and A's orbit
        // leaves out C's mass, so the period is ~6 900 years, not ~8 000.
        {
            id: "40-eridani-b",
            name: "40 Eridani B",
            kind: "star",
            parent: "40-eridani-a",
            mu: 0.558 * GM_SUN,
            radius: 0.01308 * R_SUN,
            elements: orbit(400 * AU, 0, 0, 0, 0, 0),
            color: "#e8eeff",
        },
        // The B–C orbit's 108° inclination is to the sky, so it isn't used here.
        {
            id: "40-eridani-c",
            name: "40 Eridani C",
            kind: "star",
            parent: "40-eridani-b",
            mu: 0.198 * GM_SUN,
            radius: 0.274 * R_SUN,
            elements: orbit(34.5 * AU, 0.4141, 0, 0, 0, 0),
            color: "#ff9a6a",
        },
    ],
};

/**
 * Elements in KSP's units: metres, degrees, and the mean anomaly at epoch in radians. The game's
 * epoch (the start of a new save) stands in for J2000.
 */
const kspOrbit = (
    a: number,
    e: number,
    i: number,
    raan: number,
    argp: number,
    m0: number,
): Elements => ({ ...orbit(a, e, i, raan, argp, 0), m0 });

/** A Kerbol body with the game's own GM (m³/s²) and radius (km). */
const ksp = (
    id: string,
    name: string,
    kind: "planet" | "moon",
    parent: string,
    mu: number,
    radiusKm: number,
    elements: Elements,
    color: string,
): Body => ({
    id,
    name,
    kind,
    parent,
    mu,
    radius: km(radiusKm),
    elements,
    color,
});

/**
 * The Kerbol system from Kerbal Space Program, with the game's values from the KSP wiki. The game
 * calls Dres and Eeloo planets, so they're planets here too.
 */
export const kerbol: Scenario = {
    version: 2,
    name: "Kerbol (Kerbal Space Program)",
    bodies: fillModels([
        {
            id: "kerbol",
            name: "Kerbol",
            kind: "star",
            parent: null,
            mu: 1.1723328e18,
            radius: km(261_600),
            elements: null,
            color: "#fff1c4",
        },
        ksp(
            "moho",
            "Moho",
            "planet",
            "kerbol",
            1.6860938e11,
            250,
            kspOrbit(5_263_138_304, 0.2, 7, 70, 15, 3.14),
            "#8a6a55",
        ),
        ksp(
            "eve",
            "Eve",
            "planet",
            "kerbol",
            8.1717302e12,
            700,
            kspOrbit(9_832_684_544, 0.01, 2.1, 15, 0, 3.14),
            "#8b4fa8",
        ),
        ksp(
            "gilly",
            "Gilly",
            "moon",
            "eve",
            8_289_449.8,
            13,
            kspOrbit(31_500_000, 0.55, 12, 80, 10, 0.9),
            "#a08a78",
        ),
        ksp(
            "kerbin",
            "Kerbin",
            "planet",
            "kerbol",
            3.5316e12,
            600,
            kspOrbit(13_599_840_256, 0, 0, 0, 0, 3.14),
            "#4a7fb5",
        ),
        ksp(
            "mun",
            "Mun",
            "moon",
            "kerbin",
            6.5138398e10,
            200,
            kspOrbit(12_000_000, 0, 0, 0, 0, 1.7),
            "#9a9a9a",
        ),
        ksp(
            "minmus",
            "Minmus",
            "moon",
            "kerbin",
            1.7658e9,
            60,
            kspOrbit(47_000_000, 0, 6, 78, 38, 0.9),
            "#b8e0d0",
        ),
        ksp(
            "duna",
            "Duna",
            "planet",
            "kerbol",
            3.0136321e11,
            320,
            kspOrbit(20_726_155_264, 0.051, 0.06, 135.5, 0, 3.14),
            "#b5583a",
        ),
        ksp(
            "ike",
            "Ike",
            "moon",
            "duna",
            1.8568369e10,
            130,
            kspOrbit(3_200_000, 0.03, 0.2, 0, 0, 1.7),
            "#6e6a66",
        ),
        ksp(
            "dres",
            "Dres",
            "planet",
            "kerbol",
            2.1484489e10,
            138,
            kspOrbit(40_839_348_203, 0.145, 5, 280, 90, 3.14),
            "#8c847a",
        ),
        ksp(
            "jool",
            "Jool",
            "planet",
            "kerbol",
            2.82528e14,
            6000,
            kspOrbit(68_773_560_320, 0.05, 1.304, 52, 0, 0.1),
            "#6fa84a",
        ),
        ksp(
            "laythe",
            "Laythe",
            "moon",
            "jool",
            1.962e12,
            500,
            kspOrbit(27_184_000, 0, 0, 0, 0, 3.14),
            "#3e6ea8",
        ),
        ksp(
            "vall",
            "Vall",
            "moon",
            "jool",
            2.074815e11,
            300,
            kspOrbit(43_152_000, 0, 0, 0, 0, 0.9),
            "#b8c8d8",
        ),
        ksp(
            "tylo",
            "Tylo",
            "moon",
            "jool",
            2.82528e12,
            600,
            kspOrbit(68_500_000, 0, 0.025, 0, 0, 3.14),
            "#c8bca8",
        ),
        ksp(
            "bop",
            "Bop",
            "moon",
            "jool",
            2.4868349e9,
            65,
            kspOrbit(128_500_000, 0.235, 15, 10, 25, 0.9),
            "#7a6450",
        ),
        ksp(
            "pol",
            "Pol",
            "moon",
            "jool",
            7.2170208e8,
            44,
            kspOrbit(179_890_000, 0.171, 4.25, 2, 15, 0.9),
            "#c9b46a",
        ),
        ksp(
            "eeloo",
            "Eeloo",
            "planet",
            "kerbol",
            7.4410815e10,
            210,
            kspOrbit(90_118_820_000, 0.26, 6.15, 50, 260, 3.14),
            "#e8e8e0",
        ),
    ]),
};

// Sidereal rotation periods in seconds, from the KSP wiki. The tidally locked bodies are in
// `KERBOL_LOCKED` instead.
const KERBOL_DAYS: Record<string, number> = {
    kerbol: 432_000,
    moho: 1_210_000,
    eve: 80_500,
    gilly: 28_255,
    kerbin: 21_549.425,
    minmus: 40_400,
    dres: 34_800,
    jool: 36_000,
    eeloo: 19_460,
};

// Each locked body and the body it faces. Duna is locked to Ike, which orbits it.
const KERBOL_LOCKED: Record<string, string> = {
    mun: "kerbin",
    ike: "duna",
    duna: "ike",
    laythe: "jool",
    vall: "jool",
    tylo: "jool",
    bop: "jool",
    pol: "jool",
};

/** Degrees per day for a turn every `seconds`. */
const turnRate = (seconds: number): number => (360 * DAY) / seconds;

const modelOf = (id: string): Model => {
    if (!isModel(id)) throw new Error(`"${id}" isn't a model.`);

    return id;
};

const kerbolRotation = (): Partial<Record<Model, RotationModel>> => {
    // KSP bodies have no axial tilt, so every pole is the ecliptic pole, in ICRF RA and Dec.
    const ra = 270;
    const dec = 90 - (OBLIQUITY_J2000 * 180) / Math.PI;
    const byId = new Map(kerbol.bodies.map((body) => [body.id, body]));
    const models: Partial<Record<Model, RotationModel>> = {};

    for (const [id, seconds] of Object.entries(KERBOL_DAYS)) {
        const rate = turnRate(seconds);
        models[modelOf(id)] = (d) => ({ ra, dec, w: rate * d });
    }

    // A locked body turns at its moon's mean motion, with lon 0 on the mean longitude line. The
    // orbits are near the ecliptic, so raan + argp + M stands in for the longitude.
    for (const [id, partner] of Object.entries(KERBOL_LOCKED)) {
        const moonId = byId.get(id)?.parent === partner ? id : partner;
        const moon = byId.get(moonId);
        const parent = moon?.parent ? byId.get(moon.parent) : undefined;
        if (!moon?.elements || !parent)
            throw new Error(`Kerbol has no orbit for ${moonId}.`);

        const { raan, argp, m0 } = moon.elements;
        const n = meanMotion(moon.elements, parent.mu + moon.mu);
        const rate = (n * DAY * 180) / Math.PI;
        // The moon faces back along its radius; its parent faces out along it.
        const w0 =
            ((raan + argp + m0) * 180) / Math.PI + (moonId === id ? 180 : 0);
        models[modelOf(id)] = (d) => ({ ra, dec, w: w0 + rate * d });
    }

    return models;
};

/** Rotation models for the Kerbol bodies, keyed by model like `ROTATION_MODELS`. */
export const KERBOL_ROTATION = kerbolRotation();
