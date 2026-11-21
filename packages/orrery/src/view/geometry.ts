/**
 * @module
 * Camera and screen math for the view, with no three.js and no DOM.
 */

import type { Body, Scenario, Vec3 } from "@cpluspatch/orbit";
import { AU } from "@cpluspatch/orbit";

/** A camera distance in km and the floating origin it orbits, in metres. */
export type Pose = { distance: number; position: Vec3 };

/** The gap in px under which two labels count as touching. */
const LABEL_GAP_PX = 4;

/** The gap in px under which a marker hides behind a larger body's. */
const MARKER_GAP_PX = 6;

/** The size on screen, in px, of a sphere seen from `distance`, in the same unit as `radius`. */
export const projectedRadiusPx = (
    radius: number,
    distance: number,
    fovRad: number,
    viewportHeightPx: number,
): number =>
    (radius / (distance * Math.tan(fovRad / 2))) * (viewportHeightPx / 2);

/** The camera distance in km a body is focused at. */
export const focusDistanceKm = (body: Body): number =>
    Math.max(body.radius * 6, 0.05 * (body.elements?.a ?? 50 * AU)) / 1000;

/** The closest the camera may get to a body, in km: its sphere spans 80% of the view's height. */
export const minDistanceKm = (body: Body, fovRad: number): number =>
    Math.max(body.radius / 1000 / Math.sin(0.4 * fovRad), 0.01);

/** The farthest a planet gets from the root, in km, or the root's radius if there are none. */
export const reachKm = (scenario: Scenario): number => {
    const root = scenario.bodies.find((body) => body.parent === null);
    if (!root) throw new Error("The scenario has no root body.");

    return (
        Math.max(
            ...scenario.bodies
                // Planets only, so Pluto's wide orbit doesn't shrink the view.
                .filter(
                    (body) => body.parent === root.id && body.kind === "planet",
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

/** A rectangle in px that belongs to a body, for hiding the smaller body's. */
type Box = {
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    radius: number;
};

/** The ids of boxes within `gap` of a larger body's box, except those in `keep`. */
const hiddenByLarger = (
    boxes: Box[],
    keep: ReadonlySet<string>,
    gap: number,
): Set<string> => {
    const hidden = new Set<string>();

    for (const box of boxes) {
        if (keep.has(box.id)) continue;

        const covered = boxes.some(
            (other) =>
                other.radius > box.radius &&
                box.left < other.right + gap &&
                other.left < box.right + gap &&
                box.top < other.bottom + gap &&
                other.top < box.bottom + gap,
        );
        if (covered) hidden.add(box.id);
    }

    return hidden;
};

/** A label's anchor on screen, its size in px and its body's radius in metres. */
export type LabelBox = {
    id: string;
    x: number;
    y: number;
    /** The width of the box in px, without `offset`. */
    width: number;
    height: number;
    /** The px from the anchor to the nearest edge of the box. */
    offset: number;
    /** Whether the body is drawn as a sphere, so its anchor is its centre. */
    disc: boolean;
    radius: number;
};

/** A rectangle on screen in px, from the canvas's top left. */
export type Rect = { left: number; top: number; right: number; bottom: number };

/** The rows of a view that no panel covers, in px from its top. */
export type Band = { top: number; bottom: number };

/** How far up, in whole px, to shift a view of `height` so its centre is the middle of `band`. */
export const centreShift = (height: number, band: Band): number =>
    Math.round(height / 2 - (band.top + band.bottom) / 2);

/** A body's marker on screen, with its half-width in px. */
export type Dot = { id: string; x: number; y: number; size: number };

/** Where a label goes: right of its anchor, left of it, or nowhere. */
export type Placement = "right" | "left" | "hidden";

/** The px between a label and its anchor. */
export const LABEL_ANCHOR_GAP_PX = 6;

/**
 * Where each label goes. The focus is placed first, then each of `pinned` (the selection,
 * then the hovered body) in order, then larger bodies before smaller.
 * A label tries the right of its anchor, then the left, and hides if both run
 * off the viewport or touch a larger body's label. It also hides when its anchor
 * is on top of an earlier label's anchor, and never covers another body's dot.
 * The focus is never hidden, and a pinned label only when it's off screen.
 * A label tries the side it had in `previous` first, so it doesn't jump when the selection changes.
 * A side that overlaps a `blocked` rect, like a panel, isn't free.
 */
export const placeLabels = (
    labels: LabelBox[],
    viewport: { width: number; height: number },
    focus: string,
    dots: Dot[] = [],
    pinned: readonly string[] = [],
    previous: ReadonlyMap<string, Placement> = new Map(),
    blocked: readonly Rect[] = [],
): Map<string, Placement> => {
    const placements = new Map<string, Placement>();
    const placed: Box[] = [];
    const anchors: { x: number; y: number }[] = [];
    const priority = (label: LabelBox) =>
        label.id === focus
            ? Infinity
            : pinned.includes(label.id)
              ? Number.MAX_VALUE / (pinned.indexOf(label.id) + 1)
              : label.radius;

    for (const label of [...labels].sort((a, b) => priority(b) - priority(a))) {
        const { id, x, y, width, height, offset } = label;
        const radius = priority(label);

        // A sphere's anchor is its centre, which is far from its edge once it's off screen.
        const margin = label.disc ? 0 : width;
        // A disc that fills the viewport has no edge to put a label on.
        const huge =
            label.disc &&
            id !== focus &&
            offset - LABEL_ANCHOR_GAP_PX >
                Math.max(viewport.width, viewport.height) / 2;
        const outside =
            huge ||
            x < -margin ||
            x > viewport.width + margin ||
            y < -margin ||
            y > viewport.height + margin;
        // From far away a moon sits on its planet, and two labels on one dot read as one body.
        const stacked =
            !pinned.includes(id) &&
            anchors.some(
                (other) => Math.hypot(other.x - x, other.y - y) < MARKER_GAP_PX,
            );
        if (outside || stacked) {
            placements.set(id, "hidden");
            continue;
        }
        anchors.push({ x, y });

        const right: Box = {
            id,
            left: x + offset,
            top: y - height / 2,
            right: x + offset + width,
            bottom: y + height / 2,
            radius,
        };
        const left: Box = {
            ...right,
            left: x - offset - width,
            right: x - offset,
        };
        const free = (box: Box, onScreen: boolean) =>
            onScreen &&
            !blocked.some(
                (rect) =>
                    box.left < rect.right &&
                    rect.left < box.right &&
                    box.top < rect.bottom &&
                    rect.top < box.bottom,
            ) &&
            !placed.some(
                (other) =>
                    other.radius > radius &&
                    box.left < other.right + LABEL_GAP_PX &&
                    other.left < box.right + LABEL_GAP_PX &&
                    box.top < other.bottom + LABEL_GAP_PX &&
                    other.top < box.bottom + LABEL_GAP_PX,
            ) &&
            !dots.some(
                (dot) =>
                    dot.id !== id &&
                    box.left < dot.x + dot.size &&
                    dot.x - dot.size < box.right &&
                    box.top < dot.y + dot.size &&
                    dot.y - dot.size < box.bottom,
            );

        const fitsRight = free(right, right.right <= viewport.width);
        const fitsLeft = free(left, left.left >= 0);
        const placement: Placement =
            fitsLeft && (previous.get(id) === "left" || !fitsRight)
                ? "left"
                : fitsRight || id === focus || pinned.includes(id)
                  ? "right"
                  : "hidden";

        placements.set(id, placement);
        if (placement !== "hidden") {
            placed.push(placement === "right" ? right : left);
        }
    }

    return placements;
};

/** A body's marker centre on screen and its radius in metres. */
export type MarkerPoint = { id: string; x: number; y: number; radius: number };

/** The ids of markers close to a larger body's marker, except those in `keep`. */
export const hiddenMarkers = (
    markers: MarkerPoint[],
    keep: ReadonlySet<string>,
): Set<string> =>
    hiddenByLarger(
        markers.map(({ id, x, y, radius }) => ({
            id,
            left: x,
            top: y,
            right: x,
            bottom: y,
            radius,
        })),
        keep,
        MARKER_GAP_PX,
    );

/** A point in camera space, with the same unit as the radii it's tested against. */
export type Anchor = { id: string; pos: Vec3 };

/** A sphere in camera space. */
export type Sphere = Anchor & { radius: number };

/**
 * The ids of anchors that a nearer sphere hides from the camera, except those in `keep`.
 * This works in 3D, since a big sphere near the camera doesn't project to a circle.
 */
export const hiddenBehindSpheres = (
    anchors: Anchor[],
    spheres: Sphere[],
    keep: ReadonlySet<string>,
): Set<string> => {
    const hidden = new Set<string>();

    for (const { id, pos } of anchors) {
        if (keep.has(id)) continue;

        const distance = Math.hypot(pos.x, pos.y, pos.z);
        const behind = spheres.some((sphere) => {
            const { x, y, z } = sphere.pos;
            const centre = Math.hypot(x, y, z);
            // The centre's distance along the ray to the anchor.
            const along = (x * pos.x + y * pos.y + z * pos.z) / distance;

            return (
                centre < distance &&
                along > 0 &&
                centre * centre - along * along < sphere.radius ** 2
            );
        });
        if (behind) hidden.add(id);
    }

    return hidden;
};

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
