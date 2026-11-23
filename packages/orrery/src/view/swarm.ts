/**
 * @module
 * The satellite snapshot drawn as one layer of points around Earth.
 */

import type { Vec3 } from "@cpluspatch/orbit";
import {
    BufferAttribute,
    BufferGeometry,
    DynamicDrawUsage,
    type PerspectiveCamera,
    Points,
    type Scene,
    ShaderMaterial,
} from "three";
import { decodeCatalogue, type SatelliteGroup } from "../catalogue.ts";
import {
    inSnapshotWindow,
    prepareSwarm,
    type Swarm,
    selectShown,
    writePositions,
} from "../swarm.ts";
import { projectedRadiusPx } from "./geometry/visibility.ts";
import type { Theme } from "./theme.ts";

const SATELLITES_URL = new URL("../assets/satellites.bin", import.meta.url);

/** The radius of the geostationary ring in km. Its size on screen says how far Earth is zoomed. */
const GEO_RADIUS_KM = 42_164;

/** The swarm fades in as the GEO ring grows from the first diameter to the second, in px. */
const FADE_FROM_PX = 150;
const FADE_TO_PX = 300;

/** The diameter of a satellite's dot in CSS px. */
const DOT_PX = 2;

const OPACITY = 0.7;

/** The satellites around Earth. */
export type SwarmLayer = {
    /** Sets the groups drawn. The first non-empty list starts loading the snapshot. */
    groups: (groups: readonly SatelliteGroup[]) => void;
    /**
     * Places and draws the swarm for the frame. `earthOffsetKm` is Earth's centre from the
     * scene's origin in km, or `null` if there's no Earth.
     */
    update: (
        camera: PerspectiveCamera,
        t: number,
        earthOffsetKm: Vec3 | null,
        viewportHeight: number,
    ) => void;
    resize: (pixelRatio: number) => void;
    dispose: () => void;
};

// The log depth chunks make the points hide behind Earth under `logarithmicDepthBuffer`.
const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 color;
uniform float pixelRatio;
varying vec3 vColor;

void main() {
    vColor = color;
    gl_PointSize = ${DOT_PX.toFixed(1)} * pixelRatio;
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
};

/**
 * The satellite layer in `scene`. Nothing is fetched until a group is turned on.
 * `earthMu` is Earth's gravitational parameter in m³/s², which turns mean motion into an orbit size.
 */
export const createSwarm = (
    scene: Scene,
    theme: Theme,
    earthMu: number,
): SwarmLayer => {
    const loading = new AbortController();
    const uniforms = { pixelRatio: { value: 1 }, fade: { value: 0 } };
    let wanted = new Set<SatelliteGroup>();
    let started = false;
    let loaded: Loaded | null = null;
    // Indices of the satellites drawn, in slot order. Rebuilt when the groups change.
    let shown: Uint32Array = new Uint32Array(0);
    let stale = true;
    // The time the positions were written for, so a paused clock isn't propagated again.
    let writtenAt: number | null = null;

    const load = async () => {
        try {
            const response = await fetch(SATELLITES_URL, {
                signal: loading.signal,
            });
            if (!response.ok) {
                throw new Error(
                    `The satellite file gave ${response.status} ${response.statusText}.`,
                );
            }
            const bytes = new Uint8Array(await response.arrayBuffer());
            loading.signal.throwIfAborted();

            const swarm = prepareSwarm(decodeCatalogue(bytes), earthMu);
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
                vertexShader: VERTEX,
                fragmentShader: FRAGMENT,
                transparent: true,
                depthWrite: false,
                toneMapped: false,
            });
            const points = new Points(geometry, material);
            points.frustumCulled = false;
            points.visible = false;
            scene.add(points);

            loaded = {
                swarm,
                points,
                positions,
                colors,
                geometry,
                material,
            };
            stale = true;
        } catch (error) {
            if (loading.signal.aborted) return;

            // Let the next group change try again.
            started = false;
            console.warn("The Orrery couldn't load the satellites.", error);
        }
    };

    return {
        groups: (groups) => {
            wanted = new Set(groups);
            stale = true;

            if (wanted.size > 0 && !started) {
                started = true;
                void load();
            }
        },
        update: (camera, t, earthOffsetKm, viewportHeight) => {
            if (!loaded) return;

            const { swarm, points, positions, colors, geometry } = loaded;
            let fade = 0;
            if (
                earthOffsetKm &&
                wanted.size > 0 &&
                inSnapshotWindow(swarm, t)
            ) {
                points.position.set(
                    earthOffsetKm.x,
                    earthOffsetKm.y,
                    earthOffsetKm.z,
                );
                const distance = camera.position.distanceTo(points.position);
                const ringPx =
                    2 *
                    projectedRadiusPx(
                        GEO_RADIUS_KM,
                        distance,
                        (camera.fov * Math.PI) / 180,
                        viewportHeight,
                    );
                fade = smoothstep(FADE_FROM_PX, FADE_TO_PX, ringPx);
            }
            uniforms.fade.value = fade;
            points.visible = fade > 0;
            if (fade === 0) {
                writtenAt = null;

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
                writePositions(
                    swarm,
                    shown,
                    t,
                    positions.array as Float32Array,
                );
                positions.needsUpdate = true;
                writtenAt = t;
            }
        },
        resize: (pixelRatio) => {
            uniforms.pixelRatio.value = pixelRatio;
        },
        dispose: () => {
            loading.abort();
            if (!loaded) return;

            scene.remove(loaded.points);
            loaded.geometry.dispose();
            loaded.material.dispose();
            loaded = null;
        },
    };
};
