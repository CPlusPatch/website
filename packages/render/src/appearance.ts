/**
 * @module
 * The look of a body that the scenario stores as opaque `appearance`.
 */

import type { AppearanceValidator, Body } from "@cpluspatch/sim";
import type { Atmosphere } from "./bodies/atmospheres.ts";
import type { Bus } from "./bodies/spacecraft.ts";
import { type FieldValidator, HEX_COLOR, show } from "./layers/fields.ts";
import { LAYERS } from "./layers/index.ts";
import { validateMesh } from "./meshes/index.ts";
import { styleOf } from "./tags.ts";

/** A ring strip: its map, and its edges in m from the body's centre. */
export type Rings = { map: string; inner: number; outer: number };

/** A mesh drawn in place of the sphere: its `type` in `MESHES`, and the params of that type. */
export type MeshAppearance = { type: string } & Partial<Bus>;

/** The renderer's view of `Body.appearance`. Each field after `color` belongs to a layer. */
export type Appearance = {
    color?: string;
    /** The surface map's key. */
    map?: string;
    /** Whether it's drawn as a star: its own light, a corona and no tone mapping. */
    glow?: boolean;
    atmosphere?: Atmosphere;
    clouds?: { map: string };
    nightSide?: { map: string };
    rings?: Rings;
    mesh?: MeshAppearance;
    /** How the bodies orbiting this one are coloured: `"orbitClass"` colours spacecraft by their orbit class. */
    satellites?: "orbitClass";
};

const validateColor: FieldValidator = (path, color, errors) => {
    if (typeof color !== "string") {
        errors.push(`${path}.color: must be a string (got ${show(color)})`);
    } else if (!HEX_COLOR.test(color)) {
        errors.push(
            `${path}.color: must be a #rgb or #rrggbb colour (got ${show(color)})`,
        );
    }
};

const validateSatellites: FieldValidator = (path, value, errors) => {
    if (value !== "orbitClass") {
        errors.push(
            `${path}.satellites: must be "orbitClass" (got ${show(value)})`,
        );
    }
};

/** The validator of each appearance field the renderer knows. Other fields are ignored. */
const FIELDS: Readonly<Record<string, FieldValidator>> = {
    color: validateColor,
    mesh: validateMesh,
    satellites: validateSatellites,
    ...Object.fromEntries(
        LAYERS.map(({ field, validate }) => [field, validate]),
    ),
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

/** The appearance of `body`, which the loader has validated. Its tag's defaults sit under the body's own. */
export const appearanceOf = (body: Body): Appearance => ({
    ...styleOf(body).appearance,
    ...(body.appearance as Appearance | undefined),
});
