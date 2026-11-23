/**
 * @module
 * The camera's distances, fit and focus moves, and the shift of the view's centre.
 */

import type { Body, Scenario, Vec3 } from "@cpluspatch/orbit";
import { AU } from "@cpluspatch/orbit";

/** A camera distance in km and the floating origin it orbits, in metres. */
export type Pose = { distance: number; position: Vec3 };

/** The camera distance in km a body is focused at. */
export const focusDistanceKm = (body: Body): number =>
    Math.max(body.radius * 6, 0.05 * (body.elements?.a ?? 50 * AU)) / 1000;

/** The closest the camera may get to a body, in km: its sphere spans 80% of the view's height. */
export const minDistanceKm = (body: Body, fovRad: number): number =>
    Math.max(body.radius / 1000 / Math.sin(0.4 * fovRad), 0.01);

/** The farthest a planet or star gets from the root, in km, or the root's radius if there are none. */
export const reachKm = (scenario: Scenario): number => {
    const root = scenario.bodies.find((body) => body.parent === null);
    if (!root) throw new Error("The scenario has no root body.");

    return (
        Math.max(
            ...scenario.bodies
                // Not dwarfs, so Pluto's wide orbit doesn't shrink the view. Stars count, so a
                // companion star like 40 Eridani B stays in reach.
                .filter(
                    (body) =>
                        body.parent === root.id &&
                        (body.kind === "planet" || body.kind === "star"),
                )
                .map(
                    (body) =>
                        (body.elements?.a ?? 0) * (1 + (body.elements?.e ?? 0)),
                ),
            root.radius,
        ) / 1000
    );
};

/** The margin, as a share of the viewport, left around the orbit of the fit. */
const FIT_MARGIN = 1.1;

/**
 * The camera distance in km at which a circle of `radiusKm` in the ecliptic fits the view.
 * The camera looks at the circle's centre from `elevationRad` above the plane.
 */
export const fitDistanceKm = (
    radiusKm: number,
    fovRad: number,
    aspect: number,
    elevationRad: number,
): number => {
    const tanVertical = Math.tan(fovRad / 2);
    const tanHorizontal = tanVertical * aspect;
    const cos = Math.cos(elevationRad);
    const sin = Math.sin(elevationRad);

    // Each side is the largest of (extent - depth offset) over the circle, in radii.
    const sides = Math.hypot(FIT_MARGIN / tanHorizontal, cos);
    const nearAndFar = (FIT_MARGIN * sin) / tanVertical + cos;

    return radiusKm * Math.max(sides, nearAndFar);
};

/** The rows of a view that no panel covers, in px from its top. */
export type Band = { top: number; bottom: number };

/** How far up, in whole px, to shift a view of `height` so its centre is the middle of `band`. */
export const centreShift = (height: number, band: Band): number =>
    Math.round(height / 2 - (band.top + band.bottom) / 2);

/** Eases progress in [0, 1] with a smoothstep. */
export const ease = (s: number): number => {
    const c = Math.min(Math.max(s, 0), 1);

    return c * c * (3 - 2 * c);
};

/** The pose at progress `s` between two poses: distance by ratio, position by the distance covered. */
export const focusTween = (from: Pose, to: Pose, s: number): Pose => {
    const k = ease(s);
    if (k === 1) return { distance: to.distance, position: { ...to.position } };

    const distance = Math.exp(
        Math.log(from.distance) +
            (Math.log(to.distance) - Math.log(from.distance)) * k,
    );
    // Moving by `k` while the zoom runs by ratio leaves the target off screen until the end.
    const p =
        to.distance === from.distance
            ? k
            : (distance - from.distance) / (to.distance - from.distance);

    return {
        distance,
        position: {
            x: from.position.x + (to.position.x - from.position.x) * p,
            y: from.position.y + (to.position.y - from.position.y) * p,
            z: from.position.z + (to.position.z - from.position.z) * p,
        },
    };
};
