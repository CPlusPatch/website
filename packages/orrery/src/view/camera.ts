import type { Body, Scenario, State, Vec3 } from "@cpluspatch/orbit";
import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";
import type { PerspectiveCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { kmPerPx } from "../scale.ts";
import {
    fitDistanceKm,
    focusDistanceKm,
    focusTween,
    minDistanceKm,
    type Pose,
    reachKm,
} from "./geometry/framing.ts";

/** The camera and its controls, which orbit the focused body. */
export type Rig = {
    /** The world position in metres that the scene is drawn relative to. */
    origin: () => Vec3;
    /** The id of the focused body. */
    focusId: () => string;
    /** Places the camera above the ecliptic so every planet's orbit fits. */
    fit: () => void;
    /** Whether the user or a focus change has moved the camera since the first fit. */
    moved: () => boolean;
    /** Takes the scenario's new reach: it sets the farthest zoom, and refits if the camera hasn't moved. */
    rescale: () => void;
    /** Moves the view to a body, keeping the view direction. */
    focus: (id: string) => void;
    /** Dollies in for a positive `steps`, out for a negative one, by the factor of the zoom keys. */
    zoom: (steps: number) => void;
    /** Moves the camera to the focus's framing distance, keeping the view direction. */
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
const START_ELEVATION = Math.PI / 6;

type Move = { from: Pose; id: string; distance: number; elapsed: number };

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

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = !reducedMotion();

    let focused = root.id;
    let touched = false;
    controls.addEventListener("start", () => {
        touched = true;
    });
    let move: Move | null = null;
    const origin: Vec3 = { ...positionOf(root.id) };

    const fovRad = (camera.fov * Math.PI) / 180;
    controls.minDistance = minDistanceKm(root, fovRad);

    const fitDistance = () =>
        fitDistanceKm(
            reachKm(scenario()),
            fovRad,
            camera.aspect,
            START_ELEVATION,
        );
    const fit = () => {
        const distance = fitDistance();
        controls.maxDistance = distance * MAX_DISTANCE_FACTOR;
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
        for (let i = 0; i < Math.abs(steps); i++) {
            if (steps > 0) controls.dollyIn(KEY_ZOOM);
            else controls.dollyOut(KEY_ZOOM);
        }
        touched = true;
    };

    // Eases the camera to `distance` from `id`, or jumps there under reduced motion.
    const glide = (id: string, distance: number) => {
        if (reducedMotion()) {
            move = null;
            Object.assign(origin, positionOf(id));
            camera.position.setLength(distance);
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

    const fitFocus = () => {
        touched = true;
        glide(
            focused,
            focused === root.id
                ? fitDistance()
                : focusDistanceKm(bodyOf(focused)),
        );
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
            kmPerPx(
                camera.position.distanceTo(controls.target),
                fovRad,
                viewportHeightPx,
            ),
        focus: (id) => {
            const body = bodyOf(id);
            touched = true;
            focused = id;
            glide(id, focusDistanceKm(body));
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
                );
                Object.assign(origin, pose.position);
                camera.position.setLength(pose.distance);

                if (s === 1) {
                    settle(move.id);
                    move = null;
                }
            } else {
                Object.assign(origin, positionOf(focused));
            }

            controls.update();
        },
        dispose: () => {
            canvas.removeEventListener("keydown", onKeyDown);
            controls.dispose();
        },
    };
};
