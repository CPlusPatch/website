import type { IauAngle, IauRotation } from "@cpluspatch/sim";

// E1 to E13 of the Moon (BODY3_NUT_PREC_ANGLES).
const MOON_ANGLES: IauAngle[] = [
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
const JUPITER_ANGLES: IauAngle[] = [
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
const SATURN_ANGLES: IauAngle[] = [
    [353.32, 75706.7],
    [28.72, 75706.7],
    [177.4, -36505.5],
    [300.0, -7225.9],
    [316.45, 506.2],
    [345.2, -1016.3],
];

// N7 of Neptune's system and its multiples 2 N7 to 9 N7 (BODY8_NUT_PREC_ANGLES).
const TRITON_ANGLES: IauAngle[] = Array.from(
    { length: 9 },
    (_, k): IauAngle => [177.85 * (k + 1), 52.316 * (k + 1)],
);

// M1 to M5 of Mars's system (BODY4_NUT_PREC_ANGLES).
const PHOBOS_ANGLES: IauAngle[] = [
    [190.72646643, 15917.10818695],
    [21.4689247, 31834.27934054],
    [332.86082793, 19139.89694742],
    [394.93256437, 38280.79631835],
    [189.6327156, 41215158.1842005, 12.711923222],
];

// IAU WGCCRE 2015 as in NAIF pck00011.tpc (Earth and Moon: its 2009 values):
// https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
// Linear terms only, except for the Moon, Neptune and the moons with a surface map (Jupiter's,
// Saturn's, Triton and Phobos have periodic terms). Mercury's and Jupiter's own periodic terms
// are under 0.02°, so they are skipped.
/** The IAU rotation of each solar system body that has one. */
export const IAU_ROTATIONS: Record<string, IauRotation> = {
    sun: {
        type: "iau",
        ra: { poly: [286.13] },
        dec: { poly: [63.87] },
        w: { poly: [84.176, 14.1844] },
    },
    mercury: {
        type: "iau",
        ra: { poly: [281.0103, -0.0328] },
        dec: { poly: [61.4155, -0.0049] },
        w: { poly: [329.5988, 6.1385108] },
    },
    venus: {
        type: "iau",
        ra: { poly: [272.76] },
        dec: { poly: [67.16] },
        w: { poly: [160.2, -1.4813688] },
    },
    earth: {
        type: "iau",
        ra: { poly: [0, -0.641] },
        dec: { poly: [90, -0.557] },
        w: { poly: [190.147, 360.9856235] },
    },
    // The 2015 periodic terms are ~700-century cycles that sum to this pole at J2000.
    mars: {
        type: "iau",
        ra: { poly: [317.68143, -0.1061] },
        dec: { poly: [52.8865, -0.0609] },
        w: { poly: [176.63, 350.89198226] },
    },
    jupiter: {
        type: "iau",
        ra: { poly: [268.056595, -0.006499] },
        dec: { poly: [64.495303, 0.002413] },
        w: { poly: [284.95, 870.536] },
    },
    saturn: {
        type: "iau",
        ra: { poly: [40.589, -0.036] },
        dec: { poly: [83.537, -0.004] },
        w: { poly: [38.9, 810.7939024] },
    },
    uranus: {
        type: "iau",
        ra: { poly: [257.311] },
        dec: { poly: [-15.175] },
        w: { poly: [203.81, -501.1600928] },
    },
    neptune: {
        type: "iau",
        ra: { poly: [299.36], periodic: [0.7] },
        dec: { poly: [43.46], periodic: [-0.51] },
        w: { poly: [249.978, 541.1397757], periodic: [-0.48] },
        angles: [[357.85, 52.316]],
    },
    pluto: {
        type: "iau",
        ra: { poly: [132.993] },
        dec: { poly: [-6.163] },
        w: { poly: [302.695, 56.3625225] },
    },
    // Periodic terms of the E angles.
    moon: {
        type: "iau",
        ra: { poly: [269.9949, 0.0031], periodic: MOON_RA },
        dec: { poly: [66.5392, 0.013], periodic: MOON_DEC },
        w: { poly: [38.3213, 13.17635815, -1.4e-12], periodic: MOON_PM },
        angles: MOON_ANGLES,
    },
    // Jupiter's moons: periodic terms of the J angles.
    io: {
        type: "iau",
        ra: { poly: [268.05, -0.009], periodic: [0, 0, 0.094, 0.024] },
        dec: { poly: [64.5, 0.003], periodic: [0, 0, 0.04, 0.011] },
        w: { poly: [200.39, 203.4889538], periodic: [0, 0, -0.085, -0.022] },
        angles: JUPITER_ANGLES,
    },
    europa: {
        type: "iau",
        ra: {
            poly: [268.08, -0.009],
            periodic: [0, 0, 0, 1.086, 0.06, 0.015, 0.009],
        },
        dec: {
            poly: [64.51, 0.003],
            periodic: [0, 0, 0, 0.468, 0.026, 0.007, 0.002],
        },
        w: {
            poly: [36.022, 101.3747235],
            periodic: [0, 0, 0, -0.98, -0.054, -0.014, -0.008],
        },
        angles: JUPITER_ANGLES,
    },
    ganymede: {
        type: "iau",
        ra: {
            poly: [268.2, -0.009],
            periodic: [0, 0, 0, -0.037, 0.431, 0.091],
        },
        dec: {
            poly: [64.57, 0.003],
            periodic: [0, 0, 0, -0.016, 0.186, 0.039],
        },
        w: {
            poly: [44.064, 50.3176081],
            periodic: [0, 0, 0, 0.033, -0.389, -0.082],
        },
        angles: JUPITER_ANGLES,
    },
    callisto: {
        type: "iau",
        ra: {
            poly: [268.72, -0.009],
            periodic: [0, 0, 0, 0, -0.068, 0.59, 0, 0.01],
        },
        dec: {
            poly: [64.83, 0.003],
            periodic: [0, 0, 0, 0, -0.029, 0.254, 0, -0.004],
        },
        w: {
            poly: [259.51, 21.5710715],
            periodic: [0, 0, 0, 0, 0.061, -0.533, 0, -0.009],
        },
        angles: JUPITER_ANGLES,
    },
    // Saturn's moons: periodic terms of the S angles.
    mimas: {
        type: "iau",
        ra: { poly: [40.66, -0.036], periodic: [0, 0, 13.56] },
        dec: { poly: [83.52, -0.004], periodic: [0, 0, -1.53] },
        w: { poly: [333.46, 381.994555], periodic: [0, 0, -13.48, 0, -44.85] },
        angles: SATURN_ANGLES,
    },
    enceladus: {
        type: "iau",
        ra: { poly: [40.66, -0.036] },
        dec: { poly: [83.52, -0.004] },
        w: { poly: [6.32, 262.7318996] },
    },
    tethys: {
        type: "iau",
        ra: { poly: [40.66, -0.036], periodic: [0, 0, 0, 9.66] },
        dec: { poly: [83.52, -0.004], periodic: [0, 0, 0, -1.09] },
        w: { poly: [8.95, 190.6979085], periodic: [0, 0, 0, -9.6, 2.23] },
        angles: SATURN_ANGLES,
    },
    dione: {
        type: "iau",
        ra: { poly: [40.66, -0.036] },
        dec: { poly: [83.52, -0.004] },
        w: { poly: [357.6, 131.5349316] },
    },
    rhea: {
        type: "iau",
        ra: { poly: [40.38, -0.036], periodic: [0, 0, 0, 0, 0, 3.1] },
        dec: { poly: [83.55, -0.004], periodic: [0, 0, 0, 0, 0, -0.35] },
        w: { poly: [235.16, 79.6900478], periodic: [0, 0, 0, 0, 0, -3.08] },
        angles: SATURN_ANGLES,
    },
    iapetus: {
        type: "iau",
        ra: { poly: [318.16, -3.949] },
        dec: { poly: [75.03, -1.143] },
        w: { poly: [355.2, 4.5379572] },
    },
    // Triton: periodic terms of N7 and its multiples.
    triton: {
        type: "iau",
        ra: {
            poly: [299.36],
            periodic: [
                -32.35, -6.28, -2.08, -0.74, -0.28, -0.11, -0.07, -0.02, -0.01,
            ],
        },
        dec: {
            poly: [41.17],
            periodic: [22.55, 2.1, 0.55, 0.16, 0.05, 0.02, 0.01],
        },
        w: {
            poly: [296.53, -61.2572637],
            periodic: [22.25, 6.73, 2.05, 0.74, 0.28, 0.11, 0.05, 0.02, 0.01],
        },
        angles: TRITON_ANGLES,
    },
    // Phobos: periodic terms of the M angles.
    phobos: {
        type: "iau",
        ra: {
            poly: [317.67071657, -0.10844326],
            periodic: [-1.78428399, 0.02212824, -0.01028251, -0.00475595],
        },
        dec: {
            poly: [52.88627266, -0.06134706],
            periodic: [-1.07516537, 0.00668626, -0.0064874, 0.00281576],
        },
        w: {
            poly: [35.1877444, 1128.84475928, 9.536137031212154e-9],
            periodic: [1.42421769, -0.02273783, 0.00410711, 0.00631964, -1.143],
        },
        angles: PHOBOS_ANGLES,
    },
    charon: {
        type: "iau",
        ra: { poly: [132.993] },
        dec: { poly: [-6.163] },
        w: { poly: [122.695, 56.3625225] },
    },
    ceres: {
        type: "iau",
        ra: { poly: [291.418] },
        dec: { poly: [66.764] },
        w: { poly: [170.65, 952.1532] },
    },
    vesta: {
        type: "iau",
        ra: { poly: [309.031] },
        dec: { poly: [42.235] },
        w: { poly: [285.39, 1617.3329428] },
    },
};
