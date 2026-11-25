/**
 * @module
 * What each body shows on screen in one update, as three passes: `orbitSizes` for what
 * folds, `layoutBodies` for where each body is and how it's drawn, and `settleLabels` for
 * which labels, markers and picks survive.
 * The caller restyles the labels between the first two, since the "+N" count changes their size.
 */

import type { Vec3 } from "@cpluspatch/orbit";
import type { BodyKind } from "@cpluspatch/sim";
import type { PickPoint } from "../picking.ts";
import {
    type Dot,
    LABEL_ANCHOR_GAP_PX,
    type LabelBox,
    labelRect,
    type Placement,
    placeLabels,
    type Rect,
} from "./labels.ts";
import { READOUT_BLOCK_PX, READOUTS_MIN_ORBIT_PX } from "./notes.ts";
import {
    type Anchor,
    coronaDiameter,
    culledByParent,
    foldOrbits,
    hiddenBehindSpheres,
    hiddenMarkers,
    labelRank,
    labelShownForOrbit,
    type MarkerPoint,
    orbitShown,
    projectedRadiusPx,
    type Sphere,
} from "./visibility.ts";

/** The projected radius in px from which a sphere replaces the marker. */
export const SPHERE_MIN_PX = 4;

/** The projected radius in px from which a model replaces the marker, since smaller it's a few dark pixels. */
export const MODEL_MIN_PX = 12;

/** The ms a label keeps a new placement, so a fast moon doesn't blink as it passes other labels. */
export const LABEL_HOLD_MS = 500;

/** The kinds whose markers are icons rather than plain dots, which bare mode hides. */
const ICON_KINDS: ReadonlySet<BodyKind> = new Set([
    "spacecraft",
    "asteroid",
    "comet",
]);

/** What a pass needs to know of a body. */
export type ScreenBody = {
    id: string;
    parent: string | null;
    kind: BodyKind;
    mu: number;
    /** The radius in m. */
    radius: number;
    /** The semi-major axis in m, or null for the root. */
    a: number | null;
    /** Whether it has a model, which replaces its sphere from `MODEL_MIN_PX`. */
    model: boolean;
    /** The marker's size in px. */
    markerPx: number;
};

/** A viewport's size in px. */
export type Viewport = { width: number; height: number };

/** The disc of the selected body on screen, in px from the canvas's top left. */
export type Disc = { id: string; x: number; y: number; radiusPx: number };

const distance = (a: Vec3, b: Vec3): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

/** Whether a body is labelled big: stars, planets and the focus. */
export const isMajor = (
    body: Pick<ScreenBody, "id" | "kind">,
    focus: string,
): boolean =>
    body.kind === "star" || body.kind === "planet" || body.id === focus;

/** The "+N" text of a label: empty with nothing hidden, the names when hovered, else the count. */
export const countText = (
    hidden: readonly string[],
    names: ReadonlyMap<string, string>,
    hovered: boolean,
): string =>
    !hidden.length
        ? ""
        : hovered
          ? `+ ${hidden.map((id) => names.get(id)).join(", ")}`
          : `+${hidden.length}`;

/** The placements that changed less than `LABEL_HOLD_MS` before `now`, which stay as they are. */
export const heldPlacements = (
    placements: ReadonlyMap<string, Placement>,
    changed: ReadonlyMap<string, number>,
    now: number,
): Map<string, Placement> => {
    const held = new Map<string, Placement>();

    for (const [id, placement] of placements) {
        if (now - (changed.get(id) ?? -Infinity) < LABEL_HOLD_MS) {
            held.set(id, placement);
        }
    }

    return held;
};

/** What the orbits' sizes on screen decide. */
export type OrbitSizes = {
    /** Each orbit's semi-major axis in px, by body id. */
    orbitPx: Map<string, number>;
    /** The ids folded into each parent, by parent id. */
    folds: Map<string, string[]>;
    /** Every folded id. */
    folded: Set<string>;
};

/**
 * The size of each orbit on screen and the bodies it folds, except those in `keep`.
 * `positions` are in km from the view's origin.
 */
export const orbitSizes = (
    bodies: readonly ScreenBody[],
    positions: ReadonlyMap<string, Vec3>,
    camera: Vec3,
    fov: number,
    viewport: Viewport,
    keep: ReadonlySet<string>,
): OrbitSizes => {
    const orbitPx = new Map<string, number>();

    for (const body of bodies) {
        if (body.parent === null || body.a === null) continue;

        const parent = positions.get(body.parent);
        if (!parent) continue;

        orbitPx.set(
            body.id,
            projectedRadiusPx(
                body.a / 1000,
                distance(camera, parent),
                fov,
                viewport.height,
            ),
        );
    }

    const folds = foldOrbits(
        bodies.flatMap(({ id, parent }) => {
            const aPx = orbitPx.get(id);

            return parent && aPx !== undefined ? [{ id, parent, aPx }] : [];
        }),
        keep,
    );

    return { orbitPx, folds, folded: new Set([...folds.values()].flat()) };
};

/** Where a body is and how it's drawn. */
export type BodyLayout = {
    /** The distance from the camera in km. */
    depth: number;
    radiusPx: number;
    /** Whether it's a sphere or model, and not a marker. */
    big: boolean;
    /** Whether the sphere is so close it needs the fine geometry. */
    fine: boolean;
    /** The world diameter of the corona in km. */
    coronaDiameter: number;
    /** The px from the label's anchor to its box. */
    offset: number;
    /** Where it is on screen, or null behind the camera. */
    screen: { x: number; y: number } | null;
};

/** The bodies laid out, and what `settleLabels` works from. */
export type Layout = {
    /** The bodies in the pass, by id, in input order. */
    bodies: Map<string, BodyLayout>;
    anchors: Anchor[];
    spheres: Sphere[];
    labels: LabelBox[];
    markers: MarkerPoint[];
    dots: Dot[];
    picks: PickPoint[];
    /** The selected body's disc, or null when it isn't drawn big or is behind the camera. */
    drawn: Disc | null;
};

/** What `layoutBodies` reads. */
export type LayoutInput = {
    bodies: readonly ScreenBody[];
    /** Positions in km from the view's origin. Bodies without one are left out. */
    positions: ReadonlyMap<string, Vec3>;
    /** From `orbitSizes`. */
    sizes: OrbitSizes;
    /** The label's size in px by body id, measured after the restyle. */
    text: ReadonlyMap<string, { width: number; height: number }>;
    camera: Vec3;
    fov: number;
    viewport: Viewport;
    focus: string;
    selected: string | null;
    hovered: string | null;
    keep: ReadonlySet<string>;
    /** The point on screen in px and in camera space, or null when it's behind the camera. */
    project: (position: Vec3) => { x: number; y: number; view: Vec3 } | null;
};

/** Lays out every body that has a position and isn't folded. */
export const layoutBodies = (input: LayoutInput): Layout => {
    const { positions, sizes, text, camera, fov, viewport, project } = input;
    const { focus, selected, hovered, keep } = input;
    const layout: Layout = {
        bodies: new Map(),
        anchors: [],
        spheres: [],
        labels: [],
        markers: [],
        dots: [],
        picks: [],
        drawn: null,
    };

    // The picked orbit's readouts show from the same size as `readouts.ts` uses.
    const pickedPx = selected ? sizes.orbitPx.get(selected) : undefined;
    const readoutRoom =
        pickedPx !== undefined &&
        pickedPx > READOUTS_MIN_ORBIT_PX &&
        orbitShown(pickedPx, viewport.width, viewport.height, true);

    for (const body of input.bodies) {
        const position = positions.get(body.id);
        if (!position || sizes.folded.has(body.id)) continue;

        const depth = distance(camera, position);
        const radiusPx = projectedRadiusPx(
            body.radius / 1000,
            depth,
            fov,
            viewport.height,
        );
        const big = radiusPx >= (body.model ? MODEL_MIN_PX : SPHERE_MIN_PX);
        const markerRadius = body.markerPx / 2;
        // Pushes the label from the disc's or marker's centre to its edge.
        const offset =
            LABEL_ANCHOR_GAP_PX + Math.round(big ? radiusPx : markerRadius);
        const projected = project(position);
        const entry: BodyLayout = {
            depth,
            radiusPx,
            big,
            fine: radiusPx > viewport.height,
            coronaDiameter: coronaDiameter(
                body.radius / 1000,
                depth,
                fov,
                viewport.height,
            ),
            offset,
            screen: projected && { x: projected.x, y: projected.y },
        };
        layout.bodies.set(body.id, entry);
        if (!projected) continue;

        const { x, y, view } = projected;
        layout.picks.push({
            id: body.id,
            x,
            y,
            depth,
            radius: big ? radiusPx : markerRadius,
        });
        layout.anchors.push({ id: body.id, pos: view });
        if (big && body.id === selected) {
            layout.drawn = { id: body.id, x, y, radiusPx };
        }
        const size = text.get(body.id);
        if (
            size &&
            labelShownForOrbit(
                sizes.orbitPx.get(body.id),
                keep.has(body.id) || body.id === hovered,
            )
        ) {
            layout.labels.push({
                id: body.id,
                x,
                y,
                width: size.width,
                height: size.height,
                offset,
                disc: big,
                rank: labelRank(body.kind, body.mu),
                big: isMajor(body, focus),
                readout:
                    readoutRoom && body.id === selected
                        ? READOUT_BLOCK_PX
                        : undefined,
            });
        }
        if (big) {
            layout.spheres.push({
                id: body.id,
                pos: view,
                radius: body.radius / 1000,
            });
        } else {
            layout.markers.push({ id: body.id, x, y, radius: body.radius });
            layout.dots.push({ id: body.id, x, y, size: markerRadius });
        }
    }

    return layout;
};

/** What `settleLabels` reads. */
export type SettleInput = {
    /** Every body, including those that are folded or have no position. */
    bodies: readonly ScreenBody[];
    layout: Layout;
    viewport: Viewport;
    focus: string;
    selected: string | null;
    hovered: string | null;
    keep: ReadonlySet<string>;
    /** From `orbitSizes`. */
    folded: ReadonlySet<string>;
    /** Whether bare mode hides the icon markers. */
    bare: boolean;
    /** The last update's placements, to find which changed. */
    previous: ReadonlyMap<string, Placement>;
    /** From `heldPlacements`. */
    held: ReadonlyMap<string, Placement>;
    /** The side each label is drawn on. */
    sides: ReadonlyMap<string, Placement>;
    /** Rects labels keep out of. */
    blocked: readonly Rect[];
};

/** What each laid out body shows after the labels settled. */
export type Shown = {
    /** Whether its marker shows. */
    marker: boolean;
    /** Whether its corona shows. */
    corona: boolean;
};

/** What the labels settling decides. */
export type Settled = {
    /** Every body's placement. Bodies not in it have none. */
    placements: Map<string, Placement>;
    /** The ids whose placement differs from `previous`. */
    changed: string[];
    /** The moons and craft whose labels are hidden, so their markers would show unnamed. */
    unnamed: Set<string>;
    /** The ids of `unnamed` by parent id, for the "+N" counts. */
    culled: Map<string, string[]>;
    /** The icon markers that bare mode hides. */
    bareHidden: Set<string>;
    /** The boxes of the shown labels. */
    placed: Map<string, Rect>;
    /** What shows of each body in `layout.bodies`. */
    shown: Map<string, Shown>;
    /** The picks of the bodies that show. */
    picks: PickPoint[];
};

/** Places the labels and hides the markers and picks of bodies that are behind a sphere, covered or unnamed. */
export const settleLabels = (input: SettleInput): Settled => {
    const { bodies, layout, viewport, focus, selected, hovered, keep } = input;
    const behind = hiddenBehindSpheres(layout.anchors, layout.spheres, keep);
    const covered = hiddenMarkers(layout.markers, keep);
    const placements = placeLabels(
        layout.labels.filter(({ id }) => !behind.has(id)),
        viewport,
        focus,
        layout.dots.filter(({ id }) => !covered.has(id)),
        [selected, hovered].filter((id) => id !== null),
        input.sides,
        input.blocked,
        input.held,
    );
    const changed: string[] = [];
    for (const [id, placement] of placements) {
        if (placement !== (input.previous.get(id) ?? "hidden")) {
            changed.push(id);
        }
    }

    // A moon or craft with no label would show as an unnamed marker.
    const unnamed = new Set<string>();
    for (const { id, kind } of bodies) {
        if (
            (placements.get(id) ?? "hidden") === "hidden" &&
            (kind === "moon" || kind === "spacecraft") &&
            !keep.has(id) &&
            id !== hovered
        ) {
            unnamed.add(id);
        }
    }

    // The "+N" counts them too, once placement has culled them.
    const culled = culledByParent(bodies, unnamed, input.folded);

    const boxes = new Map(layout.labels.map((box) => [box.id, box]));
    const placed = new Map<string, Rect>();
    const bareHidden = new Set<string>();
    const shown = new Map<string, Shown>();
    for (const { id, kind } of bodies) {
        const placement = placements.get(id) ?? "hidden";
        const box = boxes.get(id);
        if (box && placement !== "hidden") {
            placed.set(id, labelRect(box, placement));
        }

        const entry = layout.bodies.get(id);
        if (!entry) continue;

        if (input.bare && !entry.big && ICON_KINDS.has(kind)) {
            bareHidden.add(id);
        }
        const hidden = covered.has(id) || unnamed.has(id) || bareHidden.has(id);
        shown.set(id, {
            marker: !entry.big && !hidden,
            // The disc, when drawn, still glows.
            corona: entry.big || !hidden,
        });
    }

    return {
        placements,
        changed,
        unnamed,
        culled,
        bareHidden,
        placed,
        shown,
        picks: layout.picks.filter(
            ({ id }) =>
                !behind.has(id) &&
                !covered.has(id) &&
                !unnamed.has(id) &&
                !bareHidden.has(id),
        ),
    };
};
