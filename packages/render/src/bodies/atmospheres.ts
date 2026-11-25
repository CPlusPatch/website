/**
 * @module
 * An atmosphere's colours and height, and the numbers the shell shader takes from them.
 */

export type Atmosphere = {
    /** The height of the top of the glow, in km. */
    top: number;
    /** The colour of the lit air, as sRGB hex. */
    day: string;
    /** The colour of the air at the terminator, as sRGB hex. */
    twilight: string;
    /** How bright the rim is, from 0 to 1. */
    rim: number;
    /** How much of the glow lies over the middle of the disc, from 0 to 1. Thick for Venus and Titan. */
    haze: number;
};

/** Heights are drawn at this multiple, since real ones are a hairline at whole-disc zoom. */
export const EXAGGERATION = 2;

/** The thinnest shell, in body radii. Thinner, a giant's glow is a hard line a few pixels wide. */
export const MIN_TOP = 1.03;

/** The thickest shell, in body radii. Thicker, a small body's glow reads as a second disc. */
export const MAX_TOP = 1.15;

/** An atmosphere as the shell shader takes it. */
export type Shell = Omit<Atmosphere, "top"> & {
    /** The shell's radius, in body radii. */
    top: number;
};

/** The shell for a body's atmosphere, or null if it has none. */
export const shellFor = (
    atmosphere: Atmosphere | undefined,
    radiusKm: number,
): Shell | null => {
    if (!atmosphere) return null;

    const { top, day, twilight, rim, haze } = atmosphere;

    return {
        top: Math.min(
            Math.max(1 + (EXAGGERATION * top) / radiusKm, MIN_TOP),
            MAX_TOP,
        ),
        day,
        twilight,
        rim,
        haze,
    };
};
