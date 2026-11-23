import type { Body, Scenario, State, Vec3 } from "@cpluspatch/orbit";
import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";
import type { PerspectiveCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { kmPerPx } from "../scale.ts";
import {
    approachDistance,
    fitDistanceKm,
    focusTween,
    frameDistanceKm,
    keepSizeDistanceKm,
    minDistanceKm,
    openingReachKm,
    type Pose,
    reachKm,
} from "./geometry/framing.ts";

/** The camera and its controls, which orbit the focused body. */
export type Rig = {
    /** The world position in metres that the scene is drawn relative to. */
    origin: () => Vec3;
    /** The id of the focused body. */
    focusId: () => string;
    /** Places the camera above the ecliptic so the orbits of the inner planets fit. */
    fit: () => void;
    /** Whether the user or a focus change has moved the camera since the first fit. */
    moved: () => boolean;
    /** Takes the scenario's new reach: it sets the farthest zoom, and refits if the camera hasn't moved. */
    rescale: () => void;
    /** Moves the view to a body, keeping the view direction. A body that is big on screen keeps its size, else it is framed. */
    focus: (id: string) => void;
    /** Glides in for a positive `steps`, out for a negative one, by the factor of the zoom keys. Presses add up. */
    zoom: (steps: number) => void;
    /** Glides to the focus's framing distance, keeping the view direction. */
    fitFocus: () => void;
    /** The km one CSS pixel spans at the focus, in a viewport `viewportHeightPx` tall. */
    kmPerPx: (viewportHeightPx: number) => number;
    /** Advances a focus move by `dt` seconds, follows the focus and updates the controls. */
    update: (dt: number, states: Map<string, State>) => void;
    /** Removes the controls' and the keys' listeners. */
    dispose: () => void;
};

const MAX_DISTANCE_FACTOR = 4;
const KEY_ROTATE_RAD = (5 * Math.PI) / 180;
/** A dolly scale below 1 brings the camera closer. */
const KEY_ZOOM = 1 / 1.25;
const FOCUS_SECONDS = 0.4;
/** A key zoom closes all but `e^-4`, about 2%, of its gap in 0.2 s. */
const ZOOM_TAU_SECONDS = 0.05;
/** A key zoom snaps to its end once the distance is within this log ratio of it. */
const ZOOM_SNAP = 1e-3;
/** A wheel notch scales the distance by about 0.8, which is `0.95 ** 4.35`. */
const WHEEL_ZOOM_SPEED = 4.35;
/** Line-mode notches (Firefox) are 3 lines, which OrbitControls reads as 48 px, not 100. */
const LINE_WHEEL_ZOOM_SPEED = (WHEEL_ZOOM_SPEED * 100) / 48;
/**
 * A trackpad pinch sends Ctrl-wheel events, which OrbitControls scales by 10. This speed makes
 * the scale `e^(-deltaY / 100)`, the browsers' own pinch zoom.
 */
const CTRL_WHEEL_ZOOM_SPEED = -1 / (10 * Math.log(0.95));
/** OrbitControls raises the pinch ratio to this power, and a pinch should track the fingers. */
const PINCH_ZOOM_SPEED = 1;
/** A body at least this many CSS px across keeps its size when it takes the focus. */
const KEEP_SIZE_PX = 20;
const START_ELEVATION = Math.PI / 6;

type Move = { from: Pose; id: string; distance: number; elapsed: number };
type Zoom = { to: number };

/** A camera that starts above the ecliptic and looks at the root. */
export const createRig = (
    camera: PerspectiveCamera,
    canvas: HTMLElement,
    scenario: () => Scenario,
    firstStates: Map<string, State>,
): Rig => {
    const root = scenario().bodies.find((body) => body.parent === null);
    if (!root) throw new Error("The scenario has no root body.");

    // Looked up each time, since the element editor replaces bodies.
    const bodyOf = (id: string): Body => {
        const body = scenario().bodies.find((candidate) => candidate.id === id);
        if (!body) throw new Error(`There is no body "${id}".`);

        return body;
    };

    let states = firstStates;

    const positionOf = (id: string): Vec3 => {
        const state = states.get(id);
        if (!state) throw new Error(`There is no state for "${id}".`);

        return state.r;
    };

    // The ecliptic is the XY plane, so north is Z.
    camera.up.set(0, 0, 1);

    // These run before the controls' own listeners, which read `zoomSpeed`.
    const onWheel = (event: WheelEvent) => {
        controls.zoomSpeed = event.ctrlKey
            ? CTRL_WHEEL_ZOOM_SPEED
            : event.deltaMode === WheelEvent.DOM_DELTA_LINE
              ? LINE_WHEEL_ZOOM_SPEED
              : WHEEL_ZOOM_SPEED;
        // A running key zoom would undo the wheel's dolly.
        zoomMove = null;
    };
    const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== "touch") return;

        controls.zoomSpeed = PINCH_ZOOM_SPEED;
        zoomMove = null;
    };
    canvas.addEventListener("wheel", onWheel);
    canvas.addEventListener("pointerdown", onPointerDown);

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.zoomSpeed = WHEEL_ZOOM_SPEED;
    controls.enableDamping = !reducedMotion();

    let focused = root.id;
    let touched = false;
    controls.addEventListener("start", () => {
        touched = true;
    });
    let move: Move | null = null;
    let zoomMove: Zoom | null = null;
    const origin: Vec3 = { ...positionOf(root.id) };

    const fovRad = (camera.fov * Math.PI) / 180;
    controls.minDistance = minDistanceKm(root, fovRad);

    const fitTo = (reach: number) =>
        fitDistanceKm(reach, fovRad, camera.aspect, START_ELEVATION);
    const fitDistance = () => fitTo(reachKm(scenario()));
    const openingDistance = () => fitTo(openingReachKm(scenario()));

    const setDistance = (distance: number) => {
        camera.position.setLength(distance);
    };

    const fit = () => {
        const distance = openingDistance();
        controls.maxDistance = fitDistance() * MAX_DISTANCE_FACTOR;
        zoomMove = null;
        camera.position.set(
            0,
            -Math.cos(START_ELEVATION) * distance,
            Math.sin(START_ELEVATION) * distance,
        );
        controls.update();
    };
    fit();

    const settle = (id: string) => {
        controls.minDistance = minDistanceKm(bodyOf(id), fovRad);
    };

    const zoom = (steps: number) => {
        touched = true;

        const factor = KEY_ZOOM ** steps;
        const clamp = (distance: number) =>
            Math.min(
                Math.max(distance * factor, controls.minDistance),
                controls.maxDistance,
            );

        // A focus glide owns the distance, so the press changes where it ends. The path depends on
        // both ends, so it restarts from here instead of jumping.
        if (move) {
            move.from = {
                distance: camera.position.length(),
                position: { ...origin },
            };
            move.distance = clamp(move.distance);
            move.elapsed = 0;

            return;
        }

        const to = clamp(zoomMove?.to ?? camera.position.length());
        if (reducedMotion()) {
            zoomMove = null;
            setDistance(to);

            return;
        }

        zoomMove = { to };
    };

    // Eases the camera to `distance` from `id`, or jumps there under reduced motion.
    const glide = (id: string, distance: number) => {
        zoomMove = null;

        if (reducedMotion()) {
            move = null;
            Object.assign(origin, positionOf(id));
            setDistance(distance);
            settle(id);

            return;
        }

        move = {
            from: {
                distance: camera.position.length(),
                position: { ...origin },
            },
            id,
            distance,
            elapsed: 0,
        };
        // The old minimum must not stop the camera on its way in.
        controls.minDistance = Math.min(
            controls.minDistance,
            minDistanceKm(bodyOf(id), fovRad),
        );
    };

    // Where the camera goes to frame a body, in km.
    const frameDistance = (id: string) =>
        id === root.id
            ? openingDistance()
            : frameDistanceKm(scenario(), id, fovRad, camera.aspect);

    const clampDistance = (id: string, distance: number) =>
        Math.min(
            Math.max(distance, minDistanceKm(bodyOf(id), fovRad)),
            controls.maxDistance,
        );

    const fitFocus = () => {
        touched = true;
        glide(focused, clampDistance(focused, frameDistance(focused)));
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        switch (event.key) {
            case "ArrowLeft":
                controls.rotateLeft(KEY_ROTATE_RAD);
                break;
            case "ArrowRight":
                controls.rotateLeft(-KEY_ROTATE_RAD);
                break;
            case "ArrowUp":
                controls.rotateUp(KEY_ROTATE_RAD);
                break;
            case "ArrowDown":
                controls.rotateUp(-KEY_ROTATE_RAD);
                break;
            case "+":
            case "=":
            case "PageUp":
                zoom(1);
                break;
            case "-":
            case "PageDown":
                zoom(-1);
                break;
            case "0":
                fitFocus();
                break;
            default:
                return;
        }

        // The rotate and dolly methods update the controls.
        touched = true;
        event.preventDefault();
    };
    canvas.addEventListener("keydown", onKeyDown);

    return {
        origin: () => origin,
        focusId: () => focused,
        fit,
        moved: () => touched,
        rescale: () => {
            controls.maxDistance = fitDistance() * MAX_DISTANCE_FACTOR;
            if (!touched) fit();
        },
        zoom,
        fitFocus,
        kmPerPx: (viewportHeightPx) =>
            kmPerPx(camera.position.length(), fovRad, viewportHeightPx),
        focus: (id) => {
            const old = bodyOf(focused);
            const body = bodyOf(id);
            touched = true;
            focused = id;

            const distance = camera.position.length();
            const oldKm = old.radius / 1000;
            const px =
                canvas.clientHeight > 0
                    ? (2 * oldKm) /
                      kmPerPx(distance, fovRad, canvas.clientHeight)
                    : 0;
            const target =
                px >= KEEP_SIZE_PX
                    ? keepSizeDistanceKm(distance, old.radius, body.radius)
                    : frameDistance(id);

            glide(id, clampDistance(id, target));
        },
        update: (dt, latest) => {
            states = latest;

            if (move) {
                move.elapsed += dt;

                const s = Math.min(move.elapsed / FOCUS_SECONDS, 1);
                const pose = focusTween(
                    move.from,
                    { distance: move.distance, position: positionOf(move.id) },
                    s,
                    Math.tan(fovRad / 2),
                );
                Object.assign(origin, pose.position);
                setDistance(pose.distance);

                if (s === 1) {
                    settle(move.id);
                    move = null;
                }
            } else {
                Object.assign(origin, positionOf(focused));
            }

            if (zoomMove && !move) {
                // Clamped again, since the limits can change mid-zoom and the end must stay reachable.
                const to = Math.min(
                    Math.max(zoomMove.to, controls.minDistance),
                    controls.maxDistance,
                );
                const distance = approachDistance(
                    camera.position.length(),
                    to,
                    dt,
                    ZOOM_TAU_SECONDS,
                );

                if (Math.abs(Math.log(distance / to)) < ZOOM_SNAP) {
                    setDistance(to);
                    zoomMove = null;
                } else {
                    setDistance(distance);
                }
            }

            controls.update();
        },
        dispose: () => {
            canvas.removeEventListener("keydown", onKeyDown);
            canvas.removeEventListener("wheel", onWheel);
            canvas.removeEventListener("pointerdown", onPointerDown);
            controls.dispose();
        },
    };
};
