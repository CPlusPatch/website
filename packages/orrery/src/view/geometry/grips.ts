/**
 * @module
 * The grips of an edited orbit: the node, a point on the orbit, the axes and the drag notes.
 */

import type { Elements, Vec3 } from "@cpluspatch/orbit";
import { wrapAngle } from "@cpluspatch/orbit";
import type { Rect } from "./labels.ts";
import { NOTE_PAD_PX, noteBox } from "./notes.ts";

/** The grips on an edited orbit show when its semi-major axis is over this many px. */
export const GRIPS_MIN_ORBIT_PX = 60;

/** The px between a grip and the drag note beside it. */
const GRIP_NOTE_GAP_PX = 14;

/**
 * The eccentric anomaly, in [0, 2π), where the argument of latitude is `u`: 0 at the ascending
 * node and π at the descending node.
 */
export const latitudeAnomaly = (e: number, argp: number, u: number): number => {
    // The argument of latitude is the true anomaly plus the argument of periapsis.
    const nu = u - argp;

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
