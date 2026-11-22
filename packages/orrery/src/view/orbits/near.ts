import type { Vec3 } from "@cpluspatch/orbit";
import {
    eccentricAnomalyOf,
    orbitPointsAt,
    wrapAngle,
} from "@cpluspatch/orbit";
import { nearAnomalies, trailBack } from "../geometry/along-orbit.ts";
import { SAMPLES, setVertex } from "./line-geometry.ts";
import type { Orbit, Paint } from "./types.ts";

/**
 * The static points sag off the ellipse and round badly at float32, so near the camera the
 * loop is resampled around the body, in float64 relative to the origin.
 */
export const rebuildNear = (
    orbit: Orbit,
    parentR: Vec3,
    r: Vec3,
    origin: Vec3,
    distance: number,
    next: Paint,
    paintRamp: (orbit: Orbit, picked: boolean, dim: number) => void,
): void => {
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
        Math.round((wrapAngle(anomaly) / (2 * Math.PI)) * SAMPLES) % SAMPLES;
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

/** Puts an orbit's line back on its static points. */
export const restoreStatic = (orbit: Orbit): void => {
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
