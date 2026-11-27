import { length, sub, type Vec3 } from "@cpluspatch/orbit";
import type { Body, Scenario } from "@cpluspatch/sim";
import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
    type Frame,
    positionOf as positionIn,
    presentIn,
    velocityOf,
} from "./frame.ts";
import { behindDirection, chaseFrame, chaseView } from "./geometry/chase.ts";
import {
    fitDistanceKm,
    frameDistanceKm,
    keepSizeDistanceKm,
    minDistanceKm,
    openingReachKm,
    type Pose,
    reachKm,
} from "./geometry/framing.ts";
import {
    FOCUS_SECONDS,
    focusSeconds,
    type Glide,
    stepGlide,
} from "./geometry/glide.ts";
import { kmPerPx } from "./scale.ts";

/** A state relative to the parent, in metres and metres per second. */
export type Relative = { r: Vec3; v: Vec3 };

/** The camera and its controls, which orbit the focused body. */
export type Rig = {
    /** The world position in metres that the scene is drawn relative to. */
    origin: () => Vec3;
    /** The id of the focused body. */
    focusId: () => string;
    /** Places the camera above the ecliptic to frame the focus, or the inner planets for the root. */
    fit: () => void;
    /** Whether the user or a focus change has moved the camera since the first fit. */
    moved: () => boolean;
    /** Takes the scenario's new reach: it sets the farthest zoom, and refits if the camera hasn't moved. */
    rescale: () => void;
    /** Moves the view to a body, keeping the view direction. A body that is big on screen keeps its size, else it is framed. Ends `focusPoint`. */
    focus: (id: string) => void;
    /**
     * Moves the view to a moving point and follows it, `distanceKm` away. `position` gives world
     * metres. `relative` gives its state against the body it moves around, which a chase needs.
     * `focusId` keeps the last focused body.
     */
    focusPoint: (
        position: () => Vec3,
        distanceKm: number,
        relative: () => Relative | null,
    ) => void;
    /** Glides in for a positive `steps`, out for a negative one, by the factor of the zoom keys. Presses add up. */
    zoom: (steps: number) => void;
    /** Glides to the focus's framing distance, keeping the view direction. */
    fitFocus: () => void;
    /** The km one CSS pixel spans at the focus, in a viewport `viewportHeightPx` tall. */
    kmPerPx: (viewportHeightPx: number) => number;
    /**
     * Turns the chase camera on or off. The camera then orbits in the focus's own frame, behind it
     * along its track. Returns false when `on` is asked of a focus that can't be chased.
     */
    chase: (on: boolean) => boolean;
    /** Whether the camera is chasing the focus. */
    chasing: () => boolean;
    /** Whether the focus has a parent to chase against. */
    canChase: () => boolean;
    /** Advances a focus move by `dt` seconds, follows the focus and updates the controls. */
    update: (dt: number, frame: Frame) => void;
    /** Removes the controls' and the keys' listeners. */
    dispose: () => void;
};

const MAX_DISTANCE_FACTOR = 4;
const KEY_ROTATE_RAD = (5 * Math.PI) / 180;
/** A dolly scale below 1 brings the camera closer. */
const KEY_ZOOM = 1 / 1.25;
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
/** The closest the camera may get to a followed point, in km. A point has no size to keep out of. */
const POINT_MIN_KM = 1;

/** Where the camera looks, in world metres, the closest it may get and how it moves. */
type Target = {
    position: () => Vec3;
    min: () => number;
    relative: () => Relative | null;
};

const plain = (v: Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

/** A camera that starts above the ecliptic and looks at `firstFocus`. */
export const createRig = (
    camera: PerspectiveCamera,
    canvas: HTMLElement,
    scenario: () => Scenario,
    firstFrame: Frame,
    firstFocus: string,
): Rig => {
    const root = scenario().bodies.find((body) => body.orbit === undefined);
    if (!root) throw new Error("The scenario has no root body.");

    // Looked up each time, since the element editor replaces bodies.
    const bodyOf = (id: string): Body => {
        const body = scenario().bodies.find((candidate) => candidate.id === id);
        if (!body) throw new Error(`There is no body "${id}".`);

        return body;
    };

    const exists = (id: string) =>
        scenario().bodies.some((candidate) => candidate.id === id);

    let current = firstFrame;

    const positionOf = (id: string): Vec3 => {
        const r = positionIn(current, id);
        if (!r) throw new Error(`There is no state for "${id}".`);

        return r;
    };

    const bodyRelative = (id: string): Relative | null => {
        const parent = bodyOf(id).orbit?.parent ?? null;
        const r = positionIn(current, id);
        const v = velocityOf(current, id);
        const parentR =
            parent === null ? undefined : positionIn(current, parent);
        const parentV =
            parent === null ? undefined : velocityOf(current, parent);
        if (!r || !v || !parentR || !parentV) return null;

        return { r: sub(r, parentR), v: sub(v, parentV) };
    };

    // The ecliptic is the XY plane, so north is Z.
    camera.up.set(0, 0, 1);

    // The controls orbit this proxy, which stays in the focus's frame with Z up. OrbitControls
    // keeps the up it's built with, so the real camera, whose up changes, can't be its object.
    const proxy = new PerspectiveCamera(camera.fov, camera.aspect);
    proxy.up.set(0, 0, 1);

    // These run before the controls' own listeners, which read `zoomSpeed`.
    const onWheel = (event: WheelEvent) => {
        controls.zoomSpeed = event.ctrlKey
            ? CTRL_WHEEL_ZOOM_SPEED
            : event.deltaMode === WheelEvent.DOM_DELTA_LINE
              ? LINE_WHEEL_ZOOM_SPEED
              : WHEEL_ZOOM_SPEED;
        // A running key zoom would undo the wheel's dolly.
        glide.zoom = null;
    };
    const onPointerDown = (event: PointerEvent) => {
        // A drag takes the direction over from a chase glide.
        glide.aim = null;
        if (event.pointerType !== "touch") return;

        controls.zoomSpeed = PINCH_ZOOM_SPEED;
        glide.zoom = null;
    };
    canvas.addEventListener("wheel", onWheel);
    canvas.addEventListener("pointerdown", onPointerDown);

    const controls = new OrbitControls(proxy, canvas);
    controls.enablePan = false;
    controls.zoomSpeed = WHEEL_ZOOM_SPEED;
    controls.enableDamping = !reducedMotion();

    // The view is rebuilt after an add or remove, and the focus must survive that.
    let focused = bodyOf(firstFocus).id;
    let touched = false;
    controls.addEventListener("start", () => {
        touched = true;
    });
    // Set while the camera follows a point instead of the focused body.
    let following: { target: Target; distance: number } | null = null;
    let chasing = false;
    // Turns the proxy's offset into the world's. It's the identity unless chasing.
    const frame = new Quaternion();
    // The focus move, the key zoom, and the glides of the proxy's direction to behind the focus,
    // of the look target and of the camera's up.
    let glide: Glide<Target> = {
        move: null,
        zoom: null,
        aim: null,
        look: null,
        up: null,
    };
    // Where the camera looks, as a multiple of its distance from the focus, in the proxy's frame.
    const look = new Vector3();
    const up = new Vector3(0, 0, 1);
    const origin: Vec3 = { ...positionOf(focused) };

    const fovRad = (camera.fov * Math.PI) / 180;
    const tanHalfFov = Math.tan(fovRad / 2);
    controls.minDistance = minDistanceKm(bodyOf(focused), fovRad);

    const present = (id: string) => presentIn(current, id);
    const fitTo = (reach: number) =>
        fitDistanceKm(reach, fovRad, camera.aspect, START_ELEVATION);
    const fitDistance = () => fitTo(reachKm(scenario(), present));
    const openingDistance = () => fitTo(openingReachKm(scenario(), present));

    const setDistance = (distance: number) => {
        proxy.position.setLength(distance);
    };

    const behind = new Vector3().copy(behindDirection());
    const eclipticUp = new Vector3(0, 0, 1);
    const matrix = new Matrix4();
    const rest = new Quaternion();
    const goal = new Vector3();

    const focusRelative = (): Relative | null =>
        following ? following.target.relative() : bodyRelative(focused);

    // Takes the focus's frame, or keeps the last one when it's undefined. Returns whether it had one.
    const refreshFrame = (): boolean => {
        const relative = focusRelative();
        const m = relative && chaseFrame(relative.r, relative.v);
        if (!m) return false;

        frame.setFromRotationMatrix(matrix.fromArray(m));

        return true;
    };

    // A turn that starts with a focus move lasts as long as it, so the two land together.
    const turnSeconds = () => glide.move?.seconds ?? FOCUS_SECONDS;

    const startUpGlide = () => {
        glide.up = reducedMotion()
            ? null
            : { from: plain(up), seconds: turnSeconds(), elapsed: 0 };
    };

    // The radius of the body the focus moves around. A followed point moves around the focused body.
    const parentRadius = (): number => {
        if (following) return bodyOf(focused).mass.radius;

        const parent = bodyOf(focused).orbit?.parent;

        return parent === undefined ? 0 : bodyOf(parent).mass.radius;
    };

    // Glides the look target to `to`, or jumps there under reduced motion.
    const startLook = (to: Vector3) => {
        if (reducedMotion()) {
            look.copy(to);
            glide.look = null;

            return;
        }

        glide.look = {
            from: plain(look),
            to: plain(to),
            seconds: turnSeconds(),
            elapsed: 0,
        };
    };

    const aimBehind = () => {
        const relative = focusRelative();
        const distance = relative ? length(relative.r) : 0;
        const angularRadius =
            distance > 0
                ? Math.asin(Math.min(parentRadius() / distance, 1))
                : 0;
        const view = chaseView(angularRadius, fovRad);
        behind.copy(behindDirection(view.elevationRad));
        startLook(goal.set(0, 0, -view.nadirOffset));

        if (reducedMotion()) {
            glide.aim = null;
            proxy.position.copy(behind).setLength(proxy.position.length());

            return;
        }

        glide.aim = {
            from: plain(proxy.position.clone().normalize()),
            seconds: turnSeconds(),
            elapsed: 0,
        };
    };

    const leaveChase = () => {
        if (!chasing) return;

        proxy.position.applyQuaternion(frame);
        look.applyQuaternion(frame);
        frame.identity();
        chasing = false;
        glide.aim = null;
        startUpGlide();
        startLook(goal.set(0, 0, 0));
    };

    // A new focus keeps the chase if it has a parent. The camera stays put in the new frame, then
    // glides behind, so the view doesn't snap.
    const retargetChase = () => {
        if (!focusRelative()) {
            leaveChase();

            return;
        }

        proxy.position.applyQuaternion(frame);
        look.applyQuaternion(frame);
        refreshFrame();
        proxy.position.applyQuaternion(rest.copy(frame).invert());
        look.applyQuaternion(rest);
        startUpGlide();
        aimBehind();
    };

    const canChase = () => focusRelative() !== null;

    const chase = (on: boolean): boolean => {
        if (!on) {
            leaveChase();

            return true;
        }
        if (chasing) return true;
        if (!canChase() || !refreshFrame()) return false;

        touched = true;
        // The frame was the identity, so the proxy's offset is the world's. This keeps the camera put.
        proxy.position.applyQuaternion(rest.copy(frame).invert());
        chasing = true;
        startUpGlide();
        aimBehind();

        return true;
    };

    // Sets the real camera to the proxy's offset in the frame, looking at the focus.
    const place = () => {
        proxy.fov = camera.fov;
        proxy.aspect = camera.aspect;

        camera.position.copy(proxy.position).applyQuaternion(frame);
        camera.up.copy(up);
        goal.copy(look)
            .multiplyScalar(proxy.position.length())
            .applyQuaternion(frame);
        camera.lookAt(goal);
    };

    // Where the camera goes to frame a body, in km.
    const frameDistance = (id: string) =>
        id === root.id
            ? openingDistance()
            : frameDistanceKm(scenario(), id, fovRad, camera.aspect, present);

    const clampDistance = (id: string, distance: number) =>
        Math.min(
            Math.max(distance, minDistanceKm(bodyOf(id), fovRad)),
            controls.maxDistance,
        );

    const fit = () => {
        controls.maxDistance = fitDistance() * MAX_DISTANCE_FACTOR;
        const distance =
            focused === root.id
                ? openingDistance()
                : clampDistance(focused, frameDistance(focused));
        glide.zoom = null;
        proxy.position.set(
            0,
            -Math.cos(START_ELEVATION) * distance,
            Math.sin(START_ELEVATION) * distance,
        );
        controls.update();
        place();
    };
    fit();

    const bodyTarget = (id: string): Target => ({
        position: () => positionOf(id),
        min: () => minDistanceKm(bodyOf(id), fovRad),
        relative: () => bodyRelative(id),
    });

    const moveSeconds = (from: Pose, target: Target, distance: number) =>
        focusSeconds(
            from,
            { distance, position: target.position() },
            tanHalfFov,
        );

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
        if (glide.move) {
            const from = {
                distance: proxy.position.length(),
                position: { ...origin },
            };
            const distance = clamp(glide.move.distance);

            glide.move = {
                ...glide.move,
                from,
                distance,
                seconds: moveSeconds(from, glide.move.target, distance),
                elapsed: 0,
            };

            return;
        }

        const to = clamp(glide.zoom?.to ?? proxy.position.length());
        if (reducedMotion()) {
            glide.zoom = null;
            setDistance(to);

            return;
        }

        glide.zoom = { to };
    };

    // Eases the camera to `distance` from `target`, or jumps there under reduced motion.
    const glideTo = (target: Target, distance: number) => {
        glide.zoom = null;

        if (reducedMotion()) {
            glide.move = null;
            Object.assign(origin, target.position());
            setDistance(distance);
            controls.minDistance = target.min();

            return;
        }

        const from = {
            distance: proxy.position.length(),
            position: { ...origin },
        };

        glide.move = {
            from,
            target,
            distance,
            seconds: moveSeconds(from, target, distance),
            elapsed: 0,
        };
        // The old minimum must not stop the camera on its way in.
        controls.minDistance = Math.min(controls.minDistance, target.min());
    };

    const fitFocus = () => {
        touched = true;
        if (chasing) aimBehind();
        if (following) {
            glideTo(following.target, following.distance);

            return;
        }

        glideTo(
            bodyTarget(focused),
            clampDistance(focused, frameDistance(focused)),
        );
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        switch (event.key) {
            case "ArrowLeft":
                glide.aim = null;
                controls.rotateLeft(KEY_ROTATE_RAD);
                break;
            case "ArrowRight":
                glide.aim = null;
                controls.rotateLeft(-KEY_ROTATE_RAD);
                break;
            case "ArrowUp":
                glide.aim = null;
                controls.rotateUp(KEY_ROTATE_RAD);
                break;
            case "ArrowDown":
                glide.aim = null;
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
            // A removed focus is followed by a `focus` call, which frames its parent.
            if (!touched && exists(focused)) fit();
        },
        zoom,
        fitFocus,
        chase,
        chasing: () => chasing,
        canChase,
        kmPerPx: (viewportHeightPx) =>
            kmPerPx(proxy.position.length(), fovRad, viewportHeightPx),
        focus: (id) => {
            const old = exists(focused) ? bodyOf(focused) : null;
            const body = bodyOf(id);
            // The camera's distance from a followed point says nothing about the old body's size.
            // Nor does it for a body that was removed.
            const fromPoint = following !== null || old === null;
            touched = true;
            focused = id;
            following = null;

            const distance = proxy.position.length();
            const oldKm = (old?.mass.radius ?? 0) / 1000;
            const px =
                canvas.clientHeight > 0
                    ? (2 * oldKm) /
                      kmPerPx(distance, fovRad, canvas.clientHeight)
                    : 0;
            const target =
                old && px >= KEEP_SIZE_PX && !fromPoint
                    ? keepSizeDistanceKm(
                          distance,
                          old.mass.radius,
                          body.mass.radius,
                      )
                    : frameDistance(id);

            glideTo(bodyTarget(id), clampDistance(id, target));
            if (chasing) retargetChase();
        },
        focusPoint: (position, distanceKm, relative) => {
            const distance = Math.min(
                Math.max(distanceKm, POINT_MIN_KM),
                controls.maxDistance,
            );
            const target: Target = {
                position,
                min: () => POINT_MIN_KM,
                relative,
            };
            touched = true;
            following = { target, distance };

            glideTo(target, distance);
            if (chasing) retargetChase();
        },
        update: (dt, latest) => {
            current = latest;
            if (chasing) refreshFrame();

            // The up glides to the frame's Z, or to the ecliptic's when not chasing.
            const upGoal = goal.copy(eclipticUp);
            if (chasing) upGoal.applyQuaternion(frame);

            const step = stepGlide(glide, dt, {
                distance: proxy.position.length(),
                direction: plain(proxy.position.clone().normalize()),
                look: plain(look),
                moveTo: glide.move?.target.position() ?? null,
                behind: plain(behind),
                up: plain(upGoal),
                minDistance: controls.minDistance,
                maxDistance: controls.maxDistance,
                tanHalfFov,
            });
            glide = step.glide;
            if (step.ended) controls.minDistance = step.ended.target.min();

            Object.assign(
                origin,
                step.origin ??
                    (following
                        ? following.target.position()
                        : positionOf(focused)),
            );
            proxy.position.set(
                step.direction.x,
                step.direction.y,
                step.direction.z,
            );
            setDistance(step.distance);
            look.set(step.look.x, step.look.y, step.look.z);

            controls.update();
            up.set(step.up.x, step.up.y, step.up.z);
            place();
        },
        dispose: () => {
            canvas.removeEventListener("keydown", onKeyDown);
            canvas.removeEventListener("wheel", onWheel);
            canvas.removeEventListener("pointerdown", onPointerDown);
            controls.dispose();
        },
    };
};
