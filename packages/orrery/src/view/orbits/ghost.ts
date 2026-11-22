import type { Body, Elements, State, Vec3 } from "@cpluspatch/orbit";
import { orbitPointsAt } from "@cpluspatch/orbit";
import {
    type Color,
    InterleavedBufferAttribute,
    type PerspectiveCamera,
    type Scene,
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
} from "../geometry/along-orbit.ts";
import {
    arcLengths,
    GHOST_DASHES,
    GHOST_LINE_PX,
    orbitPositions,
    SAMPLES,
    setDistance,
    setVertex,
} from "./line-geometry.ts";
import type { Ghost } from "./types.ts";

/** The same near layout as an orbit's, around the vertex nearest the camera. */
const rebuildGhostNear = (
    g: Ghost,
    parentR: Vec3,
    origin: Vec3,
    center: number,
    distance: number,
): void => {
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

const restoreGhostStatic = (g: Ghost): void => {
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

const target = new Vector3();
const parentAt = new Vector3();

/** Moves the ghost line to its parent, or resamples it near the camera. */
export const updateGhost = (
    ghost: Ghost,
    origin: Vec3,
    states: Map<string, State>,
    camera: PerspectiveCamera,
): void => {
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

/** Draws the dashed line for `elements` around `parent`, reusing the line of `previous` if there is one. */
export const createGhost = (
    scene: Scene,
    previous: Ghost | null,
    body: Body,
    parent: string,
    elements: Elements,
    pick: Color,
    size: { width: number; height: number },
): Ghost => {
    const positions = orbitPositions(elements);
    const cumulative = arcLengths(positions);
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    const dash = (cumulative[SAMPLES] ?? 0) / GHOST_DASHES;

    let line = previous?.line;
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

    return {
        body,
        parent,
        line,
        elements,
        positions,
        cumulative,
        segments: segments.data,
        distances: distances.data,
        near: false,
    };
};
