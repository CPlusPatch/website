/**
 * Theme config -> colour tokens.
 */

import { solveLightness } from "./contrast.ts";
import { hex, maxChroma } from "./oklch.ts";
import type { Pair, PaletteConfig, Scheme, Theme, Tier } from "./types.ts";

/**
 * Token name (without the `--color-` prefix) -> value, in the order a new
 * stylesheet should list them.
 */
export type Tokens = Map<string, Pair>;

const bySchemes = (fn: (s: Scheme) => string): Pair => ({
    light: fn("light"),
    dark: fn("dark"),
});

export const generate = (
    { hues, neutrals, borders }: Theme,
    { tiers, chroma, overlays }: PaletteConfig,
): Tokens => {
    const tokens: Tokens = new Map();

    /** A role colour: fixed lightness for the tier, hue for the role, chroma per policy. */
    const roleTier = (tier: Tier, hue: number) =>
        bySchemes((s) => {
            const l = tiers[tier][s];
            const c = chroma.ratio[tier] * maxChroma(l, hue);
            return hex(l, Math.min(chroma.cap, c), hue);
        });

    for (const [name, spec] of Object.entries(neutrals)) {
        tokens.set(
            name,
            bySchemes((s) => hex(...spec[s])),
        );
    }

    // Backgrounds have to exist before borders can be solved against them.
    const bgOf = (s: Scheme) => hex(...neutrals.bg[s]);
    for (const [name, spec] of Object.entries(borders)) {
        tokens.set(
            name,
            bySchemes((s) =>
                solveLightness(
                    spec.ratio,
                    bgOf(s),
                    spec.chroma,
                    spec.hue,
                    s === "light",
                ),
            ),
        );
    }

    for (const [name, value] of Object.entries(overlays)) {
        tokens.set(name, value);
    }

    // Roles are walked twice so the stylesheet reads usable tier, then its
    // foreground, then the decoration-only tier -- not role by role.
    for (const [name, hue] of Object.entries<number>(hues)) {
        tokens.set(name, roleTier("role", hue));
        tokens.set(`${name}-hover`, roleTier("hover", hue));
    }

    // One foreground for every filled surface -- valid precisely because the
    // role tier shares a lightness. If you break that invariant, this breaks too.
    tokens.set("on-accent", bySchemes(bgOf));

    for (const [name, hue] of Object.entries<number>(hues)) {
        tokens.set(`${name}-accent`, roleTier("accent", hue));
    }

    return tokens;
};
