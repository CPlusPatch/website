/**
 * Rendering tokens as CSS, and comparing them against an existing stylesheet.
 */

import type { Tokens } from "./generate.ts";

/** Custom property name -> rendered `light-dark()` value. */
export const toDeclarations = (tokens: Tokens): [string, string][] =>
    [...tokens].map(([name, { light, dark }]) => [
        `--color-${name}`,
        `light-dark(${light}, ${dark})`,
    ]);

/** The block to paste into a theme's stylesheet. */
export const formatBlock = (tokens: Tokens): string =>
    toDeclarations(tokens)
        .map(([name, value]) => `\t${name}: ${value};`)
        .join("\n");

/** Declarations that are missing from `css`, or whose value differs. */
export const findDrift = (css: string, tokens: Tokens): [string, string][] =>
    toDeclarations(tokens).filter(([name, value]) => {
        const m = css.match(new RegExp(`^\\s*${name}:\\s*(.+);`, "m"));
        return !m || m[1].trim() !== value;
    });
