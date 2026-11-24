import type { Vec3 } from "@cpluspatch/orbit";
import {
    eccentricAnomalyOf,
    elementsAt,
    orbitPointsAt,
} from "@cpluspatch/orbit";
import { nearAnomalies, trailBackAt } from "../geometry/along-orbit.ts";
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
    t: number,
    next: Paint,
    paintRamp: (orbit: Orbit, picked: boolean, dim: number) => void,
): void => {
    const elements = elementsAt(orbit.body, t);
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

    for (let vertex = 0; vertex <= SAMPLES; vertex++) {
        // Rounding to the trail's steps would paint every point near the body as its head.
        const back = trailBackAt(
            (anomalies[vertex] ?? 0) - center,
            SAMPLES,
            next.direction,
        );
        const from = Math.floor(back);
        const to = Math.min(from + 1, SAMPLES - 1);
        const k = back - from;
        const mix = (channel: number): number =>
            (orbit.ramp[3 * from + channel] ?? 0) * (1 - k) +
            (orbit.ramp[3 * to + channel] ?? 0) * k;
        setVertex(
            orbit.segments.array,
            vertex,
            (parentR.x - origin.x + (points[3 * vertex] ?? 0)) / 1000,
            (parentR.y - origin.y + (points[3 * vertex + 1] ?? 0)) / 1000,
            (parentR.z - origin.z + (points[3 * vertex + 2] ?? 0)) / 1000,
        );
        setVertex(orbit.colors.array, vertex, mix(0), mix(1), mix(2));
    }
    // The segment ahead of the body is long when zoomed in, and blending head into tail smears it.
    const half = SAMPLES / 2;
    const ahead = next.direction > 0 ? 6 * half : 6 * (half - 1);
    const [head, tail] =
        next.direction > 0 ? [ahead, ahead + 3] : [ahead + 3, ahead];
    for (let channel = 0; channel < 3; channel++) {
        orbit.colors.array[head + channel] =
            orbit.colors.array[tail + channel] ?? 0;
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
