/**
 * @module
 * Where labels go on screen, so they don't cover each other, the markers or the panels.
 */

import type { Box } from "./visibility.ts";
import { MARKER_GAP_PX } from "./visibility.ts";

/** The gap in px under which two labels count as touching. */
const LABEL_GAP_PX = 4;

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
