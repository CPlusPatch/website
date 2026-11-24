/**
 * OKLCH -> sRGB conversion and gamut mapping.
 */

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

const OKLAB_TO_LMS: Mat3 = [
    [1, 0.3963377774, 0.2158037573],
    [1, -0.1055613458, -0.0638541728],
    [1, -0.0894841775, -1.291485548],
];
const LMS_TO_RGB: Mat3 = [
    [4.0767416621, -3.3077115913, 0.2309699292],
    [-1.2684380046, 2.6097574011, -0.3413193965],
    [-0.0041960863, -0.7034186147, 1.707614701],
];

const mul = ([r0, r1, r2]: Mat3, [x, y, z]: Vec3): Vec3 => [
    r0[0] * x + r0[1] * y + r0[2] * z,
    r1[0] * x + r1[1] * y + r1[2] * z,
    r2[0] * x + r2[1] * y + r2[2] * z,
];

/** Linear-light sRGB, which may be out of [0, 1] if the colour is out of gamut. */
export const oklchToLinear = (l: number, c: number, h: number): number[] => {
    const rad = (h * Math.PI) / 180;
    const lms = mul(OKLAB_TO_LMS, [l, c * Math.cos(rad), c * Math.sin(rad)]);
    return mul(LMS_TO_RGB, [lms[0] ** 3, lms[1] ** 3, lms[2] ** 3]);
};

export const inGamut = (l: number, c: number, h: number) =>
    oklchToLinear(l, c, h).every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** Largest chroma that still fits in sRGB at this lightness and hue. */
export const maxChroma = (l: number, h: number): number => {
    let lo = 0;
    let hi = 0.5;
    for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut(l, mid, h)) lo = mid;
        else hi = mid;
    }
    return lo;
};

const encode = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;

/** `#rrggbb`, clipping anything out of gamut. */
export const hex = (l: number, c: number, h: number): string =>
    `#${oklchToLinear(l, c, h)
        .map((v) => Math.round(Math.min(1, Math.max(0, encode(v))) * 255))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
