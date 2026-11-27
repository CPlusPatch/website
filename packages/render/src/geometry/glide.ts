/**
 * @module
 * The camera's glides: a focus move, a key zoom, and the turns of the aim, look and up. Each
 * step advances them by a frame and gives the camera they leave.
 */

import type { Vec3 } from "@cpluspatch/orbit";
import { Quaternion, Vector3 } from "three";
import {
    approachDistance,
    ease,
    focusLength,
    focusTween,
    type Pose,
} from "./framing.ts";

/** How long the shortest focus glide, and a turn on its own, takes, in seconds. */
export const FOCUS_SECONDS = 0.4;
/** How many seconds a focus glide adds per unit of its path length. */
export const FOCUS_SECONDS_PER_LENGTH = 0.07;
/** How long the longest focus glide takes, in seconds. */
export const FOCUS_MAX_SECONDS = 2.5;
/** A key zoom closes all but `e^-4`, about 2%, of its gap in 0.2 s. */
export const ZOOM_TAU_SECONDS = 0.05;
/** A key zoom snaps to its end once the distance is within this log ratio of it. */
export const ZOOM_SNAP = 1e-3;

/** A direction that glides from `from` to a goal over `seconds`, as seconds in. */
export type Turn = { from: Vec3; seconds: number; elapsed: number };
/** A glide of the view to a moving target over `seconds`, as seconds in. */
export type Move<T> = {
    from: Pose;
    target: T;
    distance: number;
    seconds: number;
    elapsed: number;
};
/** A key zoom's end distance in km. */
export type Zoom = { to: number };
/** The look target's offset from the focus, in camera distances, gliding from `from` to `to`. */
export type LookGlide = {
    from: Vec3;
    to: Vec3;
    seconds: number;
    elapsed: number;
};

/** The camera's running glides. `T` is the caller's move target; the stepper only carries it. */
export type Glide<T> = {
    move: Move<T> | null;
    zoom: Zoom | null;
    aim: Turn | null;
    look: LookGlide | null;
    up: Turn | null;
};

/** The camera as it is before a step, and the goals its glides head for. */
export type GlideNow = {
    /** The proxy's distance from the focus, in km. */
    distance: number;
    /** The proxy's unit direction from the focus. */
    direction: Vec3;
    /** The look offset, in camera distances. */
    look: Vec3;
    /** The move target's position now, in world metres. It's needed while a move runs. */
    moveTo: Vec3 | null;
    /** The aim's goal, as a unit direction. */
    behind: Vec3;
    /** The up's goal, as a unit vector. */
    up: Vec3;
    /** The closest zoom, in km, as before the step: a zoom never runs alongside a move. */
    minDistance: number;
    /** The farthest zoom, in km. */
    maxDistance: number;
    /** The tangent of half the vertical field of view. */
    tanHalfFov: number;
};

/** The glides after a step and the camera they give. */
export type GlideStep<T> = {
    glide: Glide<T>;
    /** The view's origin while a move ran this step, else null so the caller follows the focus. */
    origin: Vec3 | null;
    distance: number;
    direction: Vec3;
    look: Vec3;
    up: Vec3;
    /** The move that finished this step, so the caller can set its minimum distance. */
    ended: Move<T> | null;
};

/**
 * How long a focus glide between two poses takes: longer for a longer path, so it keeps about the
 * same perceived speed, as van Wijk and Nuij suggest, between the shortest and longest times.
 */
export const focusSeconds = (
    from: Pose,
    to: Pose,
    tanHalfFov: number,
): number =>
    Math.min(
        FOCUS_SECONDS +
            FOCUS_SECONDS_PER_LENGTH * focusLength(from, to, tanHalfFov),
        FOCUS_MAX_SECONDS,
    );

const turn = new Quaternion();
const rest = new Quaternion();
const swung = new Vector3();
const toward = new Vector3();

// `from` turned toward `to`, `k` of the way.
const swing = (from: Vec3, to: Vec3, k: number): Vec3 => {
    turn.setFromUnitVectors(
        swung.set(from.x, from.y, from.z),
        toward.set(to.x, to.y, to.z),
    );
    rest.identity().slerp(turn, k);
    swung.applyQuaternion(rest);

    return { x: swung.x, y: swung.y, z: swung.z };
};

/** Advances every glide by `dt` seconds. The inputs aren't changed. */
export const stepGlide = <T>(
    glide: Glide<T>,
    dt: number,
    now: GlideNow,
): GlideStep<T> => {
    let { move, zoom, aim, look, up } = glide;
    let origin: Vec3 | null = null;
    let ended: Move<T> | null = null;
    let distance = now.distance;

    if (move) {
        if (!now.moveTo) throw new Error("A move is running without a target.");

        const elapsed = move.elapsed + dt;
        const s = Math.min(elapsed / move.seconds, 1);
        const pose = focusTween(
            move.from,
            { distance: move.distance, position: now.moveTo },
            s,
            now.tanHalfFov,
        );
        origin = pose.position;
        distance = pose.distance;

        move = { ...move, elapsed };
        if (s === 1) {
            ended = move;
            move = null;
        }
    }

    if (zoom && !move) {
        // Clamped again, since the limits can change mid-zoom and the end must stay reachable.
        const to = Math.min(
            Math.max(zoom.to, now.minDistance),
            now.maxDistance,
        );
        const approached = approachDistance(distance, to, dt, ZOOM_TAU_SECONDS);

        if (Math.abs(Math.log(approached / to)) < ZOOM_SNAP) {
            distance = to;
            zoom = null;
        } else {
            distance = approached;
        }
    }

    let direction = now.direction;
    if (aim) {
        const elapsed = aim.elapsed + dt;
        const s = Math.min(elapsed / aim.seconds, 1);
        direction = swing(aim.from, now.behind, ease(s));
        aim = s === 1 ? null : { ...aim, elapsed };
    }

    let lookNow = now.look;
    if (look) {
        const elapsed = look.elapsed + dt;
        const s = Math.min(elapsed / look.seconds, 1);
        const k = ease(s);
        lookNow = {
            x: look.from.x + (look.to.x - look.from.x) * k,
            y: look.from.y + (look.to.y - look.from.y) * k,
            z: look.from.z + (look.to.z - look.from.z) * k,
        };
        look = s === 1 ? null : { ...look, elapsed };
    }

    let upNow = now.up;
    if (up) {
        const elapsed = up.elapsed + dt;
        const s = Math.min(elapsed / up.seconds, 1);
        if (s === 1) {
            up = null;
        } else {
            upNow = swing(up.from, now.up, ease(s));
            up = { ...up, elapsed };
        }
    }

    return {
        glide: { move, zoom, aim, look, up },
        origin,
        distance,
        direction,
        look: lookNow,
        up: upNow,
        ended,
    };
};
