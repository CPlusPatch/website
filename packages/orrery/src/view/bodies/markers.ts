import type { Body, BodyKind } from "@cpluspatch/orbit";
import { CanvasTexture, SRGBColorSpace } from "three";
import { ROLE_ICONS, type RoleKey, roleOf } from "./role-icons.ts";

type RoleShape = `role-${RoleKey}`;

export type Shape =
    | "disc"
    | "ring"
    | "diamond"
    | "triangle"
    | "teardrop"
    | RoleShape;

const KIND_SHAPES: Record<Exclude<BodyKind, "spacecraft">, Shape> = {
    star: "disc",
    planet: "disc",
    dwarf: "ring",
    moon: "diamond",
    asteroid: "triangle",
    comet: "teardrop",
};

/** Every shape, for building one texture of each. */
export const SHAPES: Shape[] = [
    ...(Object.values(KIND_SHAPES) as Shape[]),
    ...(Object.keys(ROLE_ICONS) as RoleKey[]).map(
        (role): RoleShape => `role-${role}`,
    ),
];

/** Each kind has its own shape and spacecraft one per role, so colour isn't the only signal. */
export const shapeOf = (body: Body): Shape =>
    body.kind === "spacecraft"
        ? `role-${roleOf(body)}`
        : KIND_SHAPES[body.kind];

/** The on-screen size of each kind's marker, in px. */
const MARKER_PX: Record<BodyKind, number> = {
    star: 12,
    planet: 8,
    dwarf: 7,
    moon: 9,
    asteroid: 8,
    comet: 11,
    spacecraft: 12,
};

export const markerPx = (body: Body): number => MARKER_PX[body.kind];

const TEXTURE_PX = 64;
// Only dwarfs are rings, and the stroke shows as 1.75px at their size.
const RING_STROKE = (1.75 * TEXTURE_PX) / MARKER_PX.dwarf;
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
