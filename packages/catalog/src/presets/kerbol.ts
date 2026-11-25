import { DAY, deg } from "@cpluspatch/orbit";
import type { UniformRotation } from "@cpluspatch/sim";

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

/** The phase `w0` in degrees and the `rate` in degrees per day of each tidally locked Kerbol body. */
export const KERBOL_LOCKED: Record<string, { w0: number; rate: number }> = {
    mun: { w0: 277.40282517223994, rate: 225.84939499116047 },
    ike: { w0: 277.40282517223994, rate: 489.1476395640759 },
    duna: { w0: 97.40282517223994, rate: 489.1476395640759 },
    laythe: { w0: 359.9087476710785, rate: 589.114666834843 },
    vall: { w0: 231.5662015617741, rate: 293.64670890233583 },
    tylo: { w0: 359.9087476710785, rate: 147.49997683584166 },
    bop: { w0: 266.5662015617741, rate: 57.12343859602285 },
    pol: { w0: 248.5662015617741, rate: 34.48713717360241 },
};

/** Degrees per day for a turn every `seconds`. */
const turnRate = (seconds: number): number => (360 * DAY) / seconds;

// KSP bodies have no axial tilt, so every pole is the ecliptic pole.
const uniform = (w0: number, ratePerDay: number): UniformRotation => ({
    type: "uniform",
    pole: { x: 0, y: 0, z: 1 },
    w0: deg(w0),
    rate: deg(ratePerDay) / DAY,
});

/** The rotation of each Kerbol body that has one. */
export const KERBOL_ROTATIONS: Record<string, UniformRotation> = {
    ...Object.fromEntries(
        Object.entries(KERBOL_DAYS).map(([id, seconds]) => [
            id,
            uniform(0, turnRate(seconds)),
        ]),
    ),
    ...Object.fromEntries(
        Object.entries(KERBOL_LOCKED).map(([id, { w0, rate }]) => [
            id,
            uniform(w0, rate),
        ]),
    ),
};
