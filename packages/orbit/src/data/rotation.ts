import type { RotationModel } from "../orientation.ts";
import { KERBOL_ROTATION } from "./fiction.ts";

const rad = (x: number): number => (x * Math.PI) / 180;

/** [constant, rate per Julian century, rate per century squared] in degrees. */
type Angle = [number, number, number?];

// E1 to E13 of the Moon (BODY3_NUT_PREC_ANGLES).
const MOON_ANGLES: Angle[] = [
    [125.045, -1935.5364525],
    [250.089, -3871.072905],
    [260.008, 475263.3328725],
    [176.625, 487269.629985],
    [357.529, 35999.0509575],
    [311.589, 964468.49931],
    [134.963, 477198.869325],
    [276.617, 12006.300765],
    [34.226, 63863.5132425],
    [15.134, -5806.6093575],
    [119.743, 131.84064],
    [239.961, 6003.1503825],
    [25.053, 473327.79642],
];

// Periodic terms of the Moon in degrees, one per angle (BODY301_NUT_PREC_*).
const MOON_RA = [
    -3.8787, -0.1204, 0.07, -0.0172, 0, 0.0072, 0, 0, 0, -0.0052, 0, 0, 0.0043,
];
const MOON_DEC = [
    1.5419, 0.0239, -0.0278, 0.0068, 0, -0.0029, 0.0009, 0, 0, 0.0008, 0, 0,
    -0.0009,
];
const MOON_PM = [
    3.561, 0.1208, -0.0642, 0.0158, 0.0252, -0.0066, -0.0047, -0.0046, 0.0028,
    0.0052, 0.004, 0.0019, -0.0044,
];

// J1 to J8 of Jupiter's system (BODY5_NUT_PREC_ANGLES).
const JUPITER_ANGLES: Angle[] = [
    [73.32, 91472.9],
    [24.62, 45137.2],
    [283.9, 4850.7],
    [355.8, 1191.3],
    [119.9, 262.1],
    [229.8, 64.3],
    [352.25, 2382.6],
    [113.35, 6070.0],
];

// S1 to S6 of Saturn's system (BODY6_NUT_PREC_ANGLES).
const SATURN_ANGLES: Angle[] = [
    [353.32, 75706.7],
    [28.72, 75706.7],
    [177.4, -36505.5],
    [300.0, -7225.9],
    [316.45, 506.2],
    [345.2, -1016.3],
];

// N7 of Neptune's system and its multiples 2 N7 to 9 N7 (BODY8_NUT_PREC_ANGLES).
const TRITON_ANGLES: Angle[] = Array.from({ length: 9 }, (_, k) => [
    177.85 * (k + 1),
    52.316 * (k + 1),
]);

// M1 to M5 of Mars's system (BODY4_NUT_PREC_ANGLES).
const PHOBOS_ANGLES: Angle[] = [
    [190.72646643, 15917.10818695],
    [21.4689247, 31834.27934054],
    [332.86082793, 19139.89694742],
    [394.93256437, 38280.79631835],
    [189.6327156, 41215158.1842005, 12.711923222],
];

/** The sum of `coefficients[k] * trig(angles[k])` at `T` Julian centuries, in degrees. */
const series = (
    angles: Angle[],
    coefficients: number[],
    trig: (x: number) => number,
    T: number,
): number =>
    angles.reduce(
        (sum, [e0, rate, quadratic = 0], k) =>
            sum +
            (coefficients[k] ?? 0) *
                trig(rad(e0 + rate * T + quadratic * T * T)),
        0,
    );

// IAU WGCCRE 2015 as in NAIF pck00011.tpc (Earth and Moon: its 2009 values):
// https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
// Linear terms only, except for the Moon, Neptune and the moons with a surface map (Jupiter's,
// Saturn's, Triton and Phobos have periodic terms). Mercury's and Jupiter's own periodic terms
// are under 0.02°, so they are skipped.
/** The rotation model of each body in `solarSystem` that has one, and of the Kerbol bodies, by body id. */
export const ROTATION_MODELS: Record<string, RotationModel> = {
    sun: (d) => ({ ra: 286.13, dec: 63.87, w: 84.176 + 14.1844 * d }),
    mercury: (d) => {
        const T = d / 36525;

        return {
            ra: 281.0103 - 0.0328 * T,
            dec: 61.4155 - 0.0049 * T,
            w: 329.5988 + 6.1385108 * d,
        };
    },
    venus: (d) => ({ ra: 272.76, dec: 67.16, w: 160.2 - 1.4813688 * d }),
    earth: (d) => {
        const T = d / 36525;

        return {
            ra: -0.641 * T,
            dec: 90 - 0.557 * T,
            w: 190.147 + 360.9856235 * d,
        };
    },
    // The 2015 periodic terms are ~700-century cycles that sum to this pole at J2000.
    mars: (d) => {
        const T = d / 36525;

        return {
            ra: 317.68143 - 0.1061 * T,
            dec: 52.8865 - 0.0609 * T,
            w: 176.63 + 350.89198226 * d,
        };
    },
    jupiter: (d) => {
        const T = d / 36525;

        return {
            ra: 268.056595 - 0.006499 * T,
            dec: 64.495303 + 0.002413 * T,
            w: 284.95 + 870.536 * d,
        };
    },
    saturn: (d) => {
        const T = d / 36525;

        return {
            ra: 40.589 - 0.036 * T,
            dec: 83.537 - 0.004 * T,
            w: 38.9 + 810.7939024 * d,
        };
    },
    uranus: (d) => ({ ra: 257.311, dec: -15.175, w: 203.81 - 501.1600928 * d }),
    neptune: (d) => {
        const T = d / 36525;
        const N = rad(357.85 + 52.316 * T);

        return {
            ra: 299.36 + 0.7 * Math.sin(N),
            dec: 43.46 - 0.51 * Math.cos(N),
            w: 249.978 + 541.1397757 * d - 0.48 * Math.sin(N),
        };
    },
    pluto: (d) => ({ ra: 132.993, dec: -6.163, w: 302.695 + 56.3625225 * d }),
    moon: (d) => {
        const T = d / 36525;

        return {
            ra:
                269.9949 +
                0.0031 * T +
                series(MOON_ANGLES, MOON_RA, Math.sin, T),
            dec:
                66.5392 +
                0.013 * T +
                series(MOON_ANGLES, MOON_DEC, Math.cos, T),
            w:
                38.3213 +
                13.17635815 * d -
                1.4e-12 * d * d +
                series(MOON_ANGLES, MOON_PM, Math.sin, T),
        };
    },
    // Jupiter's moons: periodic terms of the J angles.
    io: (d) => {
        const T = d / 36525;

        return {
            ra:
                268.05 -
                0.009 * T +
                series(JUPITER_ANGLES, [0, 0, 0.094, 0.024], Math.sin, T),
            dec:
                64.5 +
                0.003 * T +
                series(JUPITER_ANGLES, [0, 0, 0.04, 0.011], Math.cos, T),
            w:
                200.39 +
                203.4889538 * d +
                series(JUPITER_ANGLES, [0, 0, -0.085, -0.022], Math.sin, T),
        };
    },
    europa: (d) => {
        const T = d / 36525;

        return {
            ra:
                268.08 -
                0.009 * T +
                series(
                    JUPITER_ANGLES,
                    [0, 0, 0, 1.086, 0.06, 0.015, 0.009],
                    Math.sin,
                    T,
                ),
            dec:
                64.51 +
                0.003 * T +
                series(
                    JUPITER_ANGLES,
                    [0, 0, 0, 0.468, 0.026, 0.007, 0.002],
                    Math.cos,
                    T,
                ),
            w:
                36.022 +
                101.3747235 * d +
                series(
                    JUPITER_ANGLES,
                    [0, 0, 0, -0.98, -0.054, -0.014, -0.008],
                    Math.sin,
                    T,
                ),
        };
    },
    ganymede: (d) => {
        const T = d / 36525;

        return {
            ra:
                268.2 -
                0.009 * T +
                series(
                    JUPITER_ANGLES,
                    [0, 0, 0, -0.037, 0.431, 0.091],
                    Math.sin,
                    T,
                ),
            dec:
                64.57 +
                0.003 * T +
                series(
                    JUPITER_ANGLES,
                    [0, 0, 0, -0.016, 0.186, 0.039],
                    Math.cos,
                    T,
                ),
            w:
                44.064 +
                50.3176081 * d +
                series(
                    JUPITER_ANGLES,
                    [0, 0, 0, 0.033, -0.389, -0.082],
                    Math.sin,
                    T,
                ),
        };
    },
    callisto: (d) => {
        const T = d / 36525;

        return {
            ra:
                268.72 -
                0.009 * T +
                series(
                    JUPITER_ANGLES,
                    [0, 0, 0, 0, -0.068, 0.59, 0, 0.01],
                    Math.sin,
                    T,
                ),
            dec:
                64.83 +
                0.003 * T +
                series(
                    JUPITER_ANGLES,
                    [0, 0, 0, 0, -0.029, 0.254, 0, -0.004],
                    Math.cos,
                    T,
                ),
            w:
                259.51 +
                21.5710715 * d +
                series(
                    JUPITER_ANGLES,
                    [0, 0, 0, 0, 0.061, -0.533, 0, -0.009],
                    Math.sin,
                    T,
                ),
        };
    },
    // Saturn's moons: periodic terms of the S angles.
    mimas: (d) => {
        const T = d / 36525;

        return {
            ra:
                40.66 -
                0.036 * T +
                series(SATURN_ANGLES, [0, 0, 13.56], Math.sin, T),
            dec:
                83.52 -
                0.004 * T +
                series(SATURN_ANGLES, [0, 0, -1.53], Math.cos, T),
            w:
                333.46 +
                381.994555 * d +
                series(SATURN_ANGLES, [0, 0, -13.48, 0, -44.85], Math.sin, T),
        };
    },
    enceladus: (d) => {
        const T = d / 36525;

        return {
            ra: 40.66 - 0.036 * T,
            dec: 83.52 - 0.004 * T,
            w: 6.32 + 262.7318996 * d,
        };
    },
    tethys: (d) => {
        const T = d / 36525;

        return {
            ra:
                40.66 -
                0.036 * T +
                series(SATURN_ANGLES, [0, 0, 0, 9.66], Math.sin, T),
            dec:
                83.52 -
                0.004 * T +
                series(SATURN_ANGLES, [0, 0, 0, -1.09], Math.cos, T),
            w:
                8.95 +
                190.6979085 * d +
                series(SATURN_ANGLES, [0, 0, 0, -9.6, 2.23], Math.sin, T),
        };
    },
    dione: (d) => {
        const T = d / 36525;

        return {
            ra: 40.66 - 0.036 * T,
            dec: 83.52 - 0.004 * T,
            w: 357.6 + 131.5349316 * d,
        };
    },
    rhea: (d) => {
        const T = d / 36525;

        return {
            ra:
                40.38 -
                0.036 * T +
                series(SATURN_ANGLES, [0, 0, 0, 0, 0, 3.1], Math.sin, T),
            dec:
                83.55 -
                0.004 * T +
                series(SATURN_ANGLES, [0, 0, 0, 0, 0, -0.35], Math.cos, T),
            w:
                235.16 +
                79.6900478 * d +
                series(SATURN_ANGLES, [0, 0, 0, 0, 0, -3.08], Math.sin, T),
        };
    },
    iapetus: (d) => {
        const T = d / 36525;

        return {
            ra: 318.16 - 3.949 * T,
            dec: 75.03 - 1.143 * T,
            w: 355.2 + 4.5379572 * d,
        };
    },
    // Triton: periodic terms of N7 and its multiples.
    triton: (d) => {
        const T = d / 36525;

        return {
            ra:
                299.36 +
                series(
                    TRITON_ANGLES,
                    [
                        -32.35, -6.28, -2.08, -0.74, -0.28, -0.11, -0.07, -0.02,
                        -0.01,
                    ],
                    Math.sin,
                    T,
                ),
            dec:
                41.17 +
                series(
                    TRITON_ANGLES,
                    [22.55, 2.1, 0.55, 0.16, 0.05, 0.02, 0.01],
                    Math.cos,
                    T,
                ),
            w:
                296.53 -
                61.2572637 * d +
                series(
                    TRITON_ANGLES,
                    [22.25, 6.73, 2.05, 0.74, 0.28, 0.11, 0.05, 0.02, 0.01],
                    Math.sin,
                    T,
                ),
        };
    },
    // Phobos: periodic terms of the M angles.
    phobos: (d) => {
        const T = d / 36525;

        return {
            ra:
                317.67071657 -
                0.10844326 * T +
                series(
                    PHOBOS_ANGLES,
                    [-1.78428399, 0.02212824, -0.01028251, -0.00475595],
                    Math.sin,
                    T,
                ),
            dec:
                52.88627266 -
                0.06134706 * T +
                series(
                    PHOBOS_ANGLES,
                    [-1.07516537, 0.00668626, -0.0064874, 0.00281576],
                    Math.cos,
                    T,
                ),
            w:
                35.1877444 +
                1128.84475928 * d +
                9.536137031212154e-9 * d * d +
                series(
                    PHOBOS_ANGLES,
                    [1.42421769, -0.02273783, 0.00410711, 0.00631964, -1.143],
                    Math.sin,
                    T,
                ),
        };
    },
    charon: (d) => ({ ra: 132.993, dec: -6.163, w: 122.695 + 56.3625225 * d }),
    ceres: (d) => ({ ra: 291.418, dec: 66.764, w: 170.65 + 952.1532 * d }),
    vesta: (d) => ({ ra: 309.031, dec: 42.235, w: 285.39 + 1617.3329428 * d }),
    ...KERBOL_ROTATION,
};
