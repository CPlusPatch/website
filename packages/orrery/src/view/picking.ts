/** A body on screen: its centre in px, its camera distance and the radius in px of its sphere or marker. */
export type PickPoint = {
    id: string;
    x: number;
    y: number;
    depth: number;
    radius?: number;
};

/** Screen distances this close count as equal. */
const TIE_PX = 0.5;

/**
 * The body nearest to (`x`, `y`) within `radiusPx` of its edge.
 * Bodies as near as each other go to the one closer to the camera.
 */
export const pickBody = (
    points: PickPoint[],
    x: number,
    y: number,
    radiusPx = 12,
): string | null => {
    let best: { id: string; distance: number; depth: number } | null = null;

    for (const point of points) {
        const distance = Math.max(
            0,
            Math.hypot(point.x - x, point.y - y) - (point.radius ?? 0),
        );
        if (distance > radiusPx) continue;

        const closer = best === null || distance < best.distance - TIE_PX;
        const tied =
            best !== null &&
            Math.abs(distance - best.distance) <= TIE_PX &&
            point.depth < best.depth;
        if (closer) {
            best = { id: point.id, distance, depth: point.depth };
        } else if (tied && best) {
            // Keep the nearest distance, so a chain of ties can't drift.
            best = {
                id: point.id,
                distance: Math.min(distance, best.distance),
                depth: point.depth,
            };
        }
    }

    return best?.id ?? null;
};

/** A label's box in px, in the same space as the pointer. */
export type LabelRect = {
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
};

/** The body whose label box holds (`x`, `y`), if any. */
export const pickLabel = (
    rects: LabelRect[],
    x: number,
    y: number,
): string | null =>
    rects.find(
        ({ left, top, right, bottom }) =>
            x >= left && x <= right && y >= top && y <= bottom,
    )?.id ?? null;
