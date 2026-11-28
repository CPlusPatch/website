/**
 * Palette config for the theme stylesheets in this directory.
 *
 *   deno run theme          write the tokens into each theme's stylesheet
 *                           and print a contrast audit
 *   deno run theme:check    fail if a stylesheet is out of date or a
 *                           contrast check fails (CI-safe)
 *
 * The palette is not a set of hand-picked colours; it is a *ladder*. Every
 * role (primary, destructive, ...) sits at the same OKLCH lightness and
 * differs only in hue. That is what makes contrast a property of the system
 * rather than something to re-audit per colour, and it is what lets a single
 * --color-on-accent work as the foreground for every filled surface.
 *
 * Editing the colour tokens by hand breaks that guarantee silently. Change
 * this file instead and re-run. The generator only touches --color-*
 * declarations between the palette:start and palette:end markers, rewriting
 * values in place so the stylesheets' comments survive. The engine itself
 * lives in packages/palette.
 */

import { definePalette, type Theme } from "@cpluspatch/palette";
import type { Tone } from "../../lib/tone.ts";

/** Hue angles in OKLCH degrees. Inherited from the original hand-picked brand. */
const HUES: Theme<Tone>["hues"] = {
    primary: 3.8, // pink
    secondary: 303.7, // violet
    destructive: 35, // red (was 27.3: read as a second pink next to primary in dark)
    // Burnt orange. Amber can't exist at the role tier's L 0.48: hue 70 read as
    // brown, and 84 and 91.9 before it as olive.
    warning: 58,
    success: 150, // green
};

export default definePalette<Tone>({
    /**
     * Lightness per tier, per scheme (see `Tier` for what each tier is for).
     *
     * Raising `role.light` or lowering `role.dark` is the single knob that
     * trades vividness for contrast. The audit fails when you went too far.
     */
    tiers: {
        role: { light: 0.48, dark: 0.76 },
        hover: { light: 0.4, dark: 0.83 },
        accent: { light: 0.72, dark: 0.66 },
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
     *
     * The cap was 0.19, which made dark success read as neon.
     */
    chroma: {
        ratio: { role: 0.9, hover: 1, accent: 0.85 },
        cap: 0.17,
    },

    overlays: {
        scanline: {
            light: "rgb(0 0 0 / 0.04)",
            dark: "rgb(255 255 255 / 0.035)",
        },
    },

    themes: [
        {
            name: "default",
            file: "default.css",
            hues: HUES,
            /**
             * Neutrals are specified directly rather than derived -- they are
             * tuned by eye for a warm paper light scheme and a warm charcoal
             * dark scheme. Warm, because the green-grey they replaced fought
             * the pink primary. All of them share hue 70, so text and borders
             * don't lean rose against the paper.
             *
             * The dark backgrounds keep C at 0.004: at low lightness even
             * 0.005 reads as a colour cast rather than as warmth. Dark bg
             * sits above near-black so pastel text glows less.
             */
            neutrals: {
                bg: { light: [0.972, 0.006, 70], dark: [0.18, 0.004, 70] },
                "bg-alt": {
                    light: [0.946, 0.009, 70],
                    dark: [0.215, 0.004, 70],
                },
                surface: {
                    light: [0.988, 0.004, 70],
                    dark: [0.24, 0.004, 70],
                },
                // One step above surface, for panels that sit on a surface
                // (cards in a surface-coloured container, terminals in cards).
                "surface-raised": {
                    light: [1, 0, 0],
                    dark: [0.275, 0.004, 70],
                },
                text: {
                    light: [0.22, 0.012, 70],
                    dark: [0.91, 0.006, 70],
                },
                "text-muted": {
                    light: [0.5, 0.013, 70],
                    dark: [0.69, 0.009, 70],
                },
            },
            /**
             * Borders are solved for a contrast ratio against --color-bg
             * rather than for a lightness, because the ratio is the thing
             * that matters.
             *
             * 2.0 is deliberately under the 3:1 of WCAG 1.4.11: --color-border
             * only ever outlines surfaces already distinguished by their
             * background. Anything where the border itself carries the
             * affordance (form controls) uses --color-border-strong at 3.0.
             */
            borders: {
                border: { ratio: 2.0, chroma: 0.01, hue: 70 },
                "border-strong": { ratio: 3.0, chroma: 0.01, hue: 70 },
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
