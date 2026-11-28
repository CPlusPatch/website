/*
 * The bench's Look: the theme, mode, style, spacing, radius and font size of
 * the stage frame and the compare copies. It never touches the bench page.
 * A frame reads each as a URL param (story-page.astro). This is the pure
 * part; bench-look.svelte draws it.
 */

import { OVERRIDES } from "@cpluspatch/ui/styles/overrides.ts";
import { STYLES } from "@cpluspatch/ui/styles/styles/index.ts";
import { THEMES } from "@cpluspatch/ui/styles/themes/index.ts";
import type { CompareMode } from "./compare.ts";

export interface Look {
    theme: string;
    scheme: string;
    style: string;
    spacing: string;
    radius: string;
    fontSize: string;
}

type Option = { value: string; label: string };

const overrideOptions = (name: string): Option[] => {
    const found = OVERRIDES.find((override) => override.name === name);
    if (!found) throw new Error(`No "${name}" override`);

    return found.options.map(({ value, label }) => ({ value, label }));
};

/** Each setting's options, the first being the default. */
export const LOOK_OPTIONS: Record<keyof Look, Option[]> = {
    theme: THEMES,
    scheme: overrideOptions("scheme"),
    style: STYLES,
    spacing: overrideOptions("override-spacing"),
    radius: overrideOptions("override-radius"),
    fontSize: overrideOptions("override-font-size"),
};

/** The URL param of each setting. */
const PARAMS: Record<keyof Look, string> = {
    theme: "theme",
    scheme: "scheme",
    style: "style",
    spacing: "spacing",
    radius: "radius",
    fontSize: "font-size",
};

const KEYS = Object.keys(LOOK_OPTIONS) as (keyof Look)[];

export const DEFAULT_LOOK: Look = Object.fromEntries(
    KEYS.map((key) => [key, (LOOK_OPTIONS[key][0] as Option).value]),
) as unknown as Look;

export const isDefaultLook = (look: Look): boolean =>
    KEYS.every((key) => look[key] === DEFAULT_LOOK[key]);

/** A saved look, as JSON text or an object, keeping only values it knows. */
export const parseLook = (saved: unknown): Look => {
    let data = saved;
    if (typeof data === "string") {
        try {
            data = JSON.parse(data);
        } catch {
            return { ...DEFAULT_LOOK };
        }
    }

    const record =
        typeof data === "object" && data !== null
            ? (data as Record<string, unknown>)
            : {};

    return Object.fromEntries(
        KEYS.map((key) => {
            const value = record[key];
            const known = LOOK_OPTIONS[key].some((o) => o.value === value);

            return [key, known ? value : DEFAULT_LOOK[key]];
        }),
    ) as unknown as Look;
};

/**
 * The URL params for a look, without the defaults. The schemes compare sets
 * each copy's scheme itself, so it takes none from the look.
 */
export const lookParams = (
    look: Look,
    compare: CompareMode,
): Record<string, string> =>
    Object.fromEntries(
        KEYS.filter(
            (key) =>
                look[key] !== DEFAULT_LOOK[key] &&
                !(key === "scheme" && compare === "schemes"),
        ).map((key) => [PARAMS[key], look[key]]),
    );
