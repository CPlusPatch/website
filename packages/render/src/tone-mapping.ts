import { CustomToneMapping, ShaderChunk, type ToneMapping } from "three";

const STUB = "vec3 CustomToneMapping( vec3 color ) { return color; }";

// Khronos PBR Neutral without its toe. The toe subtracts the smallest channel in the darks,
// which turned shaded sides fully saturated (olive Saturn, teal Jupiter zones) or black.
// https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/README.md
const NEUTRAL_NO_TOE = `vec3 CustomToneMapping( vec3 color ) {
    const float StartCompression = 0.8 - 0.04;
    const float Desaturation = 0.15;
    color *= toneMappingExposure;
    float peak = max( color.r, max( color.g, color.b ) );
    if ( peak < StartCompression ) return color;
    float d = 1. - StartCompression;
    float newPeak = 1. - d * d / ( peak + d - StartCompression );
    color *= newPeak / peak;
    float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
    return mix( color, vec3( newPeak ), g );
}`;

/** Installs the Orrery's tone mapping into three.js's shader chunks and returns its constant. */
export const neutralNoToe = (): ToneMapping => {
    const chunk = ShaderChunk.tonemapping_pars_fragment;
    if (!chunk.includes(STUB)) {
        if (chunk.includes(NEUTRAL_NO_TOE)) return CustomToneMapping;
        throw new Error("three.js changed its CustomToneMapping stub.");
    }
    ShaderChunk.tonemapping_pars_fragment = chunk.replace(STUB, NEUTRAL_NO_TOE);
    return CustomToneMapping;
};
