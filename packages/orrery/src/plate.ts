import type { Elements } from "@cpluspatch/orbit";

/** The smallest parent disc, in px, so a tiny parent stays visible. */
export const MIN_PARENT_PX = 4.5;

export type Point = { x: number; y: number };

export type PlateInput = Pick<Elements, "a" | "e" | "raan" | "argp"> & {
    /** The body's true anomaly in radians. */
    trueAnomaly: number;
    /** The parent's radius in metres. */
    parentRadius: number;
    /** The area in px the orbit must fit in. */
    box: { x: number; y: number; width: number; height: number };
    /** The longest the scale bar may be, in px. */
    scaleMaxPx: number;
};

export type Plate = {
    /** Pixels per metre. */
    scale: number;
    centre: Point;
    rx: number;
    ry: number;
    /** The major axis angle in degrees, clockwise-positive like SVG `rotate()`. */
    rotation: number;
    focus: Point;
    parentPx: number;
    periapsis: Point;
    apoapsis: Point;
    body: Point;
    /** The unit vector of the body's direction of motion. */
    heading: Point;
    bounds: { left: number; top: number; right: number; bottom: number };
    scaleBar: { metres: number; px: number; y: number };
};

/** The largest 1, 2 or 5 × 10^k metres that is at most `maxMetres` long. */
const niceLength = (maxMetres: number): number => {
    const top = Math.floor(Math.log10(maxMetres)) + 1;

    // Start one decade high so a rounding error in log10 can't hide the answer.
    for (let k = top; ; k--) {
        for (const step of [5, 2, 1]) {
            if (step * 10 ** k <= maxMetres) return step * 10 ** k;
        }
    }
};

/**
 * The 2D drawing of an orbit in its own plane, in screen px with y down. Periapsis sits at
 * angle `raan + argp` counter-clockwise from +x, and motion is always counter-clockwise.
 * Inclination is ignored.
 */
export const plateGeometry = (input: PlateInput): Plate => {
    const { a, e, trueAnomaly: nu, parentRadius, box, scaleMaxPx } = input;
    const varpi = input.raan + input.argp;
    const b = a * Math.sqrt(1 - e * e);

    // Unit vectors on screen for the perifocal x (towards periapsis) and y axes.
    const ux = Math.cos(varpi);
    const uy = -Math.sin(varpi);
    const vx = -Math.sin(varpi);
    const vy = -Math.cos(varpi);

    // The exact half extents of a rotated ellipse, in metres.
    const halfWidth = Math.hypot(a * ux, b * vx);
    const halfHeight = Math.hypot(a * uy, b * vy);
    const scale = Math.min(
        box.width / (2 * halfWidth),
        box.height / (2 * halfHeight),
    );

    // The box is centred on the ellipse, which is symmetric about its centre.
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const focus = {
        x: centre.x + a * e * ux * scale,
        y: centre.y + a * e * uy * scale,
    };
    const at = (px: number, py: number): Point => ({
        x: focus.x + (px * ux + py * vx) * scale,
        y: focus.y + (px * uy + py * vy) * scale,
    });

    const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
    const speedX = -Math.sin(nu);
    const speedY = e + Math.cos(nu);
    const speed = Math.hypot(speedX, speedY);
    const bounds = {
        left: centre.x - halfWidth * scale,
        top: centre.y - halfHeight * scale,
        right: centre.x + halfWidth * scale,
        bottom: centre.y + halfHeight * scale,
    };
    const metres = niceLength(scaleMaxPx / scale);

    return {
        scale,
        centre,
        rx: a * scale,
        ry: b * scale,
        rotation: (-varpi * 180) / Math.PI,
        focus,
        parentPx: Math.max(MIN_PARENT_PX, parentRadius * scale),
        periapsis: at(a * (1 - e), 0),
        apoapsis: at(-a * (1 + e), 0),
        body: at(r * Math.cos(nu), r * Math.sin(nu)),
        heading: {
            x: (speedX * ux + speedY * vx) / speed,
            y: (speedX * uy + speedY * vy) / speed,
        },
        bounds,
        scaleBar: {
            metres,
            px: metres * scale,
            // Floating point error must not push the bar below the box.
            y: Math.min(bounds.bottom, box.y + box.height),
        },
    };
};
