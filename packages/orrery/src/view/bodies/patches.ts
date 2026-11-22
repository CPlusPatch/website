/**
 * @module
 * Several fragment patches on one `MeshStandardMaterial`, and the extras a body draws with them.
 */

import type {
    IUniform,
    MeshStandardMaterial,
    PerspectiveCamera,
    SphereGeometry,
} from "three";
import type { Maps } from "../maps.ts";

/** A piece of fragment shader for a lit material. */
export type Patch = {
    /** Tells programs apart in three's cache, so it must be unique to the patch's code. */
    name: string;
    uniforms: Record<string, IUniform>;
    /** Uniforms, put before the shader. It can't use anything the lighting chunks declare. */
    declarations: string;
    /** Runs before the colour is written, where `outgoingLight`, `geometryNormal` and the like are set. */
    code: string;
};

/** What a body draws beyond its sphere, once its maps have loaded. */
export type Extra = {
    patches: Patch[];
    /** Asks for the maps it needs. */
    load: (maps: Maps) => void;
    /** Follows the sphere at the camera, for a sphere that's shown. */
    update: (camera: PerspectiveCamera, geometry: SphereGeometry) => void;
    dispose: () => void;
};

/** Gives `material` every patch, in order. */
export const applyPatches = (
    material: MeshStandardMaterial,
    patches: Patch[],
): void => {
    if (!patches.length) return;

    const code = patches.map(({ code }) => `{\n${code}\n}`).join("\n");
    const declarations = patches.map(({ declarations }) => declarations);
    const key = patches.map(({ name }) => name).join(",");

    material.onBeforeCompile = (shader) => {
        for (const { uniforms } of patches)
            Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader =
            `${declarations.join("\n")}\n${shader.fragmentShader}`.replace(
                "#include <opaque_fragment>",
                () => `${code}\n#include <opaque_fragment>`,
            );
    };
    // Every material has the same `onBeforeCompile` source, which three would take as one program.
    material.customProgramCacheKey = () => key;
};
