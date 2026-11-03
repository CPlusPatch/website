/**
 * The brand colour roles. Each one has a matching `.tone-*` class in
 * styles/utilities.css and a hue in styles/themes/palette.config.ts.
 */
export const TONES = [
    "primary",
    "secondary",
    "destructive",
    "warning",
    "success",
] as const;

export type Tone = (typeof TONES)[number];
