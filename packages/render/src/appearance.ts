/**
 * @module
 * The look of a body that the scenario stores as opaque `appearance`.
 */

import type { AppearanceValidator, Body } from "@cpluspatch/sim";

/** The renderer's view of `Body.appearance`. */
export type Appearance = { color?: string };

// Same pattern as sim's, which keeps its copy for the version 1 and 2 migration.
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// Same wording as sim's scenario errors.
const show = (value: unknown): string => {
    if (typeof value === "number") {
        return String(value);
    }

    if (value === null) {
        return "null";
    }

    return typeof value === "string" ? JSON.stringify(value) : typeof value;
};

/** Checks the fields of an `appearance` object that sim already knows is one. */
export const validateAppearance: AppearanceValidator = (
    path,
    input,
    errors,
) => {
    const { color } = input as Record<string, unknown>;

    if (color === undefined) return input;

    if (typeof color !== "string") {
        errors.push(`${path}.color: must be a string (got ${show(color)})`);
    } else if (!HEX_COLOR.test(color)) {
        errors.push(
            `${path}.color: must be a #rgb or #rrggbb colour (got ${show(color)})`,
        );
    }

    return input;
};

/** The appearance of `body`, which the loader has validated. */
export const appearanceOf = (body: Body): Appearance =>
    (body.appearance as Appearance | undefined) ?? {};
