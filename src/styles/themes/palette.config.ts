/**
 * Palette config for the theme stylesheets in this directory.
 *
 *   deno run theme          print the token blocks + a contrast audit
 *   deno run theme:check    verify the theme files still match this file (CI-safe)
 *
 * The palette is not a set of hand-picked colours; it is a *ladder*. Every
 * role (primary, destructive, ...) sits at the same OKLCH lightness and
 * differs only in hue. That is what makes contrast a property of the system
 * rather than something to re-audit per colour, and it is what lets a single
 * --color-on-accent work as the foreground for every filled surface.
 *
 * Editing the colour tokens by hand breaks that guarantee silently. Change
 * this file instead, re-run, and paste the output back. The engine itself
 * lives in packages/palette.
 */

import { definePalette, type Theme } from "@web-ng/palette";
import type { Tone } from "../../lib/tone.ts";

/** Hue angles in OKLCH degrees. Inherited from the original hand-picked brand. */
const HUES: Theme<Tone>["hues"] = {
    primary: 3.8, // pink
    secondary: 303.7, // violet
    destructive: 27.3, // red
    warning: 84, // amber (was 91.9: read as olive/brown at the role tier)
    success: 152, // green
};

export default definePalette<Tone>({
    /**
     * Lightness per tier, per scheme (see `Tier` for what each tier is for).
     *
     * Raising `role.light` or lowering `role.dark` is the single knob that
     * trades vividness for contrast. The audit tells you when you went too far.
     */
    tiers: {
        role: { light: 0.45, dark: 0.78 },
        hover: { light: 0.37, dark: 0.84 },
        accent: { light: 0.72, dark: 0.7 },
    },

    /**
     * Taking the full in-gamut chroma makes hues that have lots of headroom
     * (violet) scream next to hues that have none (yellow at L=0.45), so back
     * off to a fraction of the maximum and cap the outliers. The result is a
     * palette that reads as one family.
     *
     * Hover is the exception and takes the full in-gamut chroma. At the hover
     * lightness (0.84 dark) there is very little chroma headroom, and backing
     * off further turns a pink button near-white on hover.
     */
    chroma: {
        ratio: { role: 0.9, hover: 1, accent: 0.9 },
        cap: 0.19,
    },

    overlays: {
        grid: { light: "rgb(0 0 0 / 0.04)", dark: "rgb(255 255 255 / 0.03)" },
        // Scanlines are their own token: reusing the grid colour made them invisible.
        scanline: {
            light: "rgb(0 0 0 / 0.07)",
            dark: "rgb(255 255 255 / 0.07)",
        },
    },

    themes: [
        {
            name: "default",
            file: "default.css",
            hues: HUES,
            /**
             * Neutrals are specified directly rather than derived -- they are
             * tuned by eye for the paper-ish light scheme and a flat dark
             * scheme.
             *
             * Note the dark backgrounds are achromatic (C = 0). At low
             * lightness even C = 0.005 reads as a colour cast rather than as
             * a warm/cool neutral. The dark *text* tones keep the 155 hue on
             * purpose: a slight tint there reads as warmth, not as a cast.
             */
            neutrals: {
                bg: { light: [0.9673, 0.0041, 157.2], dark: [0.1642, 0, 0] },
                "bg-alt": {
                    light: [0.9362, 0.0058, 153.8],
                    dark: [0.205, 0, 0],
                },
                surface: {
                    light: [0.9893, 0.0025, 165.1],
                    dark: [0.2297, 0, 0],
                },
                // One step above surface, for panels that sit on a surface
                // (cards in a surface-coloured container, terminals in cards).
                "surface-raised": { light: [1, 0, 0], dark: [0.2662, 0, 0] },
                text: {
                    light: [0.2056, 0.012, 156.0],
                    dark: [0.8795, 0.0084, 157.1],
                },
                "text-muted": {
                    light: [0.5061, 0.0116, 154.9],
                    dark: [0.6449, 0.0128, 153.5],
                },
            },
            /**
             * Borders are solved for a contrast ratio against --color-bg
             * rather than for a lightness, because the ratio is the thing
             * that matters.
             *
             * 2.2 is deliberately under the 3:1 of WCAG 1.4.11: --color-border
             * only ever outlines surfaces already distinguished by their
             * background. Anything where the border itself carries the
             * affordance (form controls) uses --color-border-strong at 3.0.
             */
            borders: {
                border: { ratio: 2.2, chroma: 0.0085, hue: 152 },
                "border-strong": { ratio: 3.0, chroma: 0.009, hue: 154 },
            },
        },
        {
            // An example second theme: blue and teal on navy-tinted neutrals.
            // Unlike the default, the dark backgrounds are tinted -- here the
            // cast is the point.
            name: "ocean",
            file: "ocean.css",
            hues: { ...HUES, primary: 250, secondary: 195 },
            neutrals: {
                bg: { light: [0.965, 0.008, 235], dark: [0.17, 0.02, 255] },
                "bg-alt": {
                    light: [0.93, 0.012, 235],
                    dark: [0.205, 0.024, 255],
                },
                surface: {
                    light: [0.985, 0.005, 235],
                    dark: [0.23, 0.027, 255],
                },
                "surface-raised": {
                    light: [1, 0, 0],
                    dark: [0.265, 0.03, 255],
                },
                text: { light: [0.22, 0.03, 250], dark: [0.89, 0.015, 235] },
                "text-muted": {
                    light: [0.5, 0.03, 245],
                    dark: [0.67, 0.025, 240],
                },
            },
            borders: {
                border: { ratio: 2.2, chroma: 0.015, hue: 240 },
                "border-strong": { ratio: 3.0, chroma: 0.016, hue: 240 },
            },
        },
    ],
});
