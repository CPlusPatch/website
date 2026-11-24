import type { Body, BodyKind, Elements, State, Vec3 } from "@cpluspatch/orbit";
import { precessionTurns } from "@cpluspatch/orbit";
import {
    Color,
    CustomBlending,
    Group,
    MaxEquation,
    NormalBlending,
    type PerspectiveCamera,
    Quaternion,
    type Scene,
    SRGBColorSpace,
    Vector3,
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import {
    nearestPoint,
    orbitNear,
    trailAlpha,
    trailBack,
} from "../geometry/along-orbit.ts";
import { orbitFade, projectedRadiusPx } from "../geometry/visibility.ts";
import { fadeLineMaterial } from "./fade-material.ts";
import { createGhost, updateGhost } from "./ghost.ts";
import {
    casingPx,
    LINE_PX,
    orbitGeometry,
    SAMPLES,
    SELECTED_LINE_PX,
    setVertex,
} from "./line-geometry.ts";
import { rebuildNear, restoreStatic } from "./near.ts";
import type { Ghost, Orbit, Paint } from "./types.ts";

/** The orbit lines of a scene. */
export type Orbits = {
    /**
     * Moves each line to its parent's position relative to `origin`, fades it back from its body
     * against the clock's `rate`, turns it to its precession at the clock's time `t`, and hides it
     * if it shows too small or too big.
     */
    update: (
        origin: Vec3,
        states: Map<string, State>,
        camera: PerspectiveCamera,
        rate: number,
        t: number,
    ) => void;
    /** Draws the orbit of a body, or of none, in the pick colour and thicker. */
    highlight: (id: string | null) => void;
    /** Draws the line of `body` again from its new elements. */
    rebuild: (body: Body) => void;
    /** Adds the line of `body`, if it has an orbit. */
    add: (body: Body) => void;
    /** Removes and frees the line of body `id`, and hides the ghost if it was for it or around it. */
    remove: (id: string) => void;
    /** Draws a dashed line for `elements` around the parent of `body`, or none with `null`. */
    ghost: (body: Body, elements: Elements | null) => void;
    /** Switches the lines to read over the sky, which has no flat ground colour to fade into. */
    sky: (shown: boolean) => void;
    /** Shows the lines, or hides them all. */
    show: (shown: boolean) => void;
    /** Sets the line width's screen size. */
    resize: (width: number, height: number) => void;
    /** Removes the lines and frees them. */
    dispose: () => void;
};

/** How much a picked orbit's trail dims while a ghost shows. */
const GHOST_DIM = 0.4;

// Minor-body and craft lines cross the planets' and moons' frame, and shouldn't outshine them.
const MINOR_DIM = 0.6;
const MINOR_KINDS: readonly BodyKind[] = [
    "dwarf",
    "asteroid",
    "comet",
    "spacecraft",
];

/** One line per body that has an orbit, in km. */
export const createOrbits = (
    scene: Scene,
    bodies: Body[],
    color: (body: Body) => Color,
    background: Color,
    pick: Color,
): Orbits => {
    const group = new Group();
    scene.add(group);
    const orbits: Orbit[] = [];
    let ghost: Ghost | null = null;
    // The ghost may be made after the last resize.
    let size = { width: 0, height: 0 };
    let pickedId: string | null = null;
    let skyShown = false;

    const mixed = new Color();
    const paintRamp = (orbit: Orbit, picked: boolean, dim: number) => {
        // Mixed in sRGB, like a canvas alpha blend, so faint lines don't wash out.
        // Over the sky the tail fades to black, which the max blend leaves out.
        const from = skyShown
            ? { r: 0, g: 0, b: 0 }
            : background.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
        const to = (picked ? pick : color(orbit.body)).getRGB(
            { r: 0, g: 0, b: 0 },
            SRGBColorSpace,
        );
        const minor =
            !picked && MINOR_KINDS.includes(orbit.body.kind) ? MINOR_DIM : 1;
        for (let back = 0; back < SAMPLES; back++) {
            const alpha = trailAlpha(back, SAMPLES, picked) * dim * minor;
            mixed.setRGB(
                from.r + (to.r - from.r) * alpha,
                from.g + (to.g - from.g) * alpha,
                from.b + (to.b - from.b) * alpha,
                SRGBColorSpace,
            );
            mixed.toArray(orbit.ramp, 3 * back);
        }
    };

    const paint = (orbit: Orbit, next: Paint) => {
        const dim = next.picked ? next.dim : 1;
        const now = orbit.paint;
        if (!now || now.picked !== next.picked || now.dim !== next.dim) {
            paintRamp(orbit, next.picked, dim);
        }

        for (let vertex = 0; vertex <= SAMPLES; vertex++) {
            const back = trailBack(
                vertex % SAMPLES,
                next.index,
                SAMPLES,
                next.direction,
            );
            setVertex(
                orbit.colors.array,
                vertex,
                orbit.ramp[3 * back] ?? 0,
                orbit.ramp[3 * back + 1] ?? 0,
                orbit.ramp[3 * back + 2] ?? 0,
            );
        }
        orbit.colors.needsUpdate = true;
        orbit.paint = next;
    };

    const target = new Vector3();
    const parentAt = new Vector3();
    const turn = new Quaternion();
    const turnInverse = new Quaternion();
    const normalTurn = new Quaternion();
    const axis = new Vector3();
    const relative = new Vector3();
    const inView = new Vector3();

    // Over the sky the casing is a dark rail, and additive lines turn white where segments overlap.
    const styleLines = (orbit: Orbit) => {
        const { line, casing } = orbit;
        line.material.blending = skyShown ? CustomBlending : NormalBlending;
        line.material.blendEquation = MaxEquation;
        line.material.needsUpdate = true;
        casing.material.visible = !skyShown;
        // Over the sky the lines fade toward black, which the max blend leaves out.
        if (skyShown) orbit.fade.ground.value.setRGB(0, 0, 0);
        else orbit.fade.ground.value.copy(background);
    };

    const addOrbit = (body: Body): Orbit | null => {
        if (body.parent === null || body.elements === null) return null;

        const { geometry, positions, colors, segments } = orbitGeometry(
            body.elements,
        );
        const material = new LineMaterial({
            linewidth: LINE_PX,
            transparent: true,
            opacity: 1,
            // The vertex colours carry the fade, so the line's own colour mustn't tint them.
            color: 0xffffff,
            vertexColors: true,
            toneMapped: false,
            // Markers draw over the line, which their own depth would lose to.
            depthWrite: false,
        });
        const line = new Line2(geometry, material);
        // Keeps the line readable where it crosses a sphere.
        const casing = new Line2(
            geometry,
            new LineMaterial({
                linewidth: casingPx(LINE_PX),
                transparent: true,
                depthWrite: false,
                color: background,
                toneMapped: false,
            }),
        );
        casing.renderOrder = -1;

        group.add(casing, line);
        const orbit: Orbit = {
            body,
            parent: body.parent,
            line,
            casing,
            fade: fadeLineMaterial(material),
            positions,
            colors,
            segments,
            near: false,
            paint: null,
            ramp: new Float32Array(3 * SAMPLES),
        };
        styleLines(orbit);
        orbits.push(orbit);

        return orbit;
    };

    // The geometry is shared by the line and its casing.
    const disposeOrbit = ({ line, casing }: Orbit) => {
        line.removeFromParent();
        casing.removeFromParent();
        line.geometry.dispose();
        line.material.dispose();
        casing.material.dispose();
    };

    for (const body of bodies) addOrbit(body);

    return {
        ghost: (body, elements) => {
            if (!elements || body.parent === null) {
                if (ghost) ghost.line.visible = false;
                return;
            }

            ghost = createGhost(
                group,
                ghost,
                body,
                body.parent,
                elements,
                pick,
                size,
            );
        },
        add: (body) => {
            const orbit = addOrbit(body);
            if (!orbit) return;

            // A body made at startup gets these from the first `resize` and `highlight`.
            orbit.line.material.resolution.set(size.width, size.height);
            orbit.casing.material.resolution.set(size.width, size.height);
            if (body.id === pickedId) {
                orbit.line.material.linewidth = SELECTED_LINE_PX;
                orbit.casing.material.linewidth = casingPx(SELECTED_LINE_PX);
            }
        },
        remove: (id) => {
            const at = orbits.findIndex((orbit) => orbit.body.id === id);
            if (at !== -1) disposeOrbit(orbits.splice(at, 1)[0] as Orbit);

            if (ghost && (ghost.body.id === id || ghost.parent === id)) {
                ghost.line.visible = false;
            }
        },
        rebuild: (body) => {
            const orbit = orbits.find(
                (candidate) => candidate.body.id === body.id,
            );
            if (!orbit || !body.elements) return;

            const { geometry, positions, colors, segments } = orbitGeometry(
                body.elements,
            );
            orbit.line.geometry.dispose();
            orbit.line.geometry = geometry;
            orbit.casing.geometry = geometry;
            orbit.body = body;
            orbit.positions = positions;
            orbit.colors = colors;
            orbit.segments = segments;
            orbit.paint = null;
            // The new geometry has the static layout.
            if (orbit.near) restoreStatic(orbit);
        },
        update: (origin, states, camera, rate, t) => {
            const fov = (camera.fov * Math.PI) / 180;
            const direction = rate < 0 ? -1 : 1;
            const dim = ghost?.line.visible ? GHOST_DIM : 1;

            for (const orbit of orbits) {
                const { body, parent, line, casing } = orbit;
                const parentR = states.get(parent)?.r;
                if (!parentR || !body.elements) continue;

                parentAt.set(
                    (parentR.x - origin.x) / 1000,
                    (parentR.y - origin.y) / 1000,
                    (parentR.z - origin.z) / 1000,
                );

                const aPx = projectedRadiusPx(
                    body.elements.a / 1000,
                    camera.position.distanceTo(parentAt),
                    fov,
                    size.height,
                );
                const picked = body.id === pickedId;
                const fade = orbitFade(aPx, size.width, size.height, picked);
                const shown = fade > 0;
                line.visible = shown;
                casing.visible = shown;
                if (shown) {
                    const { e, a } = body.elements;
                    orbit.fade.parentDepth.value = inView
                        .copy(parentAt)
                        .applyMatrix4(camera.matrixWorldInverse).z;
                    // An escape orbit has no far point, so its depth is measured against |a|.
                    orbit.fade.reach.value =
                        (e < 1 ? a * (1 + e) : Math.abs(a)) / 1000;
                    orbit.fade.fade.value = fade;
                    casing.material.opacity = fade;
                }

                const r = states.get(body.id)?.r;
                const distance = r
                    ? camera.position.distanceTo(
                          target.set(
                              (r.x - origin.x) / 1000,
                              (r.y - origin.y) / 1000,
                              (r.z - origin.z) / 1000,
                          ),
                      )
                    : Infinity;
                const near = orbitNear(distance, body.elements.a / 1000);
                if (orbit.near && !near) restoreStatic(orbit);

                // The near points are already placed in the world, so they take no turn.
                turn.identity();
                if (!near && body.precession) {
                    const [about, pole] = precessionTurns(
                        body.elements,
                        body.precession,
                        t,
                    );
                    normalTurn.setFromAxisAngle(
                        axis.set(about.axis.x, about.axis.y, about.axis.z),
                        about.angle,
                    );
                    turn.setFromAxisAngle(
                        axis.set(pole.axis.x, pole.axis.y, pole.axis.z),
                        pole.angle,
                    );
                    turn.multiply(normalTurn);
                }
                line.quaternion.copy(turn);
                casing.quaternion.copy(turn);
                if (!near) {
                    line.position.copy(parentAt);
                    casing.position.copy(parentAt);
                }
                if (!shown || !r) continue;

                if (near) {
                    rebuildNear(
                        orbit,
                        parentR,
                        r,
                        origin,
                        distance,
                        t,
                        { index: 0, direction, picked, dim },
                        paintRamp,
                    );
                    continue;
                }

                // The points are in the epoch orbit, so undo the turn on the body's position.
                relative
                    .set(
                        (r.x - parentR.x) / 1000,
                        (r.y - parentR.y) / 1000,
                        (r.z - parentR.z) / 1000,
                    )
                    .applyQuaternion(turnInverse.copy(turn).invert());
                const next: Paint = {
                    index: nearestPoint(
                        orbit.positions,
                        SAMPLES,
                        relative.x,
                        relative.y,
                        relative.z,
                    ),
                    direction,
                    picked,
                    dim,
                };
                const now = orbit.paint;
                if (
                    !now ||
                    now.index !== next.index ||
                    now.direction !== next.direction ||
                    now.picked !== next.picked ||
                    now.dim !== next.dim
                ) {
                    paint(orbit, next);
                }
            }

            if (ghost) updateGhost(ghost, origin, states, camera);
        },
        highlight: (id) => {
            pickedId = id;
            for (const orbit of orbits) {
                const px = orbit.body.id === id ? SELECTED_LINE_PX : LINE_PX;
                orbit.line.material.linewidth = px;
                orbit.casing.material.linewidth = casingPx(px);
                orbit.paint = null;
            }
        },
        sky: (shown) => {
            skyShown = shown;
            for (const orbit of orbits) {
                styleLines(orbit);
                orbit.paint = null;
            }
        },
        show: (shown) => {
            group.visible = shown;
        },
        resize: (width, height) => {
            size = { width, height };
            ghost?.line.material.resolution.set(width, height);
            for (const { line, casing } of orbits) {
                line.material.resolution.set(width, height);
                casing.material.resolution.set(width, height);
            }
        },
        dispose: () => {
            if (ghost) {
                ghost.line.removeFromParent();
                ghost.line.geometry.dispose();
                ghost.line.material.dispose();
            }
            for (const orbit of orbits) disposeOrbit(orbit);
            group.removeFromParent();
        },
    };
};
