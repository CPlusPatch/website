/**
 * @module
 * Which orbits, labels and markers show, by their size and place on screen.
 */

import type { BodyKind, Vec3 } from "@cpluspatch/orbit";

/** The gap in px under which a marker hides behind a larger body's. */
export const MARKER_GAP_PX = 6;

/** The size on screen, in px, of a sphere seen from `distance`, in the same unit as `radius`. */
export const projectedRadiusPx = (
    radius: number,
    distance: number,
    fovRad: number,
    viewportHeightPx: number,
): number =>
    (radius / (distance * Math.tan(fovRad / 2))) * (viewportHeightPx / 2);

/** An orbit whose semi-major axis shows under this many px is left out, as its parent's rings. */
export const ORBIT_MIN_PX = 16;

/** A body whose orbit shows under this many px has no label, unless it's picked or hovered. */
export const LABEL_MIN_ORBIT_PX = 28;

/** An orbit whose semi-major axis shows over this many times the viewport's longer side is left out. */
export const ORBIT_MAX_VIEWPORTS = 4;

/**
 * Whether an orbit with a semi-major axis of `aPx` is drawn in a viewport of this size.
 * A `picked` orbit has no upper limit, since an eccentric one can pass close by.
 */
export const orbitShown = (
    aPx: number,
    width: number,
    height: number,
    picked = false,
): boolean =>
    aPx >= ORBIT_MIN_PX &&
    (picked || aPx <= ORBIT_MAX_VIEWPORTS * Math.max(width, height));

/** Whether the label of a body with an orbit of `aPx` shows. Bodies with no orbit always show. */
export const labelShownForOrbit = (
    aPx: number | undefined,
    keep: boolean,
): boolean => keep || aPx === undefined || aPx >= LABEL_MIN_ORBIT_PX;

/** An orbit's body and parent, and the px its semi-major axis shows as. */
export type OrbitPx = { id: string; parent: string; aPx: number };

/**
 * The bodies folded into their parents, by parent id, in input order.
 * An orbit under `ORBIT_MIN_PX` folds, unless its body is in `keep`.
 */
export const foldOrbits = (
    orbits: readonly OrbitPx[],
    keep: ReadonlySet<string>,
): Map<string, string[]> => {
    const folded = new Map<string, string[]>();

    for (const { id, parent, aPx } of orbits) {
        if (aPx >= ORBIT_MIN_PX || keep.has(id)) continue;

        folded.set(parent, [...(folded.get(parent) ?? []), id]);
    }

    return folded;
};

/** Where labels sort: the star, then planets, then the rest, each by `mu`. */
export const labelRank = (kind: BodyKind, mu: number): number => {
    const tier = kind === "star" ? 2 : kind === "planet" ? 1 : 0;

    // The log of any real mu is under 100, so tiers never mix.
    return tier + Math.log10(1 + mu) / 100;
};

/** A rectangle in px that belongs to a body, for hiding the lower-ranked body's. */
export type Box = {
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    rank: number;
};

/** The ids of boxes within `gap` of a higher-ranked box, except those in `keep`. */
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
                other.rank > box.rank &&
                box.left < other.right + gap &&
                other.left < box.right + gap &&
                box.top < other.bottom + gap &&
                other.top < box.bottom + gap,
        );
        if (covered) hidden.add(box.id);
    }

    return hidden;
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
            rank: radius,
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
