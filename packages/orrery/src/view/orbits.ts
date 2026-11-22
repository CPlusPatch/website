import type { Body, Elements, State, Vec3 } from "@cpluspatch/orbit";
import {
    eccentricAnomalyOf,
    orbitPoints,
    orbitPointsAt,
    wrapAngle,
} from "@cpluspatch/orbit";
import {
    Color,
    CustomBlending,
    InterleavedBufferAttribute,
    MaxEquation,
    NormalBlending,
    type PerspectiveCamera,
    type Scene,
    SRGBColorSpace,
    Vector3,
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import {
    arcLengthAt,
    nearAnomalies,
    nearestPoint,
    orbitNear,
    orbitShown,
    projectedRadiusPx,
    trailAlpha,
    trailBack,
} from "./geometry.ts";

/** The orbit lines of a scene. */
export type Orbits = {
    /**
     * Moves each line to its parent's position relative to `origin`, fades it back from its body
     * against the clock's `rate`, and hides it if it shows too small or too big.
     */
    update: (
        origin: Vec3,
        states: Map<string, State>,
        camera: PerspectiveCamera,
        rate: number,
    ) => void;
    /** Draws the orbit of a body, or of none, in the pick colour and thicker. */
    highlight: (id: string | null) => void;
    /** Draws the line of `body` again from its new elements. */
    rebuild: (body: Body) => void;
    /** Draws a dashed line for `elements` around the parent of `body`, or none with `null`. */
    ghost: (body: Body, elements: Elements | null) => void;
    /** Switches the lines to read over the sky, which has no flat ground colour to fade into. */
    sky: (shown: boolean) => void;
    /** Sets the line width's screen size. */
    resize: (width: number, height: number) => void;
    /** Removes the lines and frees them. */
    dispose: () => void;
};

type Paint = { index: number; direction: number; picked: boolean; dim: number };

type Orbit = {
    body: Body;
    parent: string;
    line: Line2;
    casing: Line2;
    /** The loop's points, in km. */
    positions: Float32Array;
    /** The line's vertex colours, which are rewritten as the body moves. */
    colors: InterleavedBufferAttribute["data"];
    /** The line's segments, as start and end xyz triples. */
    segments: InterleavedBufferAttribute["data"];
    /** Whether the segments hold the near layout. */
    near: boolean;
    /** What the colours show now, or `null` if they're stale. */
    paint: Paint | null;
    /** The linear colour at each step back along the trail. */
    ramp: Float32Array;
};

type Ghost = {
    body: Body;
    parent: string;
    line: Line2;
    elements: Elements;
    /** The loop's points, in km. */
    positions: Float32Array;
    /** The distance along the loop at each of its points, in km. */
    cumulative: Float64Array;
    /** The line's segments, as start and end xyz triples. */
    segments: InterleavedBufferAttribute["data"];
    /** The line's dash distances, as start and end pairs. */
    distances: InterleavedBufferAttribute["data"];
    /** Whether the segments hold the near layout. */
    near: boolean;
};

/** Few samples bow the chords of a big orbit off a spacecraft's path. */
const SAMPLES = 2048;

const LINE_PX = 1.1;
const SELECTED_LINE_PX = 2.25;
const GHOST_LINE_PX = 2;
const CASING_PX = 4;

/** How much a picked orbit's trail dims while a ghost shows. */
const GHOST_DIM = 0.4;

/** The casing is the line plus a margin, so it grows with the line. */
const casingPx = (linePx: number): number => CASING_PX + (linePx - LINE_PX);

/** The closed loop of an orbit's points, in km. */
const orbitPositions = (elements: Elements): Float32Array => {
    const points = orbitPoints(elements, SAMPLES);
    const positions = new Float32Array(points.length + 3);
    for (let k = 0; k < points.length; k++) {
        positions[k] = (points[k] ?? 0) / 1000;
    }
    // Repeat the first point to close the loop.
    positions.set(positions.subarray(0, 3), points.length);

    return positions;
};

/** Writes a vertex into the segment that ends there and the one that starts there. */
const setVertex = (
    array: InterleavedBufferAttribute["data"]["array"],
    vertex: number,
    x: number,
    y: number,
    z: number,
): void => {
    if (vertex > 0) {
        array[6 * (vertex - 1) + 3] = x;
        array[6 * (vertex - 1) + 4] = y;
        array[6 * (vertex - 1) + 5] = z;
    }
    if (vertex < SAMPLES) {
        array[6 * vertex] = x;
        array[6 * vertex + 1] = y;
        array[6 * vertex + 2] = z;
    }
};

/** The line geometry of an orbit, in km, with room for vertex colours. */
const orbitGeometry = (
    elements: Elements,
): Pick<Orbit, "positions" | "colors" | "segments"> & {
    geometry: LineGeometry;
} => {
    const positions = orbitPositions(elements);
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    geometry.setColors(new Float32Array(positions.length));

    const colors = geometry.getAttribute("instanceColorStart");
    const segments = geometry.getAttribute("instanceStart");
    if (
        !(colors instanceof InterleavedBufferAttribute) ||
        !(segments instanceof InterleavedBufferAttribute)
    ) {
        throw new Error("The orbit's attributes aren't interleaved.");
    }

    return {
        geometry,
        positions,
        colors: colors.data,
        segments: segments.data,
    };
};

/** The distance along a polyline of x, y, z triples at each of its vertices. */
const arcLengths = (positions: Float32Array): Float64Array => {
    const out = new Float64Array(positions.length / 3);
    for (let k = 1; k < out.length; k++) {
        out[k] =
            (out[k - 1] ?? 0) +
            Math.hypot(
                (positions[3 * k] ?? 0) - (positions[3 * k - 3] ?? 0),
                (positions[3 * k + 1] ?? 0) - (positions[3 * k - 2] ?? 0),
                (positions[3 * k + 2] ?? 0) - (positions[3 * k - 1] ?? 0),
            );
    }

    return out;
};

/** Writes a vertex's distance along the line into the segment that ends there and the one that starts there. */
const setDistance = (
    array: InterleavedBufferAttribute["data"]["array"],
    vertex: number,
    distance: number,
): void => {
    if (vertex > 0) array[2 * (vertex - 1) + 1] = distance;
    if (vertex < SAMPLES) array[2 * vertex] = distance;
};

/** The dashes and gaps along a ghost line, so an orbit has this many of each. */
const GHOST_DASHES = 160;

/** One line per body that has an orbit, in km. */
export const createOrbits = (
    scene: Scene,
    bodies: Body[],
    color: (body: Body) => Color,
    background: Color,
    pick: Color,
): Orbits => {
    const orbits: Orbit[] = [];
    let ghost: Ghost | null = null;
    // The ghost may be made after the last resize.
    let size = { width: 0, height: 0 };
    let pickedId: string | null = null;
    let skyShown = false;

    const mixed = new Color();
    const paintRamp = (orbit: Orbit, picked: boolean, dim: number) => {
        // Mixed in sRGB, like a canvas alpha blend, so faint lines don't wash out.
        // Over the sky the tail fades to black, which the max blend leaves out.
        const from = skyShown
            ? { r: 0, g: 0, b: 0 }
            : background.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
        const to = (picked ? pick : color(orbit.body)).getRGB(
            { r: 0, g: 0, b: 0 },
            SRGBColorSpace,
        );
        for (let back = 0; back < SAMPLES; back++) {
            const alpha = trailAlpha(back, SAMPLES, picked) * dim;
            mixed.setRGB(
                from.r + (to.r - from.r) * alpha,
                from.g + (to.g - from.g) * alpha,
                from.b + (to.b - from.b) * alpha,
                SRGBColorSpace,
            );
            mixed.toArray(orbit.ramp, 3 * back);
        }
    };

    const paint = (orbit: Orbit, next: Paint) => {
        const dim = next.picked ? next.dim : 1;
        const now = orbit.paint;
        if (!now || now.picked !== next.picked || now.dim !== next.dim) {
            paintRamp(orbit, next.picked, dim);
        }

        for (let vertex = 0; vertex <= SAMPLES; vertex++) {
            const back = trailBack(
                vertex % SAMPLES,
                next.index,
                SAMPLES,
                next.direction,
            );
            setVertex(
                orbit.colors.array,
                vertex,
                orbit.ramp[3 * back] ?? 0,
                orbit.ramp[3 * back + 1] ?? 0,
                orbit.ramp[3 * back + 2] ?? 0,
            );
        }
        orbit.colors.needsUpdate = true;
        orbit.paint = next;
    };

    const target = new Vector3();
    const parentAt = new Vector3();

    // The static points sag off the ellipse and round badly at float32, so near the camera the
    // loop is resampled around the body, in float64 relative to the origin.
    const rebuildNear = (
        orbit: Orbit,
        parentR: Vec3,
        r: Vec3,
        origin: Vec3,
        distance: number,
        next: Paint,
    ) => {
        const elements = orbit.body.elements;
        if (!elements) return;

        const center = eccentricAnomalyOf(elements, {
            x: r.x - parentR.x,
            y: r.y - parentR.y,
            z: r.z - parentR.z,
        });
        const anomalies = nearAnomalies(
            center,
            distance / (4 * (elements.a / 1000)),
            SAMPLES,
        );
        const points = orbitPointsAt(elements, anomalies);
        const dim = next.picked ? next.dim : 1;
        const now = orbit.paint;
        if (!now || now.picked !== next.picked || now.dim !== next.dim) {
            paintRamp(orbit, next.picked, dim);
        }

        const index = (anomaly: number): number =>
            Math.round((wrapAngle(anomaly) / (2 * Math.PI)) * SAMPLES) %
            SAMPLES;
        const bodyIndex = index(center);
        for (let vertex = 0; vertex <= SAMPLES; vertex++) {
            const back =
                3 *
                trailBack(
                    index(anomalies[vertex] ?? 0),
                    bodyIndex,
                    SAMPLES,
                    next.direction,
                );
            setVertex(
                orbit.segments.array,
                vertex,
                (parentR.x - origin.x + (points[3 * vertex] ?? 0)) / 1000,
                (parentR.y - origin.y + (points[3 * vertex + 1] ?? 0)) / 1000,
                (parentR.z - origin.z + (points[3 * vertex + 2] ?? 0)) / 1000,
            );
            setVertex(
                orbit.colors.array,
                vertex,
                orbit.ramp[back] ?? 0,
                orbit.ramp[back + 1] ?? 0,
                orbit.ramp[back + 2] ?? 0,
            );
        }
        orbit.segments.needsUpdate = true;
        orbit.colors.needsUpdate = true;
        orbit.paint = next;
        orbit.near = true;
        for (const line of [orbit.line, orbit.casing]) {
            line.position.set(0, 0, 0);
            line.frustumCulled = false;
        }
    };

    const restoreStatic = (orbit: Orbit) => {
        for (let vertex = 0; vertex <= SAMPLES; vertex++) {
            setVertex(
                orbit.segments.array,
                vertex,
                orbit.positions[3 * vertex] ?? 0,
                orbit.positions[3 * vertex + 1] ?? 0,
                orbit.positions[3 * vertex + 2] ?? 0,
            );
        }
        orbit.segments.needsUpdate = true;
        orbit.near = false;
        orbit.line.frustumCulled = true;
        orbit.casing.frustumCulled = true;
        orbit.paint = null;
    };

    // The same near layout as an orbit's, around the vertex nearest the camera.
    const rebuildGhostNear = (
        g: Ghost,
        parentR: Vec3,
        origin: Vec3,
        center: number,
        distance: number,
    ) => {
        const aKm = g.elements.a / 1000;
        const anomalies = nearAnomalies(center, distance / (4 * aKm), SAMPLES);
        const points = orbitPointsAt(g.elements, anomalies);

        for (let vertex = 0; vertex <= SAMPLES; vertex++) {
            setVertex(
                g.segments.array,
                vertex,
                (parentR.x - origin.x + (points[3 * vertex] ?? 0)) / 1000,
                (parentR.y - origin.y + (points[3 * vertex + 1] ?? 0)) / 1000,
                (parentR.z - origin.z + (points[3 * vertex + 2] ?? 0)) / 1000,
            );
            // Keeps the dashes on the ellipse as the vertices move.
            setDistance(
                g.distances.array,
                vertex,
                arcLengthAt(g.cumulative, anomalies[vertex] ?? 0),
            );
        }
        g.segments.needsUpdate = true;
        g.distances.needsUpdate = true;
        g.near = true;
        g.line.position.set(0, 0, 0);
        g.line.frustumCulled = false;
    };

    const restoreGhostStatic = (g: Ghost) => {
        for (let vertex = 0; vertex <= SAMPLES; vertex++) {
            setVertex(
                g.segments.array,
                vertex,
                g.positions[3 * vertex] ?? 0,
                g.positions[3 * vertex + 1] ?? 0,
                g.positions[3 * vertex + 2] ?? 0,
            );
            setDistance(g.distances.array, vertex, g.cumulative[vertex] ?? 0);
        }
        g.segments.needsUpdate = true;
        g.distances.needsUpdate = true;
        g.near = false;
        g.line.frustumCulled = true;
    };

    const updateGhost = (
        origin: Vec3,
        states: Map<string, State>,
        camera: PerspectiveCamera,
    ) => {
        if (!ghost) return;

        const parentR = states.get(ghost.parent)?.r;
        if (!parentR) return;

        parentAt.set(
            (parentR.x - origin.x) / 1000,
            (parentR.y - origin.y) / 1000,
            (parentR.z - origin.z) / 1000,
        );

        let near = false;
        let vertex = 0;
        let distance = Infinity;
        if (ghost.line.visible) {
            target.copy(camera.position).sub(parentAt);
            vertex = nearestPoint(
                ghost.positions,
                SAMPLES,
                target.x,
                target.y,
                target.z,
            );
            distance = Math.hypot(
                target.x - (ghost.positions[3 * vertex] ?? 0),
                target.y - (ghost.positions[3 * vertex + 1] ?? 0),
                target.z - (ghost.positions[3 * vertex + 2] ?? 0),
            );
            near = orbitNear(distance, ghost.elements.a / 1000);
        }
        if (ghost.near && !near) restoreGhostStatic(ghost);
        if (near) {
            const center = (2 * Math.PI * vertex) / SAMPLES;
            rebuildGhostNear(ghost, parentR, origin, center, distance);
        } else {
            ghost.line.position.copy(parentAt);
        }
    };

    // Over the sky the casing is a dark rail, and additive lines turn white where segments overlap.
    const styleLines = (orbit: Orbit) => {
        const { line, casing } = orbit;
        line.material.blending = skyShown ? CustomBlending : NormalBlending;
        line.material.blendEquation = MaxEquation;
        line.material.needsUpdate = true;
        casing.material.visible = !skyShown;
    };

    for (const body of bodies) {
        if (body.parent === null || body.elements === null) continue;

        const { geometry, positions, colors, segments } = orbitGeometry(
            body.elements,
        );
        const material = new LineMaterial({
            linewidth: LINE_PX,
            transparent: true,
            opacity: 1,
            // The vertex colours carry the fade, so the line's own colour mustn't tint them.
            color: 0xffffff,
            vertexColors: true,
        });
        const line = new Line2(geometry, material);
        // Keeps the line readable where it crosses a sphere.
        const casing = new Line2(
            geometry,
            new LineMaterial({
                linewidth: casingPx(LINE_PX),
                transparent: true,
                depthWrite: false,
                color: background,
            }),
        );
        casing.renderOrder = -1;

        scene.add(casing, line);
        const orbit: Orbit = {
            body,
            parent: body.parent,
            line,
            casing,
            positions,
            colors,
            segments,
            near: false,
            paint: null,
            ramp: new Float32Array(3 * SAMPLES),
        };
        styleLines(orbit);
        orbits.push(orbit);
    }

    return {
        ghost: (body, elements) => {
            if (!elements || body.parent === null) {
                if (ghost) ghost.line.visible = false;
                return;
            }

            const positions = orbitPositions(elements);
            const cumulative = arcLengths(positions);
            const geometry = new LineGeometry();
            geometry.setPositions(positions);
            const dash = (cumulative[SAMPLES] ?? 0) / GHOST_DASHES;

            let line = ghost?.line;
            if (!line) {
                const material = new LineMaterial({
                    linewidth: GHOST_LINE_PX,
                    dashed: true,
                    transparent: true,
                });
                material.resolution.set(size.width, size.height);
                line = new Line2(geometry, material);
                scene.add(line);
            } else {
                line.geometry.dispose();
                line.geometry = geometry;
            }
            line.material.dashSize = dash;
            line.material.gapSize = dash;
            line.material.color.copy(pick);
            line.computeLineDistances();
            line.frustumCulled = true;
            line.visible = true;

            const segments = geometry.getAttribute("instanceStart");
            const distances = geometry.getAttribute("instanceDistanceStart");
            if (
                !(segments instanceof InterleavedBufferAttribute) ||
                !(distances instanceof InterleavedBufferAttribute)
            ) {
                throw new Error("The ghost's attributes aren't interleaved.");
            }
            ghost = {
                body,
                parent: body.parent,
                line,
                elements,
                positions,
                cumulative,
                segments: segments.data,
                distances: distances.data,
                near: false,
            };
        },
        rebuild: (body) => {
            const orbit = orbits.find(
                (candidate) => candidate.body.id === body.id,
            );
            if (!orbit || !body.elements) return;

            const { geometry, positions, colors, segments } = orbitGeometry(
                body.elements,
            );
            orbit.line.geometry.dispose();
            orbit.line.geometry = geometry;
            orbit.casing.geometry = geometry;
            orbit.body = body;
            orbit.positions = positions;
            orbit.colors = colors;
            orbit.segments = segments;
            orbit.paint = null;
            // The new geometry has the static layout.
            if (orbit.near) restoreStatic(orbit);
        },
        update: (origin, states, camera, rate) => {
            const fov = (camera.fov * Math.PI) / 180;
            const direction = rate < 0 ? -1 : 1;
            const dim = ghost?.line.visible ? GHOST_DIM : 1;

            for (const orbit of orbits) {
                const { body, parent, line, casing } = orbit;
                const parentR = states.get(parent)?.r;
                if (!parentR || !body.elements) continue;

                parentAt.set(
                    (parentR.x - origin.x) / 1000,
                    (parentR.y - origin.y) / 1000,
                    (parentR.z - origin.z) / 1000,
                );

                const aPx = projectedRadiusPx(
                    body.elements.a / 1000,
                    camera.position.distanceTo(parentAt),
                    fov,
                    size.height,
                );
                const shown = orbitShown(aPx, size.width, size.height);
                line.visible = shown;
                casing.visible = shown;

                const r = states.get(body.id)?.r;
                const distance = r
                    ? camera.position.distanceTo(
                          target.set(
                              (r.x - origin.x) / 1000,
                              (r.y - origin.y) / 1000,
                              (r.z - origin.z) / 1000,
                          ),
                      )
                    : Infinity;
                const near = orbitNear(distance, body.elements.a / 1000);
                if (orbit.near && !near) restoreStatic(orbit);
                if (!near) {
                    line.position.copy(parentAt);
                    casing.position.copy(parentAt);
                }
                if (!shown || !r) continue;

                const picked = body.id === pickedId;
                if (near) {
                    rebuildNear(orbit, parentR, r, origin, distance, {
                        index: 0,
                        direction,
                        picked,
                        dim,
                    });
                    continue;
                }

                const next: Paint = {
                    index: nearestPoint(
                        orbit.positions,
                        SAMPLES,
                        (r.x - parentR.x) / 1000,
                        (r.y - parentR.y) / 1000,
                        (r.z - parentR.z) / 1000,
                    ),
                    direction,
                    picked,
                    dim,
                };
                const now = orbit.paint;
                if (
                    !now ||
                    now.index !== next.index ||
                    now.direction !== next.direction ||
                    now.picked !== next.picked ||
                    now.dim !== next.dim
                ) {
                    paint(orbit, next);
                }
            }

            updateGhost(origin, states, camera);
        },
        highlight: (id) => {
            pickedId = id;
            for (const orbit of orbits) {
                const px = orbit.body.id === id ? SELECTED_LINE_PX : LINE_PX;
                orbit.line.material.linewidth = px;
                orbit.casing.material.linewidth = casingPx(px);
                orbit.paint = null;
            }
        },
        sky: (shown) => {
            skyShown = shown;
            for (const orbit of orbits) {
                styleLines(orbit);
                orbit.paint = null;
            }
        },
        resize: (width, height) => {
            size = { width, height };
            ghost?.line.material.resolution.set(width, height);
            for (const { line, casing } of orbits) {
                line.material.resolution.set(width, height);
                casing.material.resolution.set(width, height);
            }
        },
        dispose: () => {
            if (ghost) {
                ghost.line.removeFromParent();
                ghost.line.geometry.dispose();
                ghost.line.material.dispose();
            }
            for (const { line, casing } of orbits) {
                line.removeFromParent();
                casing.removeFromParent();
                line.geometry.dispose();
                line.material.dispose();
                casing.material.dispose();
            }
        },
    };
};
