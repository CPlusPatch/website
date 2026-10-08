/**
 * A small palette for the tests, shaped like the site's.
 */

import type { PaletteConfig, Theme } from "./types.ts";

export const theme: Theme<"primary" | "warning"> = {
    name: "test",
    file: "test.css",
    hues: { primary: 3.8, warning: 84 },
    neutrals: {
        bg: { light: [0.9673, 0.0041, 157.2], dark: [0.1642, 0, 0] },
        "bg-alt": { light: [0.9362, 0.0058, 153.8], dark: [0.205, 0, 0] },
        surface: { light: [0.9893, 0.0025, 165.1], dark: [0.2297, 0, 0] },
        "surface-raised": { light: [1, 0, 0], dark: [0.2662, 0, 0] },
        text: { light: [0.2056, 0.012, 156], dark: [0.8795, 0.0084, 157.1] },
        "text-muted": {
            light: [0.5061, 0.0116, 154.9],
            dark: [0.6449, 0.0128, 153.5],
        },
    },
    borders: {
        border: { ratio: 2.2, chroma: 0.0085, hue: 152 },
        "border-strong": { ratio: 3, chroma: 0.009, hue: 154 },
    },
};

export const palette: PaletteConfig<"primary" | "warning"> = {
    tiers: {
        role: { light: 0.45, dark: 0.78 },
        hover: { light: 0.37, dark: 0.84 },
        accent: { light: 0.72, dark: 0.7 },
    },
    chroma: { ratio: { role: 0.9, hover: 1, accent: 0.9 }, cap: 0.19 },
    overlays: { grid: { light: "rgb(0 0 0 / 0.04)", dark: "transparent" } },
    themes: [theme],
};
