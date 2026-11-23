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

/**
 * The slot of the point nearest to (`x`, `y`) within `radiusPx`, or -1. `xy` holds x, y pairs in
 * px for `count` points. A NaN x means the point is off screen. The first of equals wins.
 */
export const pickNearest = (
    xy: Float32Array,
    count: number,
    x: number,
    y: number,
    radiusPx: number,
): number => {
    let best = -1;
    let bestDistance = radiusPx;

    for (let j = 0; j < count; j++) {
        const px = xy[j * 2] as number;
        if (Number.isNaN(px)) continue;

        const distance = Math.hypot(px - x, (xy[j * 2 + 1] as number) - y);
        if (
            distance <= bestDistance &&
            (best === -1 || distance < bestDistance)
        ) {
            best = j;
            bestDistance = distance;
        }
    }

    return best;
};
