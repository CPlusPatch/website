import { DAY, deg, type Elements, km, type Vec3 } from "@cpluspatch/orbit";
import {
    type Body,
    bodyOrientation,
    j2Precession,
    type Model,
} from "@cpluspatch/sim";
import { PRESETS } from "./presets/index.ts";

// 2026-11-23 00:00 TDB is JD 2461367.5. The ~69 s from UTC is ignored, as in `orientation.ts`.
const EPOCH = (2461367.5 - 2451545.0) * DAY;

type Parent = "mars" | "moon" | "jupiter" | "sun";

type Probe = {
    id: string;
    name: string;
    parent: Parent;
    /** Eccentricity. */
    e: number;
    /** Inclination in degrees. */
    i: number;
    /** Longitude of the ascending node in degrees. */
    node: number;
    /** Argument of periapsis in degrees. */
    argp: number;
    /** Mean motion in degrees per second. */
    n: number;
    /** Mean anomaly in degrees. */
    m: number;
    /** The bounding radius of its model in the orrery, in m. */
    radius: number;
};

// Osculating elements at 2026-11-23 00:00 TDB, ecliptic J2000, about the parent's centre.
// Fetched from JPL Horizons on 2026-11-23, with <id> the Horizons id and <parent> the parent's id:
// https://ssd.jpl.nasa.gov/api/horizons.api?COMMAND='<id>'&EPHEM_TYPE='ELEMENTS'&CENTER='500@<parent>'&REF_PLANE='ECLIPTIC'&REF_SYSTEM='ICRF'&START_TIME='2026-11-23'&OUT_UNITS='KM-S'
// MAVEN, CAPSTONE and Tianwen-1 are left out: Horizons has no ephemeris for them at this date.
// Horizons ids: MRO -74, Mars Express -41, Odyssey -53, TGO -143, Hope -62, LRO -85,
// Chandrayaan-2 -152, Danuri -155, Juno -61, Parker -96, Solar Orbiter -144.
const PROBES: Probe[] = [
    {
        id: "mro",
        name: "MRO",
        parent: "mars",
        e: 8.220699760748991e-3,
        i: 8.253747214951682e1,
        node: 3.315230650664689e2,
        argp: 2.474579407178342e2,
        n: 5.344071942776321e-2,
        m: 1.041850228909853e2,
        radius: 7.6,
    },
    {
        id: "mars-express",
        name: "Mars Express",
        parent: "mars",
        e: 5.686720423241742e-1,
        i: 1.138550678918708e2,
        node: 8.555422012971958e1,
        argp: 5.973029261766103e1,
        n: 1.43145588198146e-2,
        m: 2.669840690702506e1,
        radius: 7.0,
    },
    {
        id: "mars-odyssey",
        name: "Mars Odyssey",
        parent: "mars",
        e: 8.911068632009068e-3,
        i: 8.317852057673458e1,
        node: 1.934366507240825e2,
        argp: 3.065494948206198e2,
        n: 5.069693275457881e-2,
        m: 2.179841229815442e2,
        radius: 5.6,
    },
    {
        id: "tgo",
        name: "TGO",
        parent: "mars",
        e: 4.241474686877857e-3,
        i: 6.158238778904379e1,
        node: 3.254641422590202e2,
        argp: 2.554824678068956e2,
        n: 5.115671361663326e-2,
        m: 3.455324785155294e2,
        radius: 9.4,
    },
    {
        id: "hope",
        name: "Hope",
        parent: "mars",
        e: 3.385378877014331e-1,
        i: 3.974874459965177e1,
        node: 1.202712838753323e2,
        argp: 2.364344783111673e2,
        n: 1.800268411148792e-3,
        m: 3.590641259080228e2,
        radius: 5.0,
    },
    {
        id: "lro",
        name: "LRO",
        parent: "moon",
        e: 1.314392492884733e-2,
        i: 8.289807674819197e1,
        node: 1.675550240054478e1,
        argp: 1.617430876686674e2,
        n: 5.135253060762546e-2,
        m: 3.027323492368843e2,
        radius: 3.5,
    },
    {
        id: "chandrayaan-2",
        name: "Chandrayaan-2",
        parent: "moon",
        e: 1.977526303633364e-2,
        i: 9.012697799811899e1,
        node: 2.874329287505579e2,
        argp: 3.304561551631276e2,
        n: 5.087247556960483e-2,
        m: 1.387050510557551e2,
        radius: 3.6,
    },
    {
        id: "danuri",
        name: "Danuri",
        parent: "moon",
        e: 4.314061906477479e-2,
        i: 8.81679759605943e1,
        node: 3.079292413436024e2,
        argp: 2.732330042092777e2,
        n: 4.966778108266254e-2,
        m: 6.496339844977224e1,
        radius: 4.3,
    },
    {
        id: "juno",
        name: "Juno",
        parent: "jupiter",
        e: 9.727855071514279e-1,
        i: 1.002734533628349e2,
        node: 2.935432196661826e2,
        argp: 1.02598323813354e2,
        n: 1.274519778533516e-4,
        m: 1.033059327911283e2,
        radius: 12.4,
    },
    {
        id: "parker-solar-probe",
        name: "Parker Solar Probe",
        parent: "sun",
        e: 8.820247580167645e-1,
        i: 3.391102369551876,
        node: 7.64815090638194e1,
        argp: 6.864143660637346e1,
        n: 4.712185418486895e-5,
        m: 3.232305375428312e2,
        radius: 2.6,
    },
    {
        id: "solar-orbiter",
        name: "Solar Orbiter",
        parent: "sun",
        e: 5.073129144660454e-1,
        i: 1.261795212300242e1,
        node: 3.223451521380741e2,
        argp: 3.063952646690736e2,
        n: 2.472668199064429e-5,
        m: 2.047260575089868e2,
        radius: 9.6,
    },
];

// The oblateness of each parent. The Sun's is ignored, so its probes keep fixed orbits.
const OBLATENESS: Record<
    Exclude<Parent, "sun">,
    { j2: number; radius: number }
> = {
    // MRO gravity model (MRO120), unnormalised -C20.
    mars: { j2: 1.9566e-3, radius: km(3396) },
    // GRAIL, GL0660B.
    moon: { j2: 2.033e-4, radius: km(1738) },
    // Juno, Iess et al. 2018.
    jupiter: { j2: 1.4696e-2, radius: km(71492) },
};

/** The pole of `parent` in ecliptic J2000. A missing rotation model throws. */
const poleOf = (parent: Model): Vec3 => {
    const orientation = bodyOrientation(PRESETS[parent]?.rotation, EPOCH);

    if (!orientation) {
        throw new Error(`${parent} has no rotation model`);
    }

    return orientation.z;
};

/**
 * Eleven spacecraft around Mars, the Moon, Jupiter and the Sun. Those around a planet or moon
 * have J2 precession. `mu` is each parent's gravitational parameter in the scenario.
 */
export const probes = (mu: Record<Parent, number>): Body[] =>
    PROBES.map(({ id, name, parent, e, i, node, argp, n, m, radius }) => {
        const rate = deg(n);
        const elements: Elements = {
            // The period comes from Horizons' mean motion, so a is chosen to match it for this mu.
            a: (mu[parent] / rate ** 2) ** (1 / 3),
            e,
            i: deg(i),
            raan: deg(node),
            argp: deg(argp),
            m0: deg(m),
            epoch: EPOCH,
        };

        const body: Body = {
            id,
            name,
            tags: ["spacecraft", "science"],
            mass: { mu: 0, radius },
            orbit: { parent, elements },
        };

        if (parent === "sun") {
            return body;
        }

        const { j2, radius: reference } = OBLATENESS[parent];

        return {
            ...body,
            perturbations: [
                {
                    type: "secular",
                    ...j2Precession(
                        elements,
                        mu[parent],
                        j2,
                        reference,
                        poleOf(parent),
                    ),
                },
            ],
        };
    });
