/**
 * @module
 * Camera and screen math for the view, with no three.js and no DOM.
 */

import type {
    Body,
    BodyKind,
    Elements,
    Scenario,
    Vec3,
} from "@cpluspatch/orbit";
import { AU, wrapAngle } from "@cpluspatch/orbit";

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

/** An orbit whose semi-major axis shows under this many px is left out, as its parent's rings. */
export const ORBIT_MIN_PX = 16;

/** A body whose orbit shows under this many px has no label, unless it's picked or hovered. */
export const LABEL_MIN_ORBIT_PX = 28;

/** An orbit whose semi-major axis shows over this many times the viewport's longer side is left out. */
export const ORBIT_MAX_VIEWPORTS = 4;

/** Whether an orbit with a semi-major axis of `aPx` is drawn in a viewport of this size. */
export const orbitShown = (
    aPx: number,
    width: number,
    height: number,
): boolean =>
    aPx >= ORBIT_MIN_PX && aPx <= ORBIT_MAX_VIEWPORTS * Math.max(width, height);

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

/** The first of the `count` xyz points that is nearest to (x, y, z). */
export const nearestPoint = (
    points: ArrayLike<number>,
    count: number,
    x: number,
    y: number,
    z: number,
): number => {
    let best = 0;
    let bestSq = Infinity;
    for (let k = 0; k < count; k++) {
        const dx = (points[k * 3] ?? 0) - x;
        const dy = (points[k * 3 + 1] ?? 0) - y;
        const dz = (points[k * 3 + 2] ?? 0) - z;
        const sq = dx * dx + dy * dy + dz * dz;
        if (sq < bestSq) {
            bestSq = sq;
            best = k;
        }
    }

    return best;
};

/** An orbit closer to the camera than this fraction of its semi-major axis is drawn in the near layout. */
export const NEAR_FRACTION = 0.02;

/** Whether the camera, `distanceKm` from a body, is near enough to its orbit of semi-major axis `aKm`. */
export const orbitNear = (distanceKm: number, aKm: number): boolean =>
    distanceKm < NEAR_FRACTION * aKm;

/**
 * The `count + 1` eccentric anomalies of a near layout, from `center - π` to `center + π`.
 * The offsets from `center` grow geometrically from `first` to π, so samples crowd round the body.
 * `count` is even.
 */
export const nearAnomalies = (
    center: number,
    first: number,
    count: number,
): Float64Array => {
    const half = count / 2;
    const start = Math.min(first, Math.PI);
    const growth = half > 1 ? (Math.PI / start) ** (1 / (half - 1)) : 1;
    const out = new Float64Array(count + 1);

    out[half] = center;
    for (let k = 0; k < half; k++) {
        // The last offset is set outright so rounding can't leave a gap in the loop.
        const offset = k === half - 1 ? Math.PI : start * growth ** k;
        out[half + 1 + k] = center + offset;
        out[half - 1 - k] = center - offset;
    }

    return out;
};

/**
 * The distance along a loop at eccentric anomaly `anomaly`, from a table of its distance at each
 * of `cumulative.length - 1` anomalies spaced evenly from 0 to 2π, the last being the whole loop.
 * It keeps growing as the anomaly goes past 2π, so a pattern along the loop doesn't jump there.
 */
export const arcLengthAt = (
    cumulative: ArrayLike<number>,
    anomaly: number,
): number => {
    const count = cumulative.length - 1;
    const total = cumulative[count] ?? 0;
    const at = (wrapAngle(anomaly) / (2 * Math.PI)) * count;
    // Rounding can put `at` on `count` itself.
    const index = Math.min(Math.floor(at), count - 1);
    const from = cumulative[index] ?? 0;
    const to = cumulative[index + 1] ?? from;

    return (
        from +
        (to - from) * (at - index) +
        total * Math.floor(anomaly / (2 * Math.PI))
    );
};

/** The opacity of an orbit line `back` of `count` steps behind its body, which fades along the trail. */
export const trailAlpha = (
    back: number,
    count: number,
    picked: boolean,
): number => (picked ? 0.3 : 0.12) + (picked ? 0.7 : 0.45) * (1 - back / count);

/** How many samples behind the body a sample is, along the path it came by. */
export const trailBack = (
    sample: number,
    index: number,
    count: number,
    direction: number,
): number =>
    // Samples run with the motion, so the trail is behind the body's index.
    direction > 0
        ? (index - sample + count) % count
        : (sample - index + count) % count;

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

/** A rectangle in px that belongs to a body, for hiding the lower-ranked body's. */
type Box = {
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

/** A label's anchor on screen, its size in px and its rank. */
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
    /** Where it sorts, from `labelRank`. */
    rank: number;
    /** Whether it may also go above or below its anchor. */
    big: boolean;
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

/** Where a label goes: beside its anchor, above or below it, or nowhere. */
export type Placement = "right" | "left" | "above" | "below" | "hidden";

/** The px between a label and its anchor. */
export const LABEL_ANCHOR_GAP_PX = 6;

/** The px an above or below label sits farther out than a side one. */
export const LABEL_VERTICAL_GAP_PX = 8;

/** A label's box on each side of its anchor. */
const labelSpots = (
    { id, x, y, width, height, offset }: LabelBox,
    rank: number,
): Record<Exclude<Placement, "hidden">, Box> => {
    const vertical = offset + LABEL_VERTICAL_GAP_PX;

    return {
        right: {
            id,
            left: x + offset,
            top: y - height / 2,
            right: x + offset + width,
            bottom: y + height / 2,
            rank,
        },
        left: {
            id,
            left: x - offset - width,
            top: y - height / 2,
            right: x - offset,
            bottom: y + height / 2,
            rank,
        },
        above: {
            id,
            left: x - width / 2,
            top: y - vertical - height,
            right: x + width / 2,
            bottom: y - vertical,
            rank,
        },
        below: {
            id,
            left: x - width / 2,
            top: y + vertical,
            right: x + width / 2,
            bottom: y + vertical + height,
            rank,
        },
    };
};

/** The box of a label that `placeLabels` put at `placement`. */
export const labelRect = (
    label: LabelBox,
    placement: Exclude<Placement, "hidden">,
): Rect => {
    const { left, top, right, bottom } = labelSpots(label, 0)[placement];

    return { left, top, right, bottom };
};

/**
 * Where each label goes. The focus is placed first, then each of `pinned` (the selection,
 * then the hovered body) in order, then by rank.
 * A label tries the right of its anchor, then the left, then (if `big`) above and below.
 * It hides if none fits the viewport or avoids a higher-ranked label. It also hides when its anchor
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
              : label.rank;

    for (const label of [...labels].sort((a, b) => priority(b) - priority(a))) {
        const { id, x, y, width, offset } = label;
        const rank = priority(label);

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

        const spots = labelSpots(label, rank);
        const onScreen: Record<Exclude<Placement, "hidden">, boolean> = {
            right: spots.right.right <= viewport.width,
            left: spots.left.left >= 0 && spots.left.right <= viewport.width,
            above:
                spots.above.left >= 0 &&
                spots.above.right <= viewport.width &&
                spots.above.top >= 0,
            below:
                spots.below.left >= 0 &&
                spots.below.right <= viewport.width &&
                spots.below.bottom <= viewport.height,
        };
        const free = (spot: Exclude<Placement, "hidden">) => {
            const box = spots[spot];

            return (
                onScreen[spot] &&
                !blocked.some(
                    (rect) =>
                        box.left < rect.right &&
                        rect.left < box.right &&
                        box.top < rect.bottom &&
                        rect.top < box.bottom,
                ) &&
                !placed.some(
                    (other) =>
                        other.rank > rank &&
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
                )
            );
        };

        const order: Exclude<Placement, "hidden">[] = label.big
            ? ["right", "left", "above", "below"]
            : ["right", "left"];
        const before = previous.get(id);
        // The side it had comes first, so it doesn't jump.
        if (before && before !== "hidden" && order.includes(before)) {
            order.splice(order.indexOf(before), 1);
            order.unshift(before);
        }

        const fits = order.find(free);
        const placement: Placement =
            fits ?? (id === focus || pinned.includes(id) ? "right" : "hidden");

        placements.set(id, placement);
        if (placement !== "hidden") placed.push(spots[placement]);
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

/** A picked orbit shows its apsides and numbers when its semi-major axis is over this many px. */
export const READOUTS_MIN_ORBIT_PX = 120;

/** The px a note's backing extends past its text on each side. */
export const NOTE_PAD_PX = 2;

/** The height of a note's box in px. */
export const NOTE_HEIGHT_PX = 14;

/** The px between a note beside an apsis and the apsis. */
const NOTE_APSIS_GAP_PX = 9;

/** The gap of the notes tried last, which clear the orbit's own line from any direction. */
const NOTE_APSIS_FAR_GAP_PX = 17;

/** The px between a tag's edge and the first line of a note block. */
const NOTE_BLOCK_GAP_PX = 9;

/** The note's box when its text is `width` px wide and centred on (`x`, `y`). */
const noteBox = (x: number, y: number, width: number): Rect => ({
    left: x - width / 2 - NOTE_PAD_PX,
    top: y - NOTE_HEIGHT_PX / 2,
    right: x + width / 2 + NOTE_PAD_PX,
    bottom: y + NOTE_HEIGHT_PX / 2,
});

const TURNS = [0, 0.6, -0.6, 1.2, -1.2];

/**
 * Where a note of text `width` px wide goes beside the point (`x`, `y`) of an orbit centred on
 * (`cx`, `cy`). It tries the outward direction, then turned each way, then inward. Then it tries
 * them again farther out, since a slanted box near the point can touch the line by itself.
 */
export const noteSpots = (
    x: number,
    y: number,
    cx: number,
    cy: number,
    width: number,
): Rect[] => {
    const length = Math.hypot(x - cx, y - cy);
    // A point on the centre has no outward side.
    const ux = length < 1 ? 0 : (x - cx) / length;
    const uy = length < 1 ? -1 : (y - cy) / length;
    const beyond = (nx: number, ny: number, gap: number): Rect => {
        const t =
            gap +
            (Math.abs(nx) * (width + 2 * NOTE_PAD_PX)) / 2 +
            Math.abs(ny) * (NOTE_HEIGHT_PX / 2);

        return noteBox(x + nx * t, y + ny * t, width);
    };

    return [NOTE_APSIS_GAP_PX, NOTE_APSIS_FAR_GAP_PX].flatMap((gap) => [
        ...TURNS.map((angle) =>
            beyond(
                ux * Math.cos(angle) - uy * Math.sin(angle),
                ux * Math.sin(angle) + uy * Math.cos(angle),
                gap,
            ),
        ),
        beyond(-ux, -uy, gap),
    ]);
};

/**
 * Where lines of text `widths` px wide stack against a tag, nearest line first: below it flush
 * left, below flush right, above flush left, above flush right. All the lines are tried at each
 * spot, then the first alone.
 */
export const blockSpots = (
    tag: Rect,
    widths: readonly number[],
    lineHeight: number,
): Rect[][] => {
    const counts = [...new Set([widths.length, 1])];
    const sides = [
        [1, true],
        [1, false],
        [-1, true],
        [-1, false],
    ] as const;

    return counts.flatMap((count) =>
        sides.map(([direction, left]) =>
            widths.slice(0, count).map((width, row) => {
                const x = left ? tag.left + width / 2 : tag.right - width / 2;
                const y =
                    direction > 0
                        ? tag.bottom + NOTE_BLOCK_GAP_PX + row * lineHeight
                        : tag.top - NOTE_BLOCK_GAP_PX - row * lineHeight;

                return noteBox(x, y, width);
            }),
        ),
    );
};

/** Whether the segment from (ax, ay) to (bx, by) touches the rect (Liang-Barsky). */
const segmentTouches = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    rect: Rect,
): boolean => {
    const dx = bx - ax;
    const dy = by - ay;
    let t0 = 0;
    let t1 = 1;

    for (let side = 0; side < 4; side++) {
        const d = side === 0 ? -dx : side === 1 ? dx : side === 2 ? -dy : dy;
        const q =
            side === 0
                ? ax - rect.left
                : side === 1
                  ? rect.right - ax
                  : side === 2
                    ? ay - rect.top
                    : rect.bottom - ay;
        if (d === 0) {
            if (q < 0) return false;
        } else if (d < 0) {
            if (q / d > t1) return false;
            t0 = Math.max(t0, q / d);
        } else {
            if (q / d < t0) return false;
            t1 = Math.min(t1, q / d);
        }
    }

    return t0 <= t1;
};

/**
 * Whether a polyline of x, y pairs passes within `gap` px of `rect`.
 * A segment with a NaN end is a break in the line and is skipped.
 */
export const nearPolyline = (
    rect: Rect,
    points: ArrayLike<number>,
    gap: number,
): boolean => {
    const grown = {
        left: rect.left - gap,
        top: rect.top - gap,
        right: rect.right + gap,
        bottom: rect.bottom + gap,
    };

    for (let k = 2; k + 1 < points.length; k += 2) {
        const ax = points[k - 2] ?? Number.NaN;
        const ay = points[k - 1] ?? Number.NaN;
        const bx = points[k] ?? Number.NaN;
        const by = points[k + 1] ?? Number.NaN;
        if (Number.isNaN(ax + ay + bx + by)) continue;

        if (segmentTouches(ax, ay, bx, by, grown)) return true;
    }

    return false;
};

/** Whether `a` and `b` overlap. Boxes that only touch don't. */
const overlaps = (a: Rect, b: Rect): boolean =>
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top;

/** What a note must keep clear of: the viewport, `taken` boxes and, by `gap` px, a polyline. */
export type Clearance = {
    viewport: { width: number; height: number };
    taken: readonly Rect[];
    line: ArrayLike<number>;
    gap: number;
};

/** Whether `rect` is inside the viewport, off every taken box and `gap` px from the line. */
const isClear = (rect: Rect, { viewport, taken, line, gap }: Clearance) =>
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.right <= viewport.width &&
    rect.bottom <= viewport.height &&
    !taken.some((box) => overlaps(rect, box)) &&
    !nearPolyline(rect, line, gap);

/** The first of `spots` that is clear, or `null`. */
export const firstClear = (
    spots: readonly Rect[],
    clearance: Clearance,
): Rect | null => spots.find((spot) => isClear(spot, clearance)) ?? null;

/** The first of `stacks` whose every box is clear, or `null`. */
export const firstClearStack = (
    stacks: readonly (readonly Rect[])[],
    clearance: Clearance,
): readonly Rect[] | null =>
    stacks.find((stack) => stack.every((spot) => isClear(spot, clearance))) ??
    null;

/** The grips on an edited orbit show when its semi-major axis is over this many px. */
export const GRIPS_MIN_ORBIT_PX = 60;

/** The px between a grip and the drag note beside it. */
const GRIP_NOTE_GAP_PX = 14;

/** The eccentric anomaly of the ascending node, in [0, 2π). */
export const nodeAnomaly = (e: number, argp: number): number => {
    // The node is where the true anomaly is minus the argument of periapsis.
    const nu = -argp;

    return wrapAngle(
        2 *
            Math.atan2(
                Math.sqrt(1 - e) * Math.sin(nu / 2),
                Math.sqrt(1 + e) * Math.cos(nu / 2),
            ),
    );
};

/** The position, relative to the parent, at eccentric anomaly `ea`, in the unit of `el.a`. */
export const pointAtAnomaly = (el: Elements, ea: number): Vec3 => {
    const cO = Math.cos(el.raan);
    const sO = Math.sin(el.raan);
    const cw = Math.cos(el.argp);
    const sw = Math.sin(el.argp);
    const ci = Math.cos(el.i);
    const si = Math.sin(el.i);
    const x = el.a * (Math.cos(ea) - el.e);
    const y = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(ea);
    // The perifocal axes: p points at the periapsis, q is a quarter turn on from it.
    const p = {
        x: cO * cw - sO * sw * ci,
        y: sO * cw + cO * sw * ci,
        z: sw * si,
    };
    const q = {
        x: -cO * sw - sO * cw * ci,
        y: -sO * sw + cO * cw * ci,
        z: cw * si,
    };

    return {
        x: x * p.x + y * q.x,
        y: x * p.y + y * q.y,
        z: x * p.z + y * q.z,
    };
};

/**
 * How far along an axis the pointer is, as a fraction of the axis. The pointer is (`dx`, `dy`) px
 * from the axis's start, the axis ends (`vx`, `vy`) px from it, and `aPx` is the axis's length when
 * seen square on. It's `null` when the axis points at the viewer, so the pointer can't say.
 */
export const axisPosition = (
    dx: number,
    dy: number,
    vx: number,
    vy: number,
    aPx: number,
): number | null => {
    const vv = vx * vx + vy * vy;
    if (vv < (0.25 * aPx) ** 2) return null;

    return (dx * vx + dy * vy) / vv;
};

/**
 * The angle round `centre` of where the ray `origin + s * dir` meets the plane through `centre`
 * with a constant z. It's `null` when the plane is edge-on or lies behind the ray.
 */
export const planeAngle = (
    origin: Vec3,
    dir: Vec3,
    centre: Vec3,
): number | null => {
    if (Math.abs(dir.z) < 0.05 * Math.hypot(dir.x, dir.y, dir.z)) return null;

    const s = (centre.z - origin.z) / dir.z;
    if (s <= 0) return null;

    return Math.atan2(
        origin.y + s * dir.y - centre.y,
        origin.x + s * dir.x - centre.x,
    );
};

/** Where a drag note of text `width` px wide goes beside a grip at (`x`, `y`), best first. */
export const gripNoteSpots = (x: number, y: number, width: number): Rect[] => {
    const half = width / 2 + NOTE_PAD_PX;

    return [
        noteBox(x + GRIP_NOTE_GAP_PX + half, y, width),
        noteBox(x - GRIP_NOTE_GAP_PX - half, y, width),
        noteBox(x, y + 20, width),
    ];
};
