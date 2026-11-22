import type { Body, BodyKind } from "@cpluspatch/orbit";
import { CanvasTexture, SRGBColorSpace } from "three";

export const HALO_SCALE = 2.5;
export const HALO_OPACITY = 0.22;

export type Shape = "disc" | "ring" | "diamond" | "square";

/** Each kind has its own shape, so colour isn't the only signal. */
export const SHAPES: Record<BodyKind, Shape> = {
    star: "disc",
    planet: "disc",
    dwarf: "ring",
    moon: "diamond",
    spacecraft: "square",
};

/** The on-screen size of each kind's marker, in px. */
const MARKER_PX: Record<BodyKind, number> = {
    star: 12,
    planet: 8,
    dwarf: 7,
    moon: 9,
    spacecraft: 6,
};

export const markerPx = (body: Body): number => MARKER_PX[body.kind];

const TEXTURE_PX = 64;
// Only dwarfs are rings, and the stroke shows as 1.75px at their size.
const RING_STROKE = (1.75 * TEXTURE_PX) / MARKER_PX.dwarf;
// Keeps the edge antialiasing inside the texture.
const EDGE_PX = 1;

export const markerTexture = (shape: Shape | "halo"): CanvasTexture => {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_PX;
    canvas.height = TEXTURE_PX;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("A 2D canvas is needed to draw markers.");

    const mid = TEXTURE_PX / 2;
    const reach = mid - EDGE_PX;
    context.fillStyle = "white";
    context.strokeStyle = "white";

    if (shape === "halo") {
        const glow = context.createRadialGradient(mid, mid, 0, mid, mid, mid);
        glow.addColorStop(0, "white");
        glow.addColorStop(1, "rgba(255, 255, 255, 0)");
        context.fillStyle = glow;
        context.fillRect(0, 0, TEXTURE_PX, TEXTURE_PX);
    } else if (shape === "disc") {
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
    } else {
        context.fillRect(EDGE_PX, EDGE_PX, 2 * reach, 2 * reach);
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;

    return texture;
};
