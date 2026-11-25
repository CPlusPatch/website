import { type Color, MeshBasicMaterial } from "three";

// Quadratic limb darkening, I(μ) = 1 - a(1 - μ) - b(1 - μ)², per channel. Blue darkens most,
// so the limb reddens. Stronger than the Sun's measured law (Neckel & Labs 1994), which barely
// shows on the saturated map once encoded to sRGB.
const LIMB_A = "vec3(0.50, 0.62, 0.75)";
const LIMB_B = "0.3";
// Luminance above this rolls off towards 1, so the map's brightest granules don't read as
// white specks.
const KNEE = "0.5";

/** An unlit star whose disc dims and reddens towards its limb. */
export const createStarMaterial = (color: Color): MeshBasicMaterial => {
    const material = new MeshBasicMaterial({ color, toneMapped: false });

    material.onBeforeCompile = (shader) => {
        shader.vertexShader =
            `varying vec3 vLimbView;\nvarying vec3 vLimbNormal;\n${shader.vertexShader}`.replace(
                "#include <project_vertex>",
                `#include <project_vertex>
            vLimbView = -mvPosition.xyz;
            vLimbNormal = normalize(normalMatrix * normal);`,
            );
        shader.fragmentShader =
            `varying vec3 vLimbView;\nvarying vec3 vLimbNormal;\n${shader.fragmentShader}`.replace(
                "#include <opaque_fragment>",
                `float luma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
            if (luma > ${KNEE}) {
                float over = (luma - ${KNEE}) / (1.0 - ${KNEE});
                outgoingLight *= (${KNEE} + (1.0 - ${KNEE}) * (1.0 - exp(-over))) / luma;
            }
            float edge = 1.0 - clamp(dot(normalize(vLimbNormal), normalize(vLimbView)), 0.0, 1.0);
            outgoingLight *= max(1.0 - ${LIMB_A} * edge - ${LIMB_B} * edge * edge, 0.0);
            #include <opaque_fragment>`,
            );
    };
    material.customProgramCacheKey = () => "star-limb";

    return material;
};
