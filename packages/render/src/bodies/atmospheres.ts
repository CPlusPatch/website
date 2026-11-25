/**
 * @module
 * The colours and heights of each body's atmosphere, and the numbers the shell shader takes from them.
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

/** Real heights, so the numbers can be checked against the sources. The colours are artistic. */
export const ATMOSPHERES: Readonly<Record<string, Atmosphere>> = {
    earth: {
        top: 100,
        day: "#4f9bff",
        twilight: "#ff7a3d",
        rim: 1,
        haze: 0.06,
    },
    venus: {
        top: 90,
        day: "#ffd27a",
        twilight: "#e88a45",
        rim: 1,
        haze: 0.08,
    },
    mars: {
        top: 80,
        day: "#d99a6c",
        twilight: "#6f9ad6",
        rim: 0.6,
        haze: 0.05,
    },
    titan: {
        top: 600,
        day: "#c08a40",
        twilight: "#b05a30",
        rim: 0.6,
        haze: 0.15,
    },
    jupiter: {
        top: 300,
        day: "#d8b890",
        twilight: "#a06840",
        rim: 0.5,
        haze: 0.03,
    },
    saturn: {
        top: 600,
        day: "#f6d98a",
        twilight: "#c89060",
        rim: 0.7,
        haze: 0.03,
    },
    uranus: {
        top: 300,
        day: "#3fc4e8",
        twilight: "#68bcd0",
        rim: 1,
        haze: 0.05,
    },
    neptune: {
        top: 250,
        day: "#6a9cff",
        twilight: "#4060d0",
        rim: 0.8,
        haze: 0.05,
    },
    pluto: {
        top: 200,
        day: "#b8b4e0",
        twilight: "#6080d0",
        rim: 0.4,
        haze: 0,
    },
    triton: {
        top: 50,
        day: "#d8c4e8",
        twilight: "#7090d0",
        rim: 0.3,
        haze: 0,
    },
    kerbin: {
        top: 70,
        day: "#4f9bff",
        twilight: "#ff7a3d",
        rim: 1,
        haze: 0.06,
    },
    eve: {
        top: 90,
        day: "#c070e0",
        twilight: "#ff6090",
        rim: 0.9,
        haze: 0.09,
    },
    duna: {
        top: 50,
        day: "#e08060",
        twilight: "#80a0e0",
        rim: 0.5,
        haze: 0.05,
    },
    laythe: {
        top: 50,
        day: "#4f9bff",
        twilight: "#ff7a3d",
        rim: 1,
        haze: 0.06,
    },
    jool: {
        top: 200,
        day: "#a0e070",
        twilight: "#509040",
        rim: 0.6,
        haze: 0.05,
    },
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
    model: string | undefined,
    radiusKm: number,
): Shell | null => {
    const atmosphere = model === undefined ? undefined : ATMOSPHERES[model];
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
