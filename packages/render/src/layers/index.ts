/**
 * @module
 * The layers a body's sphere draws on top of its colour, each from one field of its appearance.
 */

import type { Body } from "@cpluspatch/sim";
import {
    type Group,
    type Mesh,
    type MeshBasicMaterial,
    MeshStandardMaterial,
    type SphereGeometry,
} from "three";
import type { Appearance } from "../appearance.ts";
import { atmosphereExtra } from "../bodies/atmosphere.ts";
import { cloudsExtra } from "../bodies/clouds.ts";
import { nightExtra } from "../bodies/night.ts";
import { applyPatches, type Extra } from "../bodies/patches.ts";
import { ringsExtra } from "../bodies/rings.ts";
import { surfaceExtra } from "../bodies/surface.ts";
import {
    type FieldValidator,
    validateAtmosphere,
    validateClouds,
    validateGlow,
    validateMap,
    validateNightSide,
    validateRings,
} from "./fields.ts";

/** A body's sphere, whose material the surface layer and the patches change. */
export type Sphere = Mesh<
    SphereGeometry,
    MeshBasicMaterial | MeshStandardMaterial
>;

/** What a layer builds from. */
export type LayerContext = {
    body: Body;
    /** The body's appearance with its tag's defaults and its preset's fields in. */
    appearance: Appearance;
    group: Group;
    sphere: Sphere;
};

/** One kind of extra a sphere can have. */
export type Layer = {
    /** The appearance field that turns it on. */
    field: keyof Appearance;
    validate: FieldValidator;
    /** The extra for this body, or null if its appearance doesn't ask for one. Absent if the field is read elsewhere. */
    build?: (context: LayerContext) => Extra | null;
    /** The keys of the maps this appearance has it load. */
    maps: (appearance: Appearance) => string[];
};

// In draw order: the patches stack in this order, and the surface map comes first.
export const LAYERS: readonly Layer[] = [
    {
        field: "map",
        validate: validateMap,
        build: ({ appearance, sphere }) =>
            appearance.map === undefined
                ? null
                : surfaceExtra(
                      appearance.map,
                      appearance.glow === true,
                      sphere,
                  ),
        maps: ({ map }) => (map === undefined ? [] : [map]),
    },
    {
        // Read by `createEntry`, which picks the star material and the corona sprite.
        field: "glow",
        validate: validateGlow,
        maps: () => [],
    },
    {
        field: "atmosphere",
        validate: validateAtmosphere,
        build: ({ body, appearance, sphere }) =>
            atmosphereExtra(
                appearance.atmosphere,
                body.mass.radius / 1000,
                sphere,
            ),
        maps: () => [],
    },
    {
        field: "clouds",
        validate: validateClouds,
        build: ({ appearance, sphere }) =>
            appearance.clouds
                ? cloudsExtra(appearance.clouds.map, sphere)
                : null,
        maps: ({ clouds }) => (clouds ? [clouds.map] : []),
    },
    {
        field: "rings",
        validate: validateRings,
        build: ({ body, appearance, group, sphere }) =>
            appearance.rings
                ? ringsExtra(appearance.rings, body.mass.radius, group, sphere)
                : null,
        maps: ({ rings }) => (rings ? [rings.map] : []),
    },
    {
        field: "nightSide",
        validate: validateNightSide,
        build: ({ appearance }) =>
            appearance.nightSide ? nightExtra(appearance.nightSide.map) : null,
        maps: ({ nightSide }) => (nightSide ? [nightSide.map] : []),
    },
];

/** Everything a body's sphere gets on top of its colour, from its `appearance`. */
export const createExtras = (
    body: Body,
    appearance: Appearance,
    group: Group,
    sphere: Sphere,
): Extra => {
    const context = { body, appearance, group, sphere };
    const extras = LAYERS.flatMap(({ build }) => build?.(context) ?? []);

    const patches = extras.flatMap((extra) => extra.patches);
    if (sphere.material instanceof MeshStandardMaterial)
        applyPatches(sphere.material, patches);

    return {
        patches,
        load: (maps) => {
            for (const extra of extras) extra.load(maps);
        },
        update: (camera, geometry) => {
            for (const extra of extras) extra.update(camera, geometry);
        },
        dispose: () => {
            for (const extra of extras) extra.dispose();
        },
    };
};

/** The keys of every map `appearance` has its layers load. */
export const mapKeys = (appearance: Appearance): string[] =>
    LAYERS.flatMap(({ maps }) => maps(appearance));
