import type { RotationModel } from "../orientation.ts";

const rad = (x: number): number => (x * Math.PI) / 180;

// E1 to E13 of the Moon: [constant, rate per Julian century] in degrees (BODY3_NUT_PREC_ANGLES).
const MOON_ANGLES: [number, number][] = [
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

/** The sum of `coefficients[k] * trig(E_k)` over the Moon's angles, in degrees. */
const moonSeries = (
    coefficients: number[],
    trig: (x: number) => number,
    T: number,
): number =>
    MOON_ANGLES.reduce(
        (sum, [e0, rate], k) =>
            sum + coefficients[k] * trig(rad(e0 + rate * T)),
        0,
    );

// IAU WGCCRE 2015 as in NAIF pck00011.tpc (Earth and Moon: its 2009 values):
// https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
// Linear terms only, except for the Moon and Neptune. Mercury's and Jupiter's periodic terms
// are under 0.02°, so they are skipped.
/** The rotation model of each body in `solarSystem` that has one, by body id. */
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
            ra: 269.9949 + 0.0031 * T + moonSeries(MOON_RA, Math.sin, T),
            dec: 66.5392 + 0.013 * T + moonSeries(MOON_DEC, Math.cos, T),
            w:
                38.3213 +
                13.17635815 * d -
                1.4e-12 * d * d +
                moonSeries(MOON_PM, Math.sin, T),
        };
    },
};
