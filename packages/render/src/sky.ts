/**
 * @module
 * The sky behind the scene: the Milky Way and the bright stars.
 */

import { OBLIQUITY_J2000 } from "@cpluspatch/orbit";
import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";
import {
    AdditiveBlending,
    BackSide,
    BufferAttribute,
    BufferGeometry,
    Color,
    ImageLoader,
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
    Texture,
    type WebGLRenderer,
} from "three";
import {
    decodeStars,
    STAR_TINTS,
    type Star,
    starBrightness,
    starDirections,
    starSize,
} from "./stars.ts";

/** How bright the Milky Way is, so it stays faint behind the bodies. */
const MILKY_WAY_STRENGTH = 0.1;

/** How much colour the Milky Way keeps, so its red core doesn't fill a phone screen. */
const MILKY_WAY_SATURATION = 0.7;

/** The linear brightness where the Milky Way starts to compress, so the core stays dim. */
const MILKY_WAY_KNEE = 0.01;

/** How long the sky takes to fade in, in ms. */
const FADE_MS = 600;

const STARS_URL = new URL("./assets/stars.bin", import.meta.url);
const MILKY_WAY_URL = new URL("./assets/milky-way.webp", import.meta.url);

type Disposable = { dispose: () => void };

/** The decoded stars and the Milky Way image, which every sky of a page is built from. */
export type SkyData = {
    stars: Star[];
    milkyWay: HTMLImageElement;
};

/** The sky, drawn before the scene. */
export type Sky = {
    /** Builds the sky from `data`. */
    show: (data: SkyData) => void;
    /** Marks the loading state as gone. A sky that arrives later fades in. */
    reveal: () => void;
    /** Draws the sky as seen by `camera`. Does nothing until `show` has run. */
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
uniform float fade;
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
    vec3 c = texture2D(map, uv).rgb * strength * fade;
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
uniform float fade;
varying vec3 vColor;

void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float alpha = exp(-r * r * 2.5) * fade;
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

type Fade = { value: number };

type Built = {
    object: Object3D;
    disposables: Disposable[];
};

const buildMilkyWay = (texture: Texture, fade: Fade): Built => {
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
            fade,
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

const buildStars = (
    stars: Star[],
    pixelRatio: { value: number },
    fade: Fade,
): Built => {
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
        uniforms: { pixelRatio, fade },
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

const checkResponse = (response: Response, name: string) => {
    if (!response.ok) {
        throw new Error(
            `The ${name} file gave ${response.status} ${response.statusText}.`,
        );
    }
};

/** The sum of the `Content-Length`s, or `null` if a response has none. */
const totalLength = (responses: Response[]): number | null => {
    let total = 0;
    for (const response of responses) {
        // A compressed body's length isn't the length the reader counts.
        if (response.headers.has("Content-Encoding")) return null;

        const length = Number(response.headers.get("Content-Length"));
        if (!(length > 0)) return null;

        total += length;
    }

    return total;
};

/** The body of `response`, reporting each chunk's size to `onChunk`. */
const readBytes = async (
    response: Response,
    onChunk: (bytes: number) => void,
): Promise<Uint8Array<ArrayBuffer>> => {
    if (!response.body) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        onChunk(bytes.length);

        return bytes;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        length += value.length;
        onChunk(value.length);
    }

    const out = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }

    return out;
};

/**
 * Fetches the stars and the Milky Way. Rejects if `signal` aborts or a fetch fails.
 * `onProgress` hears the fraction of the bytes received, when both files give their length.
 */
export const fetchSky = async (
    signal: AbortSignal,
    onProgress?: (fraction: number) => void,
): Promise<SkyData> => {
    // Aborted when either file fails, so the other doesn't keep downloading.
    const failed = new AbortController();
    const both = AbortSignal.any([signal, failed.signal]);
    let starsBytes: Uint8Array<ArrayBuffer>;
    let milkyWayBytes: Uint8Array<ArrayBuffer>;
    try {
        const [starsResponse, milkyWayResponse] = await Promise.all([
            fetch(STARS_URL, { signal: both }),
            fetch(MILKY_WAY_URL, { signal: both }),
        ]);
        checkResponse(starsResponse, "star");
        checkResponse(milkyWayResponse, "Milky Way");

        const total = totalLength([starsResponse, milkyWayResponse]);
        let received = 0;
        const count = (bytes: number) => {
            received += bytes;
            if (total !== null) onProgress?.(Math.min(received / total, 1));
        };
        [starsBytes, milkyWayBytes] = await Promise.all([
            readBytes(starsResponse, count),
            readBytes(milkyWayResponse, count),
        ]);
    } catch (error) {
        failed.abort();
        throw error;
    }
    signal.throwIfAborted();

    const stars = decodeStars(starsBytes);
    const objectUrl = URL.createObjectURL(
        new Blob([milkyWayBytes], { type: "image/webp" }),
    );
    let milkyWay: HTMLImageElement;
    try {
        milkyWay = await new ImageLoader().loadAsync(objectUrl);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
    signal.throwIfAborted();

    return { stars, milkyWay };
};

/** A sky that draws nothing until it's shown. */
export const createSky = (): Sky => {
    const scene = new Scene();
    // The main camera can be ~1e10 km from the origin, too far for float32. This one stays put.
    const camera = new PerspectiveCamera();
    let disposables: Disposable[] = [];
    let pixelRatio = { value: 1 };
    // Shared by both materials, so the whole sky fades together.
    const fade: Fade = { value: 0 };
    let shownAt: number | null = null;
    let ready = false;
    let revealed = false;

    return {
        show: (data) => {
            const texture = new Texture(data.milkyWay);
            texture.needsUpdate = true;
            try {
                pixelRatio = { value: 1 };
                const milkyWay = buildMilkyWay(texture, fade);
                const points = buildStars(data.stars, pixelRatio, fade);

                scene.add(milkyWay.object, points.object);
                disposables = [
                    ...milkyWay.disposables,
                    ...points.disposables,
                    texture,
                ];
                // A sky that's ready before the reveal is part of the first picture.
                if (!revealed) fade.value = 1;
                ready = true;
            } catch (error) {
                texture.dispose();
                throw error;
            }
        },
        reveal: () => {
            revealed = true;
        },
        render: (renderer, main) => {
            if (!ready) return;

            if (fade.value < 1) {
                const now = performance.now();
                shownAt ??= now;
                fade.value = reducedMotion()
                    ? 1
                    : Math.min((now - shownAt) / FADE_MS, 1);
            }
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
