import type { Texture } from "three";
import type { Extra } from "./patches.ts";

/** How bright the city lights are in the dark. */
const STRENGTH = 0.6;

/** City lights on a body's night side, which fade in across the terminator once `map` loads. */
export const nightExtra = (map: string): Extra => {
    const nightMap: { value: Texture | null } = { value: null };
    // A uniform instead of a define, so the program isn't rebuilt when the map arrives.
    const nightOn = { value: 0 };

    return {
        patches: [
            {
                name: "night",
                uniforms: { nightMap, nightOn },
                declarations:
                    "uniform sampler2D nightMap;\nuniform float nightOn;",
                // The day map defines vMapUv, and it may arrive after this map.
                code: `#ifdef USE_MAP
            if (nightOn > 0.5) {
                vec3 toSun = normalize(pointLights[0].position - geometryPosition);
                float dusk = 1.0 - smoothstep(-0.15, 0.1, dot(geometryNormal, toSun));
                outgoingLight += texture2D(nightMap, vMapUv).rgb * ${STRENGTH.toFixed(2)} * dusk;
            }
            #endif`,
            },
        ],
        load: (maps) =>
            maps.load(map, (texture) => {
                nightMap.value = texture;
                nightOn.value = 1;
            }),
        update: () => {},
        dispose: () => {},
    };
};
