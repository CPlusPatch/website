import type { Body } from "@cpluspatch/sim";
import { CanvasTexture, SRGBColorSpace } from "three";
import { FALLBACK, type MarkerShape, styleOf, TAG_STYLES } from "../tags.ts";
import { ROLE_ICONS, type RoleKey, roleOf } from "./role-icons.ts";

type RoleShape = `role-${RoleKey}`;

export type Shape = MarkerShape | RoleShape;

const PLAIN_SHAPES: MarkerShape[] = [
    "disc",
    "ring",
    "diamond",
    "triangle",
    "teardrop",
];

/** Every shape, for building one texture of each. */
export const SHAPES: Shape[] = [
    ...PLAIN_SHAPES,
    ...(Object.keys(ROLE_ICONS) as RoleKey[]).map(
        (role): RoleShape => `role-${role}`,
    ),
];

/** Each tag has its own shape and spacecraft one per role, so colour isn't the only signal. */
export const shapeOf = (body: Body): Shape => {
    const { shape } = styleOf(body);

    return shape === "role" ? `role-${roleOf(body)}` : shape;
};

/** The on-screen size of a body's marker, in px. */
export const markerPx = (body: Body): number => styleOf(body).markerPx;

const TEXTURE_PX = 64;
// The stroke shows as 1.75px at the ring marker's size.
const RING_PX =
    Object.values(TAG_STYLES).find(({ shape }) => shape === "ring")?.markerPx ??
    FALLBACK.markerPx;
const RING_STROKE = (1.75 * TEXTURE_PX) / RING_PX;
// Keeps the edge antialiasing inside the texture.
const EDGE_PX = 1;

// A head in the lower left and a fainter tail to the upper right corner.
const teardrop = (context: CanvasRenderingContext2D, reach: number): void => {
    const head = 0.7 * reach;
    const cx = EDGE_PX + head;
    const cy = TEXTURE_PX - EDGE_PX - head;
    const tip = TEXTURE_PX - EDGE_PX;
    const toTip = Math.atan2(EDGE_PX - cy, tip - cx);
    // The tail's sides are tangent to the head.
    const spread = Math.acos(head / Math.hypot(tip - cx, EDGE_PX - cy));

    context.globalAlpha = 0.8;
    context.beginPath();
    context.moveTo(tip, EDGE_PX);
    context.lineTo(
        cx + head * Math.cos(toTip + spread),
        cy + head * Math.sin(toTip + spread),
    );
    context.lineTo(
        cx + head * Math.cos(toTip - spread),
        cy + head * Math.sin(toTip - spread),
    );
    context.closePath();
    context.fill();

    context.globalAlpha = 1;
    context.beginPath();
    context.arc(cx, cy, head, 0, 2 * Math.PI);
    context.fill();
};

export const markerTexture = (shape: Shape): CanvasTexture => {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_PX;
    canvas.height = TEXTURE_PX;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("A 2D canvas is needed to draw markers.");

    const mid = TEXTURE_PX / 2;
    const reach = mid - EDGE_PX;
    context.fillStyle = "white";
    context.strokeStyle = "white";

    if (shape === "disc") {
        context.beginPath();
        context.arc(mid, mid, reach, 0, 2 * Math.PI);
        context.fill();
    } else if (shape === "ring") {
        context.lineWidth = RING_STROKE;
        context.beginPath();
        context.arc(mid, mid, reach - RING_STROKE / 2, 0, 2 * Math.PI);
        context.stroke();
    } else if (shape === "diamond") {
        context.beginPath();
        context.moveTo(mid, mid - reach);
        context.lineTo(mid + reach, mid);
        context.lineTo(mid, mid + reach);
        context.lineTo(mid - reach, mid);
        context.closePath();
        context.fill();
    } else if (shape === "triangle") {
        // Centred on its height, so the body sits mid-marker.
        const half = (reach * Math.sqrt(3)) / 2;
        context.beginPath();
        context.moveTo(mid, mid - half);
        context.lineTo(mid + reach, mid + half);
        context.lineTo(mid - reach, mid + half);
        context.closePath();
        context.fill();
    } else if (shape === "teardrop") {
        teardrop(context, reach);
    } else {
        // The icons are drawn on a 24-unit grid.
        context.translate(EDGE_PX, EDGE_PX);
        context.scale((2 * reach) / 24, (2 * reach) / 24);
        context.fill(
            new Path2D(ROLE_ICONS[shape.slice("role-".length) as RoleKey]),
        );
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;

    return texture;
};
