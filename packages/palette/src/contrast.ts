/**
 * WCAG 2.x contrast, and solving a lightness for a target contrast.
 */

import { hex } from "./oklch.ts";

/** Relative luminance, straight from the WCAG 2.x definition. */
export const luminance = (hexColor: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const s = Number.parseInt(hexColor.slice(i, i + 2), 16) / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string): number => {
    const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
    return (hi + 0.05) / (lo + 0.05);
};

/**
 * Bisect lightness until the colour hits a target contrast against `against`.
 * `darker` picks which side of the background to search.
 */
export const solveLightness = (
    target: number,
    against: string,
    chroma: number,
    hue: number,
    darker: boolean,
): string => {
    // Lightness moves contrast monotonically once we know which side of the
    // background we are on, so a plain bisection is enough.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (contrast(hex(mid, chroma, hue), against) > target) {
            if (darker) lo = mid;
            else hi = mid;
        } else {
            if (darker) hi = mid;
            else lo = mid;
        }
    }
    // Bisection converges on the continuous answer, but the output is
    // quantised to 8 bits per channel and can land a hundredth under target.
    // Step away from the background until the *rounded* colour clears it.
    let l = darker ? lo : hi;
    for (
        let i = 0;
        i < 16 && contrast(hex(l, chroma, hue), against) < target;
        i++
    ) {
        l += darker ? -0.002 : 0.002;
    }
    return hex(l, chroma, hue);
};
