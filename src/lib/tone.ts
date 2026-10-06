/**
 * The brand colour roles. Each one has a matching `.tone-*` class in
 * utilities.css and a hue in scripts/generate-theme.ts.
 */
export const TONES = [
    "primary",
    "secondary",
    "destructive",
    "warning",
    "success",
] as const;

export type Tone = (typeof TONES)[number];
