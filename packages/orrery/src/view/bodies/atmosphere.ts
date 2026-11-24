import type { Body } from "@cpluspatch/orbit";
import {
    AddEquation,
    BackSide,
    Color,
    CustomBlending,
    FrontSide,
    Mesh,
    OneFactor,
    OneMinusSrcColorFactor,
    type PointLight,
    ShaderMaterial,
    Vector3,
    ZeroFactor,
} from "three";
import { shellFor } from "./atmospheres.ts";
import type { Extra } from "./patches.ts";

/** A tuning knob: scales the whole glow. */
const STRENGTH = 1;

/** A tuning knob: the power of the fade from the limb out to the shell top. */
const GLOW_FALLOFF = 2.5;

/** A tuning knob: how tight the rim is over the disc. */
const RIM_POWER = 5;

/** A tuning knob: the extra glow when the Sun is behind the body. */
const FORWARD = 3;

/** A tuning knob: the most the backlight adds, as a share of the way from the glow to 1. */
const BACKLIT_MAX = 0.4;

/** After Earth's clouds, which draw at 0, and before Saturn's rings, at 1. */
const RENDER_ORDER = 0.5;

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>

uniform float uExtent;
varying vec3 vPos;

void main() {
    // In body radii, so the fragment shader's numbers stay small.
    vPos = position * uExtent;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>

const float STRENGTH = ${STRENGTH.toFixed(2)};
const float GLOW_FALLOFF = ${GLOW_FALLOFF.toFixed(2)};
const float RIM_POWER = ${RIM_POWER.toFixed(2)};
const float FORWARD = ${FORWARD.toFixed(2)};
const float BACKLIT_MAX = ${BACKLIT_MAX.toFixed(2)};
const vec3 WARM = vec3(1.0, 0.72, 0.45);

uniform vec3 uCamera;
uniform vec3 uSun;
uniform float uTop;
uniform vec3 uDay;
uniform vec3 uTwilight;
uniform float uRim;
uniform float uHaze;
varying vec3 vPos;

void main() {
    #include <logdepthbuf_fragment>

    vec3 dir = normalize(vPos - uCamera);
    bool inside = dot(uCamera, uCamera) < uTop * uTop;
    // From outside the ray starts on the shell's polygon, which keeps its numbers small.
    vec3 origin = inside ? uCamera : vPos;
    float b = dot(origin, dir);
    vec3 closest = origin - dir * b;
    float r0 = length(closest);
    if (r0 > uTop) discard;

    float glow;
    // The rim's share of the glow, which the backlit ring and the twilight colour follow.
    float rim;
    vec3 p;
    if (inside) {
        // A plain sky tint.
        p = origin;
        float t = clamp((length(origin) - 1.0) / (uTop - 1.0), 0.0, 1.0);
        glow = uRim * pow(1.0 - t, GLOW_FALLOFF) * 0.5;
        rim = 0.0;
    } else if (r0 < 1.0 && -b > 0.0) {
        // The ray hits the surface: rim falls off toward the middle of the disc.
        p = origin + dir * (-b - sqrt(1.0 - r0 * r0));
        float facing = max(dot(normalize(p), -dir), 0.0);
        rim = pow(1.0 - facing, RIM_POWER);
        glow = mix(uHaze, uRim, rim);
    } else {
        // Past the disc: fades from the rim at the limb to nothing at the top.
        p = -b > 0.0 ? closest : origin;
        float t = clamp((r0 - 1.0) / (uTop - 1.0), 0.0, 1.0);
        glow = uRim * pow(1.0 - t, GLOW_FALLOFF);
        // Twilight fades with height, or the cusps show a straight-sided column.
        rim = pow(1.0 - t, 1.5);
    }

    float sunDot = dot(normalize(p), uSun);
    float lit = smoothstep(-0.04, 0.06, sunDot);
    // Through a warm white, since blue straight to orange passes through pink.
    // Only for warm twilights, and no brighter than the day colour, or the cusps glow white.
    vec3 warm = WARM * max(max(uDay.r, uDay.g), uDay.b);
    float warmth = clamp((uTwilight.r - uTwilight.b) * 1.5, 0.0, 1.0);
    vec3 dusk = mix(uTwilight, warm, 0.7 * warmth * smoothstep(-0.02, 0.1, sunDot));
    vec3 colour = mix(dusk, uDay, smoothstep(0.04, 0.18, sunDot));
    // Twilight colour only near the rim, so the terminator isn't a stripe across the disc.
    colour = mix(uDay, colour, rim);
    // Outside \`lit\`: seen from behind, the limb's air is lit from the far side.
    float backlit = FORWARD * pow(max(dot(dir, uSun), 0.0), 6.0) * glow * rim * rim;
    float base = glow * lit;
    // One colour, brightened up to BACKLIT_MAX. Adding the twilight colour on top summed Mars's
    // orange and blue to white, and lit the whole night-side ring orange.
    float level = base + (1.0 - base) * BACKLIT_MAX * (1.0 - exp(-backlit));
    gl_FragColor = vec4(colour * level * STRENGTH, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

/**
 * An atmosphere for `sphere`, drawn as a shell around it. Null for a body that has none. The
 * shell is shown once the maps are asked for, so a body without maps has no atmosphere.
 */
export const atmosphereExtra = (body: Body, sphere: Mesh): Extra | null => {
    const atmosphere = shellFor(body.model, body.radius / 1000);
    if (!atmosphere) return null;

    // `Color` converts sRGB hex to the linear working space.
    const linear = (hex: string): Vector3 => {
        const { r, g, b } = new Color(hex);

        return new Vector3(r, g, b);
    };
    const uniforms = {
        uExtent: { value: atmosphere.top },
        uCamera: { value: new Vector3() },
        uSun: { value: new Vector3(1, 0, 0) },
        uTop: { value: atmosphere.top },
        uDay: { value: linear(atmosphere.day) },
        uTwilight: { value: linear(atmosphere.twilight) },
        uRim: { value: atmosphere.rim },
        uHaze: { value: atmosphere.haze },
    };
    const material = new ShaderMaterial({
        uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        // Screen blending tints bright areas without blowing them out.
        blending: CustomBlending,
        blendEquation: AddEquation,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcColorFactor,
        blendSrcAlpha: ZeroFactor,
        blendDstAlpha: OneFactor,
    });
    const shell = new Mesh(sphere.geometry, material);
    shell.renderOrder = RENDER_ORDER;
    shell.visible = false;
    sphere.add(shell);

    const center = new Vector3();
    const offset = new Vector3();
    let light: PointLight | undefined;

    // Here, not in `update`, so the camera and the sun are where the frame draws them.
    shell.onBeforeRender = (_renderer, scene, camera) => {
        light ??= scene.children.find(
            (child): child is PointLight => "isPointLight" in child,
        );
        shell.getWorldPosition(center);
        if (light) {
            uniforms.uSun.value.copy(light.position).sub(center).normalize();
        }

        // In body radii, the shell's frame.
        offset.copy(camera.position).sub(center).divideScalar(sphere.scale.x);
        uniforms.uCamera.value.copy(offset);
        const inside = offset.lengthSq() < atmosphere.top ** 2;
        material.side = inside ? BackSide : FrontSide;
        // From inside, the shell's far side is behind the surface it has to draw over.
        material.depthTest = !inside;
    };

    return {
        patches: [],
        load: () => {
            shell.visible = true;
        },
        update: (_camera, geometry) => {
            shell.geometry = geometry;
            // The sphere's facets sit inside it, so the polygon is grown to hold the true shell.
            const extent =
                atmosphere.top /
                Math.cos(Math.PI / geometry.parameters.widthSegments);
            shell.scale.setScalar(extent);
            uniforms.uExtent.value = extent;
            // Spheres spin, but the shell's frame follows the group's axes.
            shell.quaternion.copy(sphere.quaternion).invert();
        },
        dispose: () => {
            shell.removeFromParent();
            material.dispose();
        },
    };
};
