import { Color } from "three";
import type { Patch } from "./patches.ts";

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

/** A faint sunlit rim for a body with an atmosphere, inside its disc. Null for others. */
export const limbPatch = (id: string): Patch | null => {
    const hex = LIMBS[id];
    if (!hex) return null;

    return {
        name: "limb",
        uniforms: {
            limbColor: { value: new Color(hex).multiplyScalar(STRENGTH) },
        },
        declarations: "uniform vec3 limbColor;",
        code: `float facing = 1.0 - saturate(dot(geometryNormal, geometryViewDir));
            vec3 toSun = normalize(pointLights[0].position - geometryPosition);
            float light = dot(geometryNormal, toSun);
            // Starts at the terminator, so the night side has no rim, and fades where the
            // surface is already bright.
            float lit = smoothstep(0.0, 0.4, light) * (1.0 - saturate(light));
            outgoingLight += limbColor * pow(facing, 3.0) * lit;`,
    };
};
