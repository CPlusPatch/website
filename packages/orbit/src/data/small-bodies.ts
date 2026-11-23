import { AU, DAY, G, km } from "../constants.ts";
import { wrapAngle } from "../kepler.ts";
import type { Body, BodyKind } from "../scenario.ts";

const deg = (x: number): number => (x * Math.PI) / 180;

// The SBDB epochs are TDB. The app's seconds are UTC-based, so they're ~69 s off, which is ignored.
const J2000_JD = 2451545.0;

type SbdbRow = {
    id: string;
    name: string;
    kind: BodyKind;
    /** Epoch as a TDB Julian date. */
    jd: number;
    /** Semi-major axis in au. */
    a: number;
    e: number;
    /** Inclination in degrees. */
    i: number;
    /** Longitude of the ascending node in degrees. */
    om: number;
    /** Argument of periapsis in degrees. */
    w: number;
    /** Mean anomaly in degrees. */
    ma: number;
    /** GM in m³/s². */
    mu: number;
    /** Mean radius in km. */
    radius: number;
};

// JPL Small-Body Database, heliocentric osculating elements in ecliptic and equinox J2000,
// fetched 2026-11-23 from https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=<name>&full-prec=1
// Epoch 2461200.5 TDB. The solutions are dated 2021-04-13 (Ceres, Vesta) and 2026-06-06 (others).
// Halley's epoch is 2439875.5 TDB, from the solution of 2025-11-21.
const ROWS: SbdbRow[] = [
    {
        id: "ceres",
        name: "Ceres",
        kind: "dwarf",
        jd: 2461200.5,
        a: 2.765552595034094,
        e: 0.07969229514816586,
        i: 10.58802780183462,
        om: 80.24862682043221,
        w: 73.29421453021587,
        ma: 274.4193463761342,
        // SBDB, from Park et al. 2016, Nature 537, 515: GM 62.6284 km³/s², diameter 939.4 km.
        mu: 62.6284e9,
        radius: 469.7,
    },
    {
        id: "eris",
        name: "Eris",
        kind: "dwarf",
        jd: 2461200.5,
        a: 67.93394687853566,
        e: 0.4382385347971672,
        i: 43.9258279471791,
        om: 36.00477044417249,
        w: 150.7949235840312,
        ma: 211.774434275007,
        // Mass from Holler et al. 2021, Icarus 355, 114130 (from Dysnomia's orbit).
        // Radius from Sicardy et al. 2011, Nature 478, 493.
        mu: G * 1.6466e22,
        radius: 1163,
    },
    {
        id: "haumea",
        name: "Haumea",
        kind: "dwarf",
        jd: 2461200.5,
        a: 43.06029023650952,
        e: 0.1944430148898797,
        i: 28.20847393040364,
        om: 121.7860561329425,
        w: 240.6905472508661,
        ma: 223.2104118812299,
        // Mass from Ragozzine & Brown 2009, AJ 137, 4766.
        // Radius is the volume-equivalent of the 1161 x 852 x 513 km semi-axes of
        // Ortiz et al. 2017, Nature 550, 219.
        mu: G * 4.006e21,
        radius: 798,
    },
    {
        id: "makemake",
        name: "Makemake",
        kind: "dwarf",
        jd: 2461200.5,
        a: 45.57093317300052,
        e: 0.1588889953992523,
        i: 29.02785603743067,
        om: 79.2948338209406,
        w: 297.0922733397207,
        ma: 169.9379962048232,
        // No reliable mass. Radius from Brown 2013, ApJL 767, L7.
        mu: 0,
        radius: 715,
    },
    {
        id: "vesta",
        name: "Vesta",
        kind: "asteroid",
        jd: 2461200.5,
        a: 2.361365965127599,
        e: 0.09020374382834395,
        i: 7.143925545058711,
        om: 103.701293265032,
        w: 151.4686478221564,
        ma: 81.19015607686903,
        // SBDB, from Park et al. 2025, Nat Astron, doi:10.1038/s41550-025-02533-7:
        // GM 17.2882844 km³/s², diameter 522.77 km.
        mu: 17.2882844e9,
        radius: 261.385,
    },
    {
        id: "halley",
        name: "Halley",
        kind: "comet",
        jd: 2439875.5,
        a: 17.92863504856923,
        e: 0.9679359956953211,
        i: 162.1905300439129,
        om: 59.09894720612437,
        w: 112.2414314637764,
        ma: 274.3823371366792,
        // SBDB, from Lamy et al. 2004, Comets II, 223: diameter 11.0 km. No reliable mass.
        mu: 0,
        radius: 5.5,
    },
];

/** Ceres, Eris, Haumea, Makemake, Vesta and Halley, around the Sun. */
export const smallBodies: Body[] = ROWS.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    parent: "sun",
    mu: row.mu,
    radius: km(row.radius),
    elements: {
        a: row.a * AU,
        e: row.e,
        i: deg(row.i),
        raan: wrapAngle(deg(row.om)),
        argp: wrapAngle(deg(row.w)),
        m0: wrapAngle(deg(row.ma)),
        epoch: (row.jd - J2000_JD) * DAY,
    },
}));
