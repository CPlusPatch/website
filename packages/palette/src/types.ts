export type Scheme = "light" | "dark";
export const SCHEMES: readonly Scheme[] = ["light", "dark"];

/** One value per colour scheme, emitted as `light-dark(light, dark)`. */
export type PerScheme<T> = Record<Scheme, T>;

/** A finished token: a CSS colour per scheme. */
export type Pair = PerScheme<string>;

/** An OKLCH colour as [lightness, chroma, hue in degrees]. */
export type Lch = readonly [number, number, number];

/**
 * The lightness tiers every role colour is generated at.
 *
 *   role    text and fills -- must stay dark enough (light) / light enough
 *           (dark) to clear 4.5:1 against --color-bg.
 *   hover   the same tier, pushed one step further from the background.
 *   accent  decoration ONLY: borders, rules, the offset shadow. ~2:1, so it
 *           must never carry text or a meaning-bearing icon.
 */
export type Tier = "role" | "hover" | "accent";

export interface ChromaPolicy {
    /** Fraction of the in-gamut maximum chroma to take, per tier. */
    ratio: Record<Tier, number>;
    /** Absolute ceiling, so high-headroom hues don't outshout the rest. */
    cap: number;
}

export type NeutralName =
    | "bg"
    | "bg-alt"
    | "surface"
    | "surface-raised"
    | "text"
    | "text-muted";

export type BorderName = "border" | "border-strong";

/** A border is solved for a contrast ratio against --color-bg, not a lightness. */
export interface BorderSpec {
    ratio: number;
    chroma: number;
    hue: number;
}

/**
 * What a theme may change. Tiers and the chroma policy live on the palette
 * instead, on purpose: they are what keeps every theme's role colours at the
 * same contrast, so a theme only picks hues and neutrals.
 */
export interface Theme<Role extends string = string> {
    name: string;
    /** The stylesheet holding this theme's tokens, relative to the config file. */
    file: string;
    /** Hue angle (OKLCH degrees) per role. */
    hues: Record<Role, number>;
    neutrals: Record<NeutralName, PerScheme<Lch>>;
    borders: Record<BorderName, BorderSpec>;
}

export interface PaletteConfig<Role extends string = string> {
    tiers: Record<Tier, PerScheme<number>>;
    chroma: ChromaPolicy;
    /** Fixed tokens emitted verbatim, identical across themes. */
    overlays: Record<string, Pair>;
    /** The first theme is the default; the others override it. */
    themes: Theme<Role>[];
}

/** Identity helper, so a config file gets type checking and inference. */
export const definePalette = <Role extends string>(
    config: PaletteConfig<Role>,
): PaletteConfig<Role> => config;
