/**
 * @module
 * The grips on the orbit being edited: Pe, Ap, the ascending node and the inclination (at the
 * descending node), drawn as DOM over the scene.
 */

import { type Elements, type Vec3, wrapAngle } from "@cpluspatch/orbit";
import { dragApsis, tiltInclination } from "@cpluspatch/sim";
import { type PerspectiveCamera, Vector3 } from "three";
import { h, setText } from "../dom.ts";
import {
    formatApsisChange,
    formatInclinationChange,
    formatNodeChange,
} from "../format.ts";
import { type Frame, positionOf } from "../frame.ts";
import {
    axisPosition,
    GRIPS_MIN_ORBIT_PX,
    gripNoteSpots,
    latitudeAnomaly,
    planeAngle,
    pointAtAnomaly,
} from "../geometry/grips.ts";
import type { Rect } from "../geometry/labels.ts";
import { type Clearance, firstClear } from "../geometry/notes.ts";
import { projectedRadiusPx } from "../geometry/visibility.ts";
import { createMeasure } from "../measure.ts";
import type { Units } from "../units.ts";
import type { GripTarget } from "./types.ts";

/** What the grips need each frame. */
export type GripsFrame = {
    camera: PerspectiveCamera;
    /** The floating origin, in metres. */
    origin: Vec3;
    frame: Frame;
    viewport: { width: number; height: number };
    /** The id of the body that body `id` orbits. */
    parentOf: (id: string) => string | null | undefined;
};

/** The grips of an edited orbit. */
export type Grips = {
    /** Puts the grips on an orbit, or takes them off with `null`. */
    target: (next: GripTarget | null) => void;
    /** Whether grips show this frame. */
    shown: () => boolean;
    /** Moves the grips. Returns the rects they take, which labels keep out of. */
    update: (frame: GripsFrame) => Rect[];
    /** Places the drag note clear of `labels`, after the labels are placed. */
    placeNote: (labels: ReadonlyMap<string, Rect>) => void;
    dispose: () => void;
};

type Kind = "pe" | "ap" | "node" | "inc";

type Grip = {
    /** What the grip does. The two apsis grips trade kinds when a drag swaps the apsides. */
    kind: Kind;
    name: string;
    element: HTMLElement;
    flag: HTMLElement;
    /** The screen point, or `null` when it's behind the camera or off the viewport. */
    at: { x: number; y: number } | null;
};

type Drag = {
    grip: Grip;
    /** The kind the grip had at the start, which picks the drag's axis. */
    kind: Kind;
    /** Whether the apsides are swapped, so the periapsis is at the axis's other end. */
    swapped: boolean;
    target: GripTarget;
    pointerId: number;
    el0: Elements;
    /** The pointer's value at the start, which is `null` until the pointer can say. */
    t0: number | null;
    /** The last value that played a tick. */
    last: number | null;
};

const FLAG_PAD_PX = 10;

/** The size of the square drawn on a grip's point, `--grip-square` in styles/scene.css. */
const SQUARE_PX = 9;

const move = (element: HTMLElement, x: number, y: number) => {
    element.style.transform = `translate(${x}px, ${y}px)`;
};

/** The grips of the orbit being edited, in `host`, the labels layer. */
export const createGrips = (
    host: HTMLElement,
    units: Units,
    onTick?: () => void,
): Grips => {
    const container = host.parentElement ?? host;
    const specs: { kind: Kind; name: string }[] = [
        { kind: "pe", name: "Pe" },
        { kind: "ap", name: "Ap" },
        { kind: "node", name: "Node" },
        { kind: "inc", name: "Inc" },
    ];
    const grips: Grip[] = specs.map(({ kind, name }) => {
        const flag = h("div", { class: "orrery__flag" }, name);
        const element = h("div", { class: "orrery__grip", hidden: "" }, flag);

        return { kind, name, element, flag, at: null };
    });
    const note = h("div", { class: "orrery__note", hidden: "" });
    host.append(...grips.map(({ element }) => element), note);

    const flagFont = createMeasure(grips[0]?.flag ?? host);
    const noteFont = createMeasure(note);
    let disposed = false;
    document.fonts.ready.then(() => {
        if (disposed) return;

        flagFont.refresh();
        noteFont.refresh();
    });

    const view = new Vector3();
    const ray = new Vector3();
    // The parent's position in km from the floating origin, as of the last frame.
    const base = new Vector3();
    const size = { width: 0, height: 0 };
    let camera: PerspectiveCamera | null = null;
    let current: GripTarget | null = null;
    let shown = false;
    let hovered: Grip | null = null;
    let drag: Drag | null = null;
    const rooms: Rect[] = [];
    let noteAt: { x: number; y: number; width: number } | null = null;

    // The screen point of `point`, in km from the floating origin, or `null` behind the camera.
    const project = (
        eye: PerspectiveCamera,
        point: Vector3,
    ): { x: number; y: number } | null => {
        view.copy(point).applyMatrix4(eye.matrixWorldInverse);
        // A point behind the camera projects to a mirrored spot.
        if (view.z >= 0) return null;

        view.applyMatrix4(eye.projectionMatrix);

        return {
            x: (view.x * 0.5 + 0.5) * size.width,
            y: (0.5 - view.y * 0.5) * size.height,
        };
    };

    // The pointer's position along the periapsis axis, its angle round the parent, or its screen y.
    const value = (event: PointerEvent, active: Drag): number | null => {
        if (!camera) return null;

        const rect = host.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const { el0, kind } = active;
        if (kind === "inc") return y;
        if (kind === "node") {
            // In view space, then rotated, since `matrixWorld` is float32 and far from the origin.
            ray.set((x / size.width) * 2 - 1, 1 - (y / size.height) * 2, 0.5)
                .applyMatrix4(camera.projectionMatrixInverse)
                .transformDirection(camera.matrixWorld);

            return planeAngle(camera.position, ray, base);
        }

        const periapsis = pointAtAnomaly(el0, 0);
        const reach = Math.hypot(periapsis.x, periapsis.y, periapsis.z);
        const km = el0.a / 1000;
        const o = project(camera, base);
        const end = project(
            camera,
            view.set(
                base.x + (periapsis.x / reach) * km,
                base.y + (periapsis.y / reach) * km,
                base.z + (periapsis.z / reach) * km,
            ),
        );
        if (!o || !end) return null;

        const aPx = projectedRadiusPx(
            km,
            camera.position.distanceTo(base),
            (camera.fov * Math.PI) / 180,
            size.height,
        );

        return axisPosition(x - o.x, y - o.y, end.x - o.x, end.y - o.y, aPx);
    };

    // The held apsis grip becomes the other apsis, and the other grip takes its place.
    const swapApsisGrips = () => {
        const pe = grips.find(({ kind }) => kind === "pe");
        const ap = grips.find(({ kind }) => kind === "ap");
        if (!pe || !ap) return;

        pe.kind = "ap";
        pe.name = "Ap";
        ap.kind = "pe";
        ap.name = "Pe";
        setText(pe.flag, pe.name);
        setText(ap.flag, ap.name);
    };

    const endDrag = () => {
        if (!drag) return;

        const { grip, pointerId } = drag;
        drag = null;
        container.removeEventListener("pointerdown", onSecond, true);
        grip.element.classList.remove("orrery__grip--drag");
        note.hidden = true;
        noteAt = null;
        if (grip.element.hasPointerCapture(pointerId)) {
            grip.element.releasePointerCapture(pointerId);
        }
    };

    // A second pointer is a pinch, which undoes the drag.
    const onSecond = (event: PointerEvent) => {
        if (!drag || event.pointerId === drag.pointerId) return;

        const { target, el0, swapped } = drag;
        endDrag();
        if (swapped) swapApsisGrips();
        target.set({ a: el0.a, e: el0.e, i: el0.i, raan: el0.raan });
        if (swapped) {
            target.set({ argp: el0.argp, m: target.meanAnomaly(el0) });
        }
    };

    const onMove = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointerId) return;

        const t = value(event, drag);
        if (t === null) return;
        if (drag.t0 === null) {
            drag.t0 = t;
            drag.last = t;

            return;
        }

        const { kind, target, el0 } = drag;
        if (t !== drag.last) {
            drag.last = t;
            onTick?.();
        }
        if (kind === "node") {
            target.set({ raan: wrapAngle(el0.raan + (t - drag.t0)) });
        } else if (kind === "inc") {
            target.set({ i: tiltInclination(el0.i, t - drag.t0) });
        } else if (kind === "pe" || kind === "ap") {
            const { a, e, swapped } = dragApsis(
                kind,
                el0,
                (t - drag.t0) * el0.a,
                target.minPeriapsis,
            );
            if (swapped === drag.swapped) {
                target.set({ a, e });

                return;
            }

            // The periapsis is at the other end of the axis, and the body stays on its side.
            drag.swapped = swapped;
            swapApsisGrips();
            target.set({
                a,
                e,
                argp: swapped ? wrapAngle(el0.argp + Math.PI) : el0.argp,
                m: wrapAngle(target.meanAnomaly(el0) + (swapped ? Math.PI : 0)),
            });
        }
    };

    const onEnd = (event: PointerEvent) => {
        if (drag && event.pointerId === drag.pointerId) endDrag();
    };

    const listeners = grips.map((grip) => {
        const { element } = grip;
        const enter = () => {
            hovered = grip;
        };
        const leave = () => {
            if (hovered === grip) hovered = null;
        };
        const down = (event: PointerEvent) => {
            if (event.button !== 0 || !event.isPrimary || drag || !current) {
                return;
            }

            const el0 = current.elements();
            if (!el0) return;

            event.preventDefault();
            element.setPointerCapture(event.pointerId);
            element.classList.add("orrery__grip--drag");
            drag = {
                grip,
                kind: grip.kind,
                swapped: false,
                target: current,
                pointerId: event.pointerId,
                el0,
                t0: null,
                last: null,
            };
            drag.t0 = value(event, drag);
            drag.last = drag.t0;
            container.addEventListener("pointerdown", onSecond, true);
        };

        element.addEventListener("pointerenter", enter);
        element.addEventListener("pointerleave", leave);
        element.addEventListener("pointerdown", down);
        element.addEventListener("pointermove", onMove);
        element.addEventListener("pointerup", onEnd);
        element.addEventListener("pointercancel", onEnd);
        element.addEventListener("lostpointercapture", onEnd);

        return () => {
            element.removeEventListener("pointerenter", enter);
            element.removeEventListener("pointerleave", leave);
            element.removeEventListener("pointerdown", down);
            element.removeEventListener("pointermove", onMove);
            element.removeEventListener("pointerup", onEnd);
            element.removeEventListener("pointercancel", onEnd);
            element.removeEventListener("lostpointercapture", onEnd);
        };
    });

    const hide = (): Rect[] => {
        endDrag();
        hovered = null;
        shown = false;
        noteAt = null;
        rooms.length = 0;
        for (const { element } of grips) element.hidden = true;

        return rooms;
    };

    const taken: Rect[] = [];
    const clearance: Clearance = { viewport: size, taken, line: [], gap: 0 };

    return {
        target: (next) => {
            if (drag && drag.target !== next) endDrag();
            // Hidden grips don't always get `pointerleave`.
            hovered = null;
            current = next;
        },
        shown: () => shown,
        update: (frame) => {
            const elements = current?.elements() ?? null;
            const parent = current ? frame.parentOf(current.id) : undefined;
            const r = parent ? positionOf(frame.frame, parent) : undefined;
            if (!current || !elements || !r) return hide();

            const { camera: eye, origin } = frame;
            camera = eye;
            size.width = frame.viewport.width;
            size.height = frame.viewport.height;
            base.set(
                (r.x - origin.x) / 1000,
                (r.y - origin.y) / 1000,
                (r.z - origin.z) / 1000,
            );
            const aPx = projectedRadiusPx(
                elements.a / 1000,
                eye.position.distanceTo(base),
                (eye.fov * Math.PI) / 180,
                size.height,
            );
            if (aPx < GRIPS_MIN_ORBIT_PX) return hide();

            shown = true;
            rooms.length = 0;
            const anomalies = {
                pe: 0,
                ap: Math.PI,
                node: latitudeAnomaly(elements.e, elements.argp, 0),
                inc: latitudeAnomaly(elements.e, elements.argp, Math.PI),
            };
            const half = SQUARE_PX / 2;

            for (const grip of grips) {
                const rel = pointAtAnomaly(elements, anomalies[grip.kind]);
                const at = project(
                    eye,
                    view.set(
                        base.x + rel.x / 1000,
                        base.y + rel.y / 1000,
                        base.z + rel.z / 1000,
                    ),
                );
                const dragged = drag?.grip === grip;
                // A hidden grip loses the pointer capture, so the dragged one stays at the edge.
                if (at && dragged) {
                    at.x = Math.min(Math.max(at.x, 0), size.width);
                    at.y = Math.min(Math.max(at.y, 0), size.height);
                }
                const visible =
                    at !== null &&
                    at.x >= 0 &&
                    at.x <= size.width &&
                    at.y >= 0 &&
                    at.y <= size.height;
                grip.at = visible ? at : null;
                if (dragged && !visible) continue;

                grip.element.hidden = !visible;
                if (!visible) continue;

                const lit = hovered === grip || dragged;
                const flagged =
                    (grip.kind !== "node" && grip.kind !== "inc") || lit;
                grip.element.classList.toggle("orrery__grip--lit", lit);
                grip.flag.hidden = !flagged;
                move(grip.element, at.x, at.y);

                const square = {
                    left: at.x - half,
                    top: at.y - half,
                    right: at.x + half,
                    bottom: at.y + half,
                };
                if (!flagged) {
                    rooms.push(square);
                    continue;
                }

                const width = flagFont.width(grip.name) + FLAG_PAD_PX;
                // The flag's 28px lift and 16px box in scene.css, apart so a note fits by the square.
                rooms.push(
                    {
                        left: at.x - width / 2,
                        top: at.y - 28,
                        right: at.x + width / 2,
                        bottom: at.y - 12,
                    },
                    { ...square, top: at.y - 12 },
                );
            }

            const dragged = drag?.grip;
            if (dragged?.at) {
                const { original } = current;
                // The held grip's role now, which differs from its first one after a swap.
                const text =
                    dragged.kind === "node"
                        ? formatNodeChange(elements.raan, original.raan)
                        : dragged.kind === "inc"
                          ? formatInclinationChange(elements.i, original.i)
                          : dragged.kind === "pe"
                            ? formatApsisChange(
                                  "Pe",
                                  elements.a * (1 - elements.e),
                                  original.a * (1 - original.e),
                                  units.get(),
                              )
                            : formatApsisChange(
                                  "Ap",
                                  elements.a * (1 + elements.e),
                                  original.a * (1 + original.e),
                                  units.get(),
                              );
                setText(note, text);
                noteAt = { ...dragged.at, width: noteFont.width(text) };
            } else {
                noteAt = null;
            }

            return rooms;
        },
        placeNote: (labels) => {
            taken.length = 0;
            taken.push(...labels.values(), ...rooms);
            const spot = noteAt
                ? firstClear(
                      gripNoteSpots(noteAt.x, noteAt.y, noteAt.width),
                      clearance,
                  )
                : null;
            note.hidden = !spot;
            if (spot) move(note, spot.left, spot.top);
        },
        dispose: () => {
            disposed = true;
            endDrag();
            for (const off of listeners) off();
            for (const { element } of grips) element.remove();
            note.remove();
        },
    };
};
