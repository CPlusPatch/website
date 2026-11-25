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

/** Checks one field of an `appearance` object, which is present. Pushes its errors. */
type FieldValidator = (path: string, value: unknown, errors: string[]) => void;

const validateColor: FieldValidator = (path, color, errors) => {
    if (typeof color !== "string") {
        errors.push(`${path}.color: must be a string (got ${show(color)})`);
    } else if (!HEX_COLOR.test(color)) {
        errors.push(
            `${path}.color: must be a #rgb or #rrggbb colour (got ${show(color)})`,
        );
    }
};

/** The validator of each appearance field the renderer knows. Other fields are ignored. */
const FIELDS: Readonly<Record<string, FieldValidator>> = {
    color: validateColor,
};

/** Checks the fields of an `appearance` object that sim already knows is one. */
export const validateAppearance: AppearanceValidator = (
    path,
    input,
    errors,
) => {
    const fields = input as Record<string, unknown>;

    for (const [name, validate] of Object.entries(FIELDS)) {
        if (fields[name] !== undefined) validate(path, fields[name], errors);
    }

    return input;
};

/** The appearance of `body`, which the loader has validated. */
export const appearanceOf = (body: Body): Appearance =>
    (body.appearance as Appearance | undefined) ?? {};
