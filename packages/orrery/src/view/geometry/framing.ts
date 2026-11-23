/**
 * @module
 * The camera's distances, fit and focus moves, and the shift of the view's centre.
 */

import type { Body, Scenario, Vec3 } from "@cpluspatch/orbit";

/** A camera distance in km and the floating origin it orbits, in metres. */
export type Pose = { distance: number; position: Vec3 };

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

/** The farthest point of a body's orbit from its parent, in km. */
const apoapsisKm = (body: Body): number =>
    ((body.elements?.a ?? 0) * (1 + (body.elements?.e ?? 0))) / 1000;

/**
 * The radius in km the opening view frames: the 4th planet's apoapsis from the root, so the inner
 * planets fill the view. With fewer planets it is the farthest one's, and with none it is `reachKm`.
 */
export const openingReachKm = (scenario: Scenario): number => {
    const root = scenario.bodies.find((body) => body.parent === null);
    if (!root) throw new Error("The scenario has no root body.");

    const planets = scenario.bodies
        .filter((body) => body.parent === root.id && body.kind === "planet")
        .sort((a, b) => (a.elements?.a ?? 0) - (b.elements?.a ?? 0));
    const chosen = planets[3] ?? planets.at(-1);

    return chosen ? apoapsisKm(chosen) : reachKm(scenario);
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

/**
 * The camera distance in km that frames a body: its farthest child's orbit fits the view, or
 * the body spans 25% of the view's height if it has no children.
 */
export const frameDistanceKm = (
    scenario: Scenario,
    id: string,
    fovRad: number,
    aspect: number,
): number => {
    const body = scenario.bodies.find((candidate) => candidate.id === id);
    if (!body) throw new Error(`There is no body "${id}".`);

    const children = scenario.bodies.filter((child) => child.parent === id);
    if (children.length === 0) {
        return body.radius / 1000 / Math.sin(0.125 * fovRad);
    }

    const tanVertical = Math.tan(fovRad / 2);
    const tanNarrow = Math.min(tanVertical, tanVertical * aspect);

    return (Math.max(...children.map(apoapsisKm)) * FIT_MARGIN) / tanNarrow;
};

/** The camera distance from a body of radius `rNew` that shows it as big as one of `rOld` at `distance`. */
export const keepSizeDistanceKm = (
    distance: number,
    rOld: number,
    rNew: number,
): number => (distance * rNew) / rOld;

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

/** The zoom-out to zoom-in ratio of a focus glide's path, the value van Wijk and Nuij found best. */
const RHO = Math.SQRT2;

/**
 * The pose at progress `s` between two poses, on van Wijk and Nuij's smooth zoom and pan path. A
 * far move pulls back so both ends stay in view, and a move in place zooms by ratio.
 * `tanHalfFov` is the tangent of half the vertical field of view.
 */
export const focusTween = (
    from: Pose,
    to: Pose,
    s: number,
    tanHalfFov: number,
): Pose => {
    const k = ease(s);
    if (k === 1) return { distance: to.distance, position: { ...to.position } };

    // View widths and the move in km; positions are in metres.
    const w0 = 2 * from.distance * tanHalfFov;
    const w1 = 2 * to.distance * tanHalfFov;
    const dx = to.position.x - from.position.x;
    const dy = to.position.y - from.position.y;
    const dz = to.position.z - from.position.z;
    const u1 = Math.hypot(dx, dy, dz) / 1000;

    let width: number;
    let p: number;
    if (u1 <= 1e-9 * Math.max(w0, w1)) {
        width = w0 * (w1 / w0) ** k;
        p = k;
    } else {
        const rho2 = RHO * RHO;
        const b0 =
            (w1 * w1 - w0 * w0 + rho2 * rho2 * u1 * u1) / (2 * w0 * rho2 * u1);
        const b1 =
            (w1 * w1 - w0 * w0 - rho2 * rho2 * u1 * u1) / (2 * w1 * rho2 * u1);
        const r0 = -Math.asinh(b0);
        const r = r0 + (-Math.asinh(b1) - r0) * k;

        width = (w0 * Math.cosh(r0)) / Math.cosh(r);
        p = ((w0 / rho2) * (Math.cosh(r0) * Math.tanh(r) - Math.sinh(r0))) / u1;
    }

    return {
        distance: width / (2 * tanHalfFov),
        position: {
            x: from.position.x + dx * p,
            y: from.position.y + dy * p,
            z: from.position.z + dz * p,
        },
    };
};

/** Moves a distance toward `to` by ratio, leaving `e^(-dt / tau)` of the gap, so held keys add up smoothly. */
export const approachDistance = (
    from: number,
    to: number,
    dt: number,
    tau: number,
): number => from * (to / from) ** (1 - Math.exp(-dt / tau));
