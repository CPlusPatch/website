/**
 * @module
 * The sky behind the scene: the Milky Way and the bright stars.
 */

import { OBLIQUITY_J2000 } from "@cpluspatch/orbit";
import {
    AdditiveBlending,
    BackSide,
    BufferAttribute,
    BufferGeometry,
    Color,
    LinearFilter,
    Mesh,
    type Object3D,
    PerspectiveCamera,
    Points,
    RepeatWrapping,
    Scene,
    ShaderMaterial,
    SphereGeometry,
    SRGBColorSpace,
    type Texture,
    TextureLoader,
    type WebGLRenderer,
} from "three";
import {
    decodeStars,
    STAR_TINTS,
    type Star,
    starBrightness,
    starDirections,
    starSize,
} from "../stars.ts";

/** How bright the Milky Way is, so it stays faint behind the bodies. */
const MILKY_WAY_STRENGTH = 0.1;

/** How much colour the Milky Way keeps, so its red core doesn't fill a phone screen. */
const MILKY_WAY_SATURATION = 0.7;

/** The linear brightness where the Milky Way starts to compress, so the core stays dim. */
const MILKY_WAY_KNEE = 0.01;

type Disposable = { dispose: () => void };

/** The sky, drawn before the scene. */
export type Sky = {
    /** Fetches the stars and the Milky Way. Rejects if `signal` aborts or a fetch fails. */
    load: (signal: AbortSignal) => Promise<void>;
    /** Draws the sky as seen by `camera`. Does nothing until `load` has finished. */
    render: (renderer: WebGLRenderer, camera: PerspectiveCamera) => void;
    /** Whether `render` draws anything yet. */
    shown: () => boolean;
    dispose: () => void;
};

const MILKY_WAY_VERTEX = /* glsl */ `
varying vec3 vDirection;

void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// The lookup uses the direction, not the sphere's uv, so the texture has no seam or pinched poles.
const MILKY_WAY_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float strength;
uniform float saturation;
uniform float knee;
uniform vec2 tilt;
varying vec3 vDirection;

void main() {
    vec3 d = normalize(vDirection);
    // Ecliptic back to equatorial. Must match skyUv in stars.ts.
    vec3 q = vec3(d.x, d.y * tilt.x - d.z * tilt.y, d.y * tilt.y + d.z * tilt.x);
    float ra = atan(q.y, q.x);
    float dec = asin(clamp(q.z, -1.0, 1.0));
    vec2 uv = vec2(fract(0.5 - ra / 6.283185307179586), 0.5 + dec / 3.141592653589793);
    vec3 c = texture2D(map, uv).rgb * strength;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, saturation);
    c /= 1.0 + l / knee;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
}
`;

const STARS_VERTEX = /* glsl */ `
attribute float size;
attribute vec3 color;
uniform float pixelRatio;
varying vec3 vColor;

void main() {
    vColor = color;
    gl_PointSize = size * pixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const STARS_FRAGMENT = /* glsl */ `
varying vec3 vColor;

void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float alpha = exp(-r * r * 2.5);
    gl_FragColor = vec4(vColor, alpha);
    #include <colorspace_fragment>
}
`;

const starColors = (stars: Star[]): Float32Array => {
    const white = new Color(1, 1, 1);
    const tints = new Map(
        Object.entries(STAR_TINTS).map(([name, hex]) => [
            name,
            new Color(hex).lerp(white, 0.5),
        ]),
    );
    const out = new Float32Array(stars.length * 3);

    stars.forEach((star, i) => {
        const tint = tints.get(star.class) ?? white;
        const brightness = starBrightness(star.mag);
        out.set(
            [tint.r * brightness, tint.g * brightness, tint.b * brightness],
            i * 3,
        );
    });

    return out;
};

type Built = {
    object: Object3D;
    disposables: Disposable[];
};

const buildMilkyWay = (texture: Texture): Built => {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    // Mipmaps would show a seam where the lookup wraps.
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;

    const geometry = new SphereGeometry(1, 64, 32);
    const material = new ShaderMaterial({
        uniforms: {
            map: { value: texture },
            strength: { value: MILKY_WAY_STRENGTH },
            saturation: { value: MILKY_WAY_SATURATION },
            knee: { value: MILKY_WAY_KNEE },
            tilt: {
                value: [Math.cos(OBLIQUITY_J2000), Math.sin(OBLIQUITY_J2000)],
            },
        },
        vertexShader: MILKY_WAY_VERTEX,
        fragmentShader: MILKY_WAY_FRAGMENT,
        side: BackSide,
        // Adds onto the ground colour the canvas was cleared to.
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
    });

    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 0;
    mesh.frustumCulled = false;

    return { object: mesh, disposables: [geometry, material] };
};

const buildStars = (stars: Star[], pixelRatio: { value: number }): Built => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        "position",
        new BufferAttribute(starDirections(stars), 3),
    );
    geometry.setAttribute(
        "size",
        new BufferAttribute(
            Float32Array.from(stars, (star) => starSize(star.mag)),
            1,
        ),
    );
    geometry.setAttribute("color", new BufferAttribute(starColors(stars), 3));

    const material = new ShaderMaterial({
        uniforms: { pixelRatio },
        vertexShader: STARS_VERTEX,
        fragmentShader: STARS_FRAGMENT,
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
    });

    const points = new Points(geometry, material);
    points.renderOrder = 1;
    points.frustumCulled = false;

    return { object: points, disposables: [geometry, material] };
};

/** A sky that draws nothing until it's loaded. */
export const createSky = (): Sky => {
    const scene = new Scene();
    // The main camera can be ~1e10 km from the origin, too far for float32. This one stays put.
    const camera = new PerspectiveCamera();
    let disposables: Disposable[] = [];
    let pixelRatio = { value: 1 };
    let ready = false;

    return {
        load: async (signal) => {
            // allSettled, so a texture that loads after the fetch fails is still disposed.
            const [fetched, loaded] = await Promise.allSettled([
                fetch(new URL("../assets/stars.bin", import.meta.url), {
                    signal,
                }),
                new TextureLoader().loadAsync(
                    new URL("../assets/milky-way.webp", import.meta.url).href,
                ),
            ]);
            const texture =
                loaded.status === "fulfilled" ? loaded.value : undefined;

            try {
                if (fetched.status === "rejected") throw fetched.reason;
                if (loaded.status === "rejected") throw loaded.reason;
                signal.throwIfAborted();

                const response = fetched.value;
                if (!response.ok) {
                    throw new Error(
                        `The star file gave ${response.status} ${response.statusText}.`,
                    );
                }

                const stars = decodeStars(
                    new Uint8Array(await response.arrayBuffer()),
                );
                signal.throwIfAborted();

                pixelRatio = { value: 1 };
                const milkyWay = buildMilkyWay(loaded.value);
                const points = buildStars(stars, pixelRatio);

                scene.add(milkyWay.object, points.object);
                disposables = [
                    ...milkyWay.disposables,
                    ...points.disposables,
                    loaded.value,
                ];
                ready = true;
            } catch (error) {
                texture?.dispose();
                throw error;
            }
        },
        render: (renderer, main) => {
            if (!ready) return;

            // The projection carries the main camera's view offset.
            main.getWorldQuaternion(camera.quaternion);
            camera.projectionMatrix.copy(main.projectionMatrix);
            camera.projectionMatrixInverse.copy(main.projectionMatrixInverse);
            pixelRatio.value = renderer.getPixelRatio();
            renderer.render(scene, camera);
        },
        shown: () => ready,
        dispose: () => {
            ready = false;
            for (const item of disposables) item.dispose();
            disposables = [];
        },
    };
};
