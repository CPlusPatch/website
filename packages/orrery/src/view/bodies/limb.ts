import { Color, type MeshStandardMaterial } from "three";

/** The colour of the thin atmosphere at the edge of each body that has one, in sRGB. */
const LIMBS: Record<string, string> = {
    earth: "#7fb2ff",
    venus: "#f2dca8",
    jupiter: "#e8d2b0",
    saturn: "#eedcb0",
    uranus: "#b8eef0",
    neptune: "#8fb0ff",
};

/** How bright the limb is at the very edge of the disc. */
const STRENGTH = 0.35;

/** Adds a faint sunlit rim to a body with an atmosphere, inside its disc. Does nothing for others. */
export const addLimb = (material: MeshStandardMaterial, id: string): void => {
    const hex = LIMBS[id];
    if (!hex) return;

    const color = new Color(hex).multiplyScalar(STRENGTH);
    material.onBeforeCompile = (shader) => {
        shader.uniforms.limbColor = { value: color };
        shader.fragmentShader =
            `uniform vec3 limbColor;\n${shader.fragmentShader}`.replace(
                "#include <opaque_fragment>",
                `{
                float facing = 1.0 - saturate(dot(geometryNormal, geometryViewDir));
                vec3 toSun = normalize(pointLights[0].position - geometryPosition);
                float light = dot(geometryNormal, toSun);
                // Starts at the terminator, so the night side has no rim, and fades where the
                // surface is already bright.
                float lit = smoothstep(0.0, 0.4, light) * (1.0 - saturate(light));
                outgoingLight += limbColor * pow(facing, 3.0) * lit;
            }
            #include <opaque_fragment>`,
            );
    };
};
