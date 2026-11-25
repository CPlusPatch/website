import { Color } from "three";
import type { LineMaterial } from "three/addons/lines/LineMaterial.js";

/** The uniforms that fade a line by its depth and its size on screen. */
export type LineFade = {
    /** The view-space z of the orbit's parent, which is negative in front of the camera. */
    parentDepth: { value: number };
    /** The farthest the orbit reaches from its parent, in scene units. */
    reach: { value: number };
    /** The fade from the orbit's size on screen, from 0 to 1. */
    fade: { value: number };
    /** The linear colour the line fades into. */
    ground: { value: Color };
};

const CACHE_KEY = "orbit-fade";

/** Makes `material` fade toward `ground` on the far side of its orbit and with `fade`. */
export const fadeLineMaterial = (material: LineMaterial): LineFade => {
    const uniforms: LineFade = {
        parentDepth: { value: 0 },
        reach: { value: 1 },
        fade: { value: 1 },
        ground: { value: new Color() },
    };

    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);

        shader.vertexShader = shader.vertexShader
            .replace("void main() {", "varying float vViewZ;\nvoid main() {")
            .replace(
                "vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );",
                `vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );
            vViewZ = ( position.y < 0.5 ) ? start.z : end.z;`,
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                "void main() {",
                `varying float vViewZ;
        uniform float parentDepth;
        uniform float reach;
        uniform float fade;
        uniform vec3 ground;
        void main() {`,
            )
            .replace(
                "gl_FragColor = vec4( diffuseColor.rgb, alpha );",
                `// Only the half beyond the parent dims, to 0.7 at the far reach; z falls with distance.
            float behind = clamp( ( parentDepth - vViewZ ) / reach, 0.0, 1.0 );
            float k = fade * ( 1.0 - 0.3 * behind );
            diffuseColor.rgb = ground + ( diffuseColor.rgb - ground ) * k;
            gl_FragColor = vec4( diffuseColor.rgb, alpha );`,
            );
    };
    // The patched materials share one program, which unpatched lines mustn't reuse.
    material.customProgramCacheKey = () => CACHE_KEY;

    return uniforms;
};
