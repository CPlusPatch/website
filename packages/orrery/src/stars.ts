/**
 * @module
 * The background stars: their packed file format and how they're drawn.
 */

import { OBLIQUITY_J2000, rotateEquatorialToEcliptic } from "@cpluspatch/orbit";

/** The spectral classes the sky tints by. */
export type SpectralClass = "O" | "B" | "A" | "F" | "G" | "K" | "M" | "other";

/** A star in equatorial J2000 coordinates, in radians. */
export type Star = {
    ra: number;
    dec: number;
    mag: number;
    class: SpectralClass;
};

const CLASSES: SpectralClass[] = ["O", "B", "A", "F", "G", "K", "M", "other"];

const STRIDE = 6;

/** Packs `stars` into 6 bytes each: RA, Dec, magnitude and class. */
export const encodeStars = (stars: Star[]): Uint8Array => {
    const bytes = new Uint8Array(stars.length * STRIDE);
    const view = new DataView(bytes.buffer);

    stars.forEach((star, i) => {
        const at = i * STRIDE;
        const ra = Math.round((star.ra / (2 * Math.PI)) * 65536) % 65536;
        view.setUint16(at, ra, true);
        view.setInt16(
            at + 2,
            Math.round((star.dec / (Math.PI / 2)) * 32767),
            true,
        );
        view.setUint8(at + 4, Math.round((star.mag + 2) * 20));
        view.setUint8(at + 5, CLASSES.indexOf(star.class));
    });

    return bytes;
};

/** The stars in `bytes`, as written by `encodeStars`. */
export const decodeStars = (bytes: Uint8Array): Star[] => {
    if (bytes.length % STRIDE !== 0) {
        throw new Error(
            `A star file is a multiple of ${STRIDE} bytes, not ${bytes.length}.`,
        );
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const stars: Star[] = [];
    for (let at = 0; at < bytes.length; at += STRIDE) {
        stars.push({
            ra: (view.getUint16(at, true) / 65536) * 2 * Math.PI,
            dec: (view.getInt16(at + 2, true) / 32767) * (Math.PI / 2),
            mag: view.getUint8(at + 4) / 20 - 2,
            class: CLASSES[view.getUint8(at + 5)] ?? "other",
        });
    }

    return stars;
};

/** The unit vectors of `stars` in the ecliptic frame, three floats each. */
export const starDirections = (stars: Star[]): Float32Array => {
    const out = new Float32Array(stars.length * 3);

    stars.forEach((star, i) => {
        const cosDec = Math.cos(star.dec);
        const v = rotateEquatorialToEcliptic({
            x: cosDec * Math.cos(star.ra),
            y: cosDec * Math.sin(star.ra),
            z: Math.sin(star.dec),
        });
        out.set([v.x, v.y, v.z], i * 3);
    });

    return out;
};

const clamp = (value: number, low: number, high: number): number =>
    Math.min(Math.max(value, low), high);

/** The diameter of a star's point in CSS px. */
export const starSize = (mag: number): number =>
    3 + 1.8 * Math.sqrt(clamp((6.5 - mag) / 8, 0, 1));

// Bigger points spread the same light over more pixels, so the peak is scaled down.
const PEAK = 0.5;

/** How bright the centre of a star's point is, from 0 to 0.5. */
export const starBrightness = (mag: number): number =>
    clamp(PEAK * 10 ** (-0.4 * (mag - 1)), PEAK * 0.12, PEAK);

/** The Milky Way texture coordinates of an ecliptic unit vector. */
export const skyUv = (direction: {
    x: number;
    y: number;
    z: number;
}): { u: number; v: number } => {
    // Must match MILKY_WAY_FRAGMENT in view/sky.ts.
    const cos = Math.cos(OBLIQUITY_J2000);
    const sin = Math.sin(OBLIQUITY_J2000);
    const x = direction.x;
    const y = direction.y * cos - direction.z * sin;
    const z = direction.y * sin + direction.z * cos;
    const ra = Math.atan2(y, x);
    const dec = Math.asin(clamp(z, -1, 1));
    const u = 0.5 - ra / (2 * Math.PI);

    return { u: u - Math.floor(u), v: 0.5 + dec / Math.PI };
};

/** The sRGB colour of each class, before the view mixes it toward white. */
export const STAR_TINTS: Record<SpectralClass, string> = {
    O: "#9bb0ff",
    B: "#aabfff",
    A: "#cad7ff",
    F: "#f8f7ff",
    G: "#fff4ea",
    K: "#ffd2a1",
    M: "#ffcc6f",
    other: "#ffffff",
};
