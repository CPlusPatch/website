/**
 * @module
 * The satellite snapshot drawn as one layer of points around its host.
 */

import type { Vec3 } from "@cpluspatch/orbit";
import {
    inSnapshotWindow,
    type OrbitHost,
    SATELLITE_GROUPS,
    type SatelliteFacts,
    type SatelliteGroup,
    type Swarm,
    satelliteFacts,
    selectShown,
    synchronousRadius,
} from "@cpluspatch/sim";
import {
    BufferAttribute,
    BufferGeometry,
    DynamicDrawUsage,
    InterleavedBufferAttribute,
    type PerspectiveCamera,
    Points,
    type Scene,
    ShaderMaterial,
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { projectedRadiusPx } from "./geometry/visibility.ts";
import { SELECTED_LINE_PX } from "./orbits/line-geometry.ts";
import { pickNearest } from "./picking.ts";
import type { Theme } from "./theme.ts";

/** The GEO ring of a host that doesn't turn, in host radii (Earth's is 6.6). */
const GEO_RADII = 6.6;

/** The LEO shell, where most of the snapshot sits, in host radii. */
const LEO_RADII = 1.1;

/** The swarm fades in as the GEO ring grows from the first diameter to the second, in px. */
const FADE_FROM_PX = 150;
const FADE_TO_PX = 300;

/** The diameter of a satellite's dot in CSS px. */
const DOT_PX = 2;

const OPACITY = 0.7;

/** The diameter of the selected satellite's ring in CSS px. */
const RING_PX = 10;

/** A satellite is picked within this many CSS px of the pointer. */
const PICK_PX = 6;

/** The points on the selected satellite's orbit line. */
const ORBIT_SAMPLES = 256;

/**
 * The dots dim once their total area passes this share of the LEO shell's disc on screen, so they
 * don't hide the host and the markers in it. They never dim below `MIN_DENSITY`.
 */
const MAX_COVER = 1;
const MIN_DENSITY = 0.35;

/** The satellites around a host. */
export type SwarmLayer = {
    /** Sets the groups drawn. The first non-empty list starts loading the snapshot. */
    groups: (groups: readonly SatelliteGroup[]) => void;
    /**
     * Places and draws the swarm for the frame. `hostOffsetKm` is the host's centre from the
     * scene's origin in km, or `null` if there's no host.
     */
    update: (
        camera: PerspectiveCamera,
        t: number,
        hostOffsetKm: Vec3 | null,
        viewportHeight: number,
    ) => void;
    /** The index of the satellite nearest to (`x`, `y`) in px of the canvas, or `null`. */
    pick: (
        x: number,
        y: number,
        width: number,
        height: number,
    ) => number | null;
    /** Rings satellite `k` and draws its orbit, or clears them for `null`. */
    select: (k: number | null) => void;
    /** Labels satellite `k` with its name, or clears the label for `null`. */
    hover: (k: number | null) => void;
    /**
     * The world position in metres of satellite `k` at `t`, given the host's `centre`, or `null` if
     * it isn't placed.
     */
    positionOf: (k: number, t: number, centre: Vec3) => Vec3 | null;
    /** What the info panel says about satellite `k` at `t`, or `null` before the snapshot loads. */
    facts: (k: number, t: number) => SatelliteFacts | null;
    /** Whether satellite `k` is in a group that's on and the clock is within the snapshot. */
    available: (k: number) => boolean;
    resize: (pixelRatio: number, width: number, height: number) => void;
    dispose: () => void;
};

// The log depth chunks make the points hide behind the host under `logarithmicDepthBuffer`.
const vertex = (px: number) => /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 color;
uniform float pixelRatio;
varying vec3 vColor;

void main() {
    vColor = color;
    gl_PointSize = ${px.toFixed(1)} * pixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform float fade;
varying vec3 vColor;

void main() {
    #include <logdepthbuf_fragment>
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float alpha = (1.0 - smoothstep(0.5, 1.0, r)) * ${OPACITY.toFixed(1)} * fade;
    gl_FragColor = vec4(vColor, alpha);
    #include <colorspace_fragment>
}
`;

const RING_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
varying vec3 vColor;

void main() {
    #include <logdepthbuf_fragment>
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = smoothstep(0.6, 0.7, r) * (1.0 - smoothstep(0.9, 1.0, r));
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(vColor, alpha);
    #include <colorspace_fragment>
}
`;

/**
 * Writes the px in a canvas of `width` by `height` of the scene point (`x`, `y`, `z`) into `out`
 * at `o`. Returns the point's clip w, which is 0 or less behind the camera.
 */
const toPx = (
    view: ArrayLike<number>,
    projection: ArrayLike<number>,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    out: Float32Array,
    o: number,
): number => {
    const vx =
        (view[0] as number) * x +
        (view[4] as number) * y +
        (view[8] as number) * z +
        (view[12] as number);
    const vy =
        (view[1] as number) * x +
        (view[5] as number) * y +
        (view[9] as number) * z +
        (view[13] as number);
    const vz =
        (view[2] as number) * x +
        (view[6] as number) * y +
        (view[10] as number) * z +
        (view[14] as number);
    const w =
        (projection[3] as number) * vx +
        (projection[7] as number) * vy +
        (projection[11] as number) * vz +
        (projection[15] as number);
    if (w <= 0) return w;

    const cx =
        (projection[0] as number) * vx +
        (projection[4] as number) * vy +
        (projection[8] as number) * vz +
        (projection[12] as number);
    const cy =
        (projection[1] as number) * vx +
        (projection[5] as number) * vy +
        (projection[9] as number) * vz +
        (projection[13] as number);
    out[o] = (cx / w / 2 + 0.5) * width;
    out[o + 1] = (0.5 - cy / w / 2) * height;

    return w;
};

const smoothstep = (from: number, to: number, x: number): number => {
    const k = Math.min(Math.max((x - from) / (to - from), 0), 1);

    return k * k * (3 - 2 * k);
};

type Loaded = {
    swarm: Swarm;
    points: Points;
    positions: BufferAttribute;
    colors: BufferAttribute;
    geometry: BufferGeometry;
    material: ShaderMaterial;
    // Where each shown satellite is on screen, in px, for picking.
    screen: Float32Array;
    ring: Points<BufferGeometry, ShaderMaterial>;
    ringColor: BufferAttribute;
    orbit: Line2;
    orbitSegments: InterleavedBufferAttribute;
    label: CSS2DObject;
    labelName: HTMLElement;
};

/**
 * The satellite layer around `host` in `scene`. `load` isn't called until a group is turned on.
 * It gives the prepared swarm, which is shared with the other views of the page.
 */
export const createSwarm = (
    scene: Scene,
    theme: Theme,
    host: OrbitHost,
    load: () => Promise<Swarm>,
): SwarmLayer => {
    // The GEO ring's size on screen says how far the host is zoomed.
    const geoRadiusKm =
        (synchronousRadius(host, 0) ?? GEO_RADII * host.radius) / 1000;
    const leoRadiusKm = (LEO_RADII * host.radius) / 1000;
    let disposed = false;
    const uniforms = { pixelRatio: { value: 1 }, fade: { value: 0 } };
    // The ring shares the pixel ratio and has no fade.
    const ringUniforms = { pixelRatio: uniforms.pixelRatio };
    let wanted = new Set<SatelliteGroup>();
    let started = false;
    let loaded: Loaded | null = null;
    // Indices of the satellites drawn, in slot order. Rebuilt when the groups change.
    let shown: Uint32Array = new Uint32Array(0);
    let stale = true;
    // The time the positions were written for, so a paused clock isn't propagated again.
    let writtenAt: number | null = null;
    let camera: PerspectiveCamera | null = null;
    let lastT = 0;
    let selected: number | null = null;
    let hovered: number | null = null;
    let viewport = { width: 1, height: 1 };
    // The time and satellite the orbit line was sampled for.
    let sampled: { t: number; k: number } | null = null;
    let named: number | null = null;
    // Scratch for one satellite's position and its index.
    const local = new Float32Array(3);
    const hostPx = new Float32Array(2);
    const one = new Uint32Array(1);

    const available = (k: number): boolean => {
        if (!loaded || k >= loaded.swarm.count) return false;

        const group = SATELLITE_GROUPS[loaded.swarm.groups[k] ?? 0];

        return (
            group !== undefined &&
            wanted.has(group) &&
            inSnapshotWindow(loaded.swarm, lastT)
        );
    };

    // Km from the host's centre, in `local`.
    const locate = (swarm: Swarm, k: number, t: number) => {
        one[0] = k;
        swarm.positionsAt(t, one, local);
    };

    const paint = ({ ringColor, orbit }: Loaded) => {
        const color = theme.pick();
        color.toArray(ringColor.array);
        ringColor.needsUpdate = true;
        orbit.material.color.copy(color);
    };

    const show = async () => {
        try {
            const swarm = await load();
            if (disposed) return;

            const positions = new BufferAttribute(
                new Float32Array(swarm.count * 3),
                3,
            );
            positions.setUsage(DynamicDrawUsage);
            const colors = new BufferAttribute(
                new Float32Array(swarm.count * 3),
                3,
            );
            const geometry = new BufferGeometry();
            geometry.setAttribute("position", positions);
            geometry.setAttribute("color", colors);
            geometry.setDrawRange(0, 0);

            const material = new ShaderMaterial({
                uniforms,
                vertexShader: vertex(DOT_PX),
                fragmentShader: FRAGMENT,
                transparent: true,
                depthWrite: false,
                toneMapped: false,
            });
            const points = new Points(geometry, material);
            points.frustumCulled = false;
            points.visible = false;

            const ringGeometry = new BufferGeometry();
            ringGeometry.setAttribute(
                "position",
                new BufferAttribute(new Float32Array(3), 3),
            );
            const ringColor = new BufferAttribute(new Float32Array(3), 3);
            ringGeometry.setAttribute("color", ringColor);
            const ring = new Points(
                ringGeometry,
                new ShaderMaterial({
                    uniforms: ringUniforms,
                    vertexShader: vertex(RING_PX),
                    fragmentShader: RING_FRAGMENT,
                    transparent: true,
                    depthWrite: false,
                    toneMapped: false,
                }),
            );
            ring.frustumCulled = false;
            ring.visible = false;

            const orbitGeometry = new LineGeometry();
            orbitGeometry.setPositions(
                new Float32Array((ORBIT_SAMPLES + 1) * 3),
            );
            const orbitSegments = orbitGeometry.getAttribute("instanceStart");
            if (!(orbitSegments instanceof InterleavedBufferAttribute)) {
                throw new Error("The orbit's attributes aren't interleaved.");
            }
            const orbit = new Line2(
                orbitGeometry,
                new LineMaterial({
                    linewidth: SELECTED_LINE_PX,
                    transparent: true,
                    depthWrite: false,
                    toneMapped: false,
                }),
            );
            orbit.material.resolution.set(viewport.width, viewport.height);
            // The segments move each frame, so the bounds would be stale.
            orbit.frustumCulled = false;
            orbit.visible = false;

            const text = document.createElement("div");
            text.className = "orrery__label orrery__label--hover";
            const labelName = document.createElement("span");
            labelName.className = "orrery__label-name";
            text.append(labelName);
            const label = new CSS2DObject(text);
            // Its left edge sits on the satellite, as a body's label does.
            label.center.set(0, 0.5);
            label.visible = false;

            scene.add(points, ring, orbit, label);

            loaded = {
                swarm,
                points,
                positions,
                colors,
                geometry,
                material,
                screen: new Float32Array(swarm.count * 2),
                ring,
                ringColor,
                orbit,
                orbitSegments,
                label,
                labelName,
            };
            paint(loaded);
            stale = true;
        } catch (error) {
            if (disposed) return;

            // Let the next group change try again.
            started = false;
            // The only report of a failed optional asset, and the project has no logger.
            console.warn("Couldn't load the satellites.", error);
        }
    };

    return {
        groups: (groups) => {
            wanted = new Set(groups);
            stale = true;

            if (wanted.size > 0 && !started) {
                started = true;
                void show();
            }
        },
        update: (frameCamera, t, hostOffsetKm, viewportHeight) => {
            if (!loaded) return;

            camera = frameCamera;
            lastT = t;
            const { swarm, points, positions, colors, geometry } = loaded;
            let fade = 0;
            let density = 1;
            if (hostOffsetKm && wanted.size > 0 && inSnapshotWindow(swarm, t)) {
                points.position.set(
                    hostOffsetKm.x,
                    hostOffsetKm.y,
                    hostOffsetKm.z,
                );
                const distance = camera.position.distanceTo(points.position);
                const fov = (camera.fov * Math.PI) / 180;
                const ringPx =
                    2 *
                    projectedRadiusPx(
                        geoRadiusKm,
                        distance,
                        fov,
                        viewportHeight,
                    );
                fade = smoothstep(FADE_FROM_PX, FADE_TO_PX, ringPx);

                const shellPx = projectedRadiusPx(
                    leoRadiusKm,
                    distance,
                    fov,
                    viewportHeight,
                );
                const dotsArea = shown.length * Math.PI * (DOT_PX / 2) ** 2;
                density = Math.min(
                    Math.max(
                        (MAX_COVER * Math.PI * shellPx ** 2) / dotsArea,
                        MIN_DENSITY,
                    ),
                    1,
                );
            }
            uniforms.fade.value = fade * density;
            points.visible = fade > 0;
            if (fade === 0) {
                writtenAt = null;
                loaded.ring.visible = false;
                loaded.orbit.visible = false;
                loaded.label.visible = false;

                return;
            }

            if (stale) {
                shown = selectShown(swarm, wanted);
                shown.forEach((k, slot) => {
                    theme
                        .classColor(swarm.classes[k] ?? "leo")
                        .toArray(colors.array, slot * 3);
                });
                geometry.setDrawRange(0, shown.length);
                colors.needsUpdate = true;
                stale = false;
                writtenAt = null;
            }
            if (writtenAt !== t) {
                swarm.positionsAt(t, shown, positions.array as Float32Array);
                positions.needsUpdate = true;
                writtenAt = t;
            }

            const { ring, orbit, label, labelName } = loaded;
            ring.visible = selected !== null && available(selected);
            orbit.visible = ring.visible;
            if (selected !== null && ring.visible) {
                locate(swarm, selected, t);
                ring.position.set(
                    points.position.x + (local[0] as number),
                    points.position.y + (local[1] as number),
                    points.position.z + (local[2] as number),
                );
                orbit.position.copy(points.position);

                if (sampled?.t !== t || sampled.k !== selected) {
                    const loop = swarm.orbitAt(selected, t, ORBIT_SAMPLES);
                    const array = loaded.orbitSegments.data
                        .array as Float32Array;
                    for (let n = 0; n < ORBIT_SAMPLES; n++) {
                        array.set(loop.subarray(n * 3, n * 3 + 6), n * 6);
                    }
                    loaded.orbitSegments.data.needsUpdate = true;
                    sampled = { t, k: selected };
                }
            }

            label.visible = hovered !== null && available(hovered);
            if (hovered !== null && label.visible) {
                locate(swarm, hovered, t);
                label.position.set(
                    points.position.x + (local[0] as number),
                    points.position.y + (local[1] as number),
                    points.position.z + (local[2] as number),
                );
                if (named !== hovered) {
                    labelName.textContent = swarm.names[hovered] ?? "";
                    named = hovered;
                }
            }
        },
        pick: (x, y, width, height) => {
            if (!loaded?.points.visible || !camera) return null;

            const { points, positions, screen } = loaded;
            const view = camera.matrixWorldInverse.elements;
            const projection = camera.projectionMatrix.elements;
            const centre = points.position;

            // The host's disc hides what is farther than its centre.
            const hostDistance = camera.position.distanceTo(centre);
            const hostRadiusPx = projectedRadiusPx(
                host.radius / 1000,
                hostDistance,
                (camera.fov * Math.PI) / 180,
                height,
            );
            const hostW = toPx(
                view,
                projection,
                centre.x,
                centre.y,
                centre.z,
                width,
                height,
                hostPx,
                0,
            );
            const hostSquared = hostDistance ** 2;
            const eye = camera.position;

            const array = positions.array;
            for (let slot = 0; slot < shown.length; slot++) {
                const px = centre.x + (array[slot * 3] as number);
                const py = centre.y + (array[slot * 3 + 1] as number);
                const pz = centre.z + (array[slot * 3 + 2] as number);
                const o = slot * 2;

                const w = toPx(
                    view,
                    projection,
                    px,
                    py,
                    pz,
                    width,
                    height,
                    screen,
                    o,
                );
                const hidden =
                    hostW > 0 &&
                    (px - eye.x) ** 2 + (py - eye.y) ** 2 + (pz - eye.z) ** 2 >
                        hostSquared &&
                    Math.hypot(
                        (screen[o] as number) - (hostPx[0] as number),
                        (screen[o + 1] as number) - (hostPx[1] as number),
                    ) < hostRadiusPx;
                if (w <= 0 || hidden) screen[o] = Number.NaN;
            }

            const slot = pickNearest(screen, shown.length, x, y, PICK_PX);

            return slot === -1 ? null : (shown[slot] ?? null);
        },
        select: (k) => {
            selected = k;
            if (loaded) paint(loaded);
        },
        hover: (k) => {
            hovered = k;
        },
        positionOf: (k, t, centre) => {
            if (!loaded || k >= loaded.swarm.count) return null;
            if (!inSnapshotWindow(loaded.swarm, t)) return null;

            locate(loaded.swarm, k, t);

            return {
                x: centre.x + (local[0] as number) * 1000,
                y: centre.y + (local[1] as number) * 1000,
                z: centre.z + (local[2] as number) * 1000,
            };
        },
        facts: (k, t) =>
            loaded && k < loaded.swarm.count
                ? satelliteFacts(loaded.swarm, k, t)
                : null,
        available,
        resize: (pixelRatio, width, height) => {
            uniforms.pixelRatio.value = pixelRatio;
            viewport = { width, height };
            loaded?.orbit.material.resolution.set(width, height);
        },
        dispose: () => {
            disposed = true;
            if (!loaded) return;

            const { points, ring, orbit, label } = loaded;
            scene.remove(points, ring, orbit, label);
            loaded.geometry.dispose();
            loaded.material.dispose();
            ring.geometry.dispose();
            ring.material.dispose();
            orbit.geometry.dispose();
            orbit.material.dispose();
            loaded = null;
        },
    };
};
