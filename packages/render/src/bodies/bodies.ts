import { sub, type Vec3 } from "@cpluspatch/orbit";
import type { Body } from "@cpluspatch/sim";
import {
    AmbientLight,
    Box3,
    type CanvasTexture,
    type Color,
    Matrix4,
    type PerspectiveCamera,
    PointLight,
    type Scene,
    SphereGeometry,
    Vector3,
} from "three";
import type { Assets } from "../assets.ts";
import { type Frame, orientationOf, positionOf, velocityOf } from "../frame.ts";
import { lvlhMatrix } from "../geometry/attitude.ts";
import { projectedBox } from "../geometry/footprint.ts";
import {
    LABEL_VERTICAL_GAP_PX,
    type Placement,
    type Rect,
} from "../geometry/labels.ts";
import {
    countText,
    heldPlacements,
    isMajor,
    layoutBodies,
    orbitSizes,
    type ScreenBody,
    settleLabels,
} from "../geometry/screen-pass.ts";
import { createMaps } from "../maps.ts";
import { disposeMesh } from "../meshes/index.ts";
import { type LabelRect, type PickPoint, pickLabel } from "../picking.ts";
import { spinMatrix } from "../spin.ts";
import { styleOf } from "../tags.ts";
import { coronaTexture } from "./corona.ts";
import { createEntry, type Entry } from "./entry.ts";
import { CENTERS, createLabels } from "./labels.ts";
import { markerPx, markerTexture, SHAPES, type Shape } from "./markers.ts";

/** The bodies of a scene: a sphere, a marker and a label each, and the light. */
export type Bodies = {
    /** Places every body relative to `origin` at the frame's time and picks what to show. Labels keep out of `blocked`. Returns where the shown bodies are on screen. */
    update: (
        camera: PerspectiveCamera,
        origin: Vec3,
        focus: string,
        selected: string | null,
        frame: Frame,
        blocked: Rect[],
    ) => PickPoint[];
    /** The boxes the shown labels took in the last update, by body id, in px from the canvas's top left. */
    placed: () => ReadonlyMap<string, Rect>;
    /** The body whose shown label holds a point, in px from the canvas's top left. */
    labelAt: (x: number, y: number, canvas: DOMRect) => string | null;
    /** The box the selected body's drawn shape took in the last update, in px from the canvas's top left. Undefined when `id` isn't selected or shows as a marker. */
    footprint: (id: string) => Rect | undefined;
    /** Marks the label of the hovered body, or clears it. */
    hover: (id: string | null) => void;
    /** Sizes the markers for a viewport. */
    resize: (camera: PerspectiveCamera, width: number, height: number) => void;
    /** Hides the spacecraft, asteroid and comet markers in bare mode, or shows them. */
    bare: (bare: boolean) => void;
    /** Redraws a body's colours, after its orbit or colour changed. */
    recolor: (body: Body) => void;
    /** Adds a sphere, marker and label for `body`. */
    add: (body: Body) => void;
    /** Removes body `id` and frees what it drew. */
    remove: (id: string) => void;
    /** Removes the bodies and frees them. */
    dispose: () => void;
};

/** How the spheres are textured. */
export type BodyOptions = {
    /** Whether to load the maps. */
    maps: boolean;
    /** The image of a map, or null when there's none. */
    images: Assets["map"];
    /** The anisotropy of each map. */
    anisotropy: number;
    /** Hears each map request and each map that settles, as done of total. */
    onMaps?: (done: number, total: number) => void;
};

/** The bodies of a scenario, in km, with their labels measured in `host`. */
export const createBodies = (
    scene: Scene,
    host: HTMLElement,
    bodies: Body[],
    color: (body: Body) => Color,
    options: BodyOptions,
): Bodies => {
    const sphereGeometry = new SphereGeometry(1, 128, 64);
    // Up close, as from the ISS, 128 segments show as facets on Earth's limb.
    const fineGeometry = new SphereGeometry(1, 512, 256);
    // One texture per shape, shared by every body of that shape.
    const textures = Object.fromEntries(
        SHAPES.map((shape) => [shape, markerTexture(shape)]),
    ) as Record<Shape, CanvasTexture>;
    const glowTexture = coronaTexture();
    const entries: Entry[] = [];
    const maps = createMaps(options.images, options.anisotropy, options.onMaps);
    const spin = new Matrix4();
    const styling = createLabels(host, entries);

    const addEntry = (body: Body): Entry => {
        const entry = createEntry(
            body,
            color,
            sphereGeometry,
            textures,
            glowTexture,
        );
        scene.add(entry.group);
        entries.push(entry);

        return entry;
    };
    for (const body of bodies) addEntry(body);

    // Bigger bodies draw later, and the root last.
    const drawSize = (body: Body) =>
        body.orbit === undefined ? Infinity : body.mass.radius;
    const sortMarkers = () => {
        [...entries]
            .sort((a, b) => drawSize(a.body) - drawSize(b.body))
            .forEach(({ marker }, rank) => {
                marker.renderOrder = rank + 1;
            });
    };
    sortMarkers();

    const disposeEntry = ({
        group,
        sphere,
        model,
        marker,
        corona,
        label,
        extras,
    }: Entry) => {
        extras.dispose();
        if (model) disposeMesh(model);
        label.removeFromParent();
        group.removeFromParent();
        sphere.material.dispose();
        marker.material.dispose();
        corona?.material.dispose();
    };

    let hoverId: string | null = null;
    let placements = new Map<string, Placement>();
    // The children whose labels the last placement culled, by parent id, for the "+N" counts.
    let culled = new Map<string, string[]>();
    // When each label last changed placement, from `performance.now()`.
    const changed = new Map<string, number>();
    let placed = new Map<string, Rect>();
    let bare = false;

    let disposed = false;
    document.fonts.ready.then(() => {
        if (!disposed) styling.measureAll();
    });

    const rootGroup = entries.find(
        ({ body }) => body.orbit === undefined,
    )?.group;
    const sun = new PointLight(undefined, 3, 0, 0);
    const ambient = new AmbientLight(undefined, 0.015);
    scene.add(sun, ambient);

    const view = new Vector3();
    const worldBox = new Box3();
    // The selected body's drawn shape in the last update, or null when it isn't drawn big.
    let drawn: {
        id: string;
        camera: PerspectiveCamera;
        x: number;
        y: number;
        radiusPx: number;
        model: Entry["model"];
    } | null = null;
    let size = { width: 1, height: 1 };
    // The last resize's px to marker scale, which a body added later needs.
    let markerScale: ((pixels: number) => number) | null = null;

    return {
        update: (camera, origin, focus, selected, frame, blocked) => {
            const fov = (camera.fov * Math.PI) / 180;
            const viewport = size;
            const keep = new Set([focus]);
            if (selected) keep.add(selected);

            const positions = new Map<string, Vec3>();
            for (const id of frame.system.ids) {
                const r = positionOf(frame, id);
                if (!r) continue;

                positions.set(id, {
                    x: (r.x - origin.x) / 1000,
                    y: (r.y - origin.y) / 1000,
                    z: (r.z - origin.z) / 1000,
                });
            }
            const screenBodies = entries.map(
                ({ body, model }): ScreenBody => ({
                    id: body.id,
                    parent: body.orbit?.parent ?? null,
                    style: styleOf(body),
                    mu: body.mass.mu,
                    radius: body.mass.radius,
                    a: body.orbit?.elements.a ?? null,
                    model: model !== null,
                    markerPx: markerPx(body),
                }),
            );

            // An orbit's size on screen sets what folds and which labels show.
            const sizes = orbitSizes(
                screenBodies,
                positions,
                camera.position,
                fov,
                viewport,
                keep,
            );
            const { folds, folded } = sizes;
            const names = new Map(
                entries.map(({ body }) => [body.id, body.name]),
            );
            const restyle = (entry: Entry) => {
                const { body } = entry;
                const hidden = [
                    ...(folds.get(body.id) ?? []),
                    ...(culled.get(body.id) ?? []),
                ];
                const hovered = body.id === hoverId;
                styling.restyle(entry, {
                    selected: body.id === selected,
                    big: isMajor({ id: body.id, style: styleOf(body) }, focus),
                    hover: hovered,
                    count: countText(hidden, names, hovered),
                });
            };

            // The "+N" count sets the label's size, so the labels restyle before they're laid out.
            const text = new Map<string, Entry["text"]>();
            for (const entry of entries) {
                const { body, sphere, model, marker, corona } = entry;
                if (!frame.system.index.has(body.id)) continue;

                if (folded.has(body.id)) {
                    sphere.visible = false;
                    if (model) model.visible = false;
                    marker.visible = false;
                    if (corona) corona.visible = false;
                    continue;
                }

                restyle(entry);
                text.set(body.id, entry.text);
            }

            const layout = layoutBodies({
                bodies: screenBodies,
                positions,
                sizes,
                text,
                camera: camera.position,
                fov,
                viewport,
                focus,
                selected,
                hovered: hoverId,
                keep,
                project: (position) => {
                    // A point behind the camera projects to a mirrored spot.
                    view.set(position.x, position.y, position.z);
                    view.applyMatrix4(camera.matrixWorldInverse);
                    if (view.z >= 0) return null;

                    const cameraSpace = { x: view.x, y: view.y, z: view.z };
                    view.applyMatrix4(camera.projectionMatrix);

                    return {
                        x: (view.x * 0.5 + 0.5) * viewport.width,
                        y: (0.5 - view.y * 0.5) * viewport.height,
                        view: cameraSpace,
                    };
                },
            });
            const drawnId = layout.drawn?.id;
            drawn =
                layout.drawn && drawnId !== undefined
                    ? {
                          ...layout.drawn,
                          camera,
                          model:
                              entries.find(({ body }) => body.id === drawnId)
                                  ?.model ?? null,
                      }
                    : null;

            for (const entry of entries) {
                const { body, group, sphere, model, corona, label } = entry;
                const laid = layout.bodies.get(body.id);
                const position = positions.get(body.id);
                if (!laid || !position) continue;

                const { big, offset } = laid;
                group.position.set(position.x, position.y, position.z);

                sphere.visible = big;
                if (model) {
                    model.visible = big;
                    const r = positionOf(frame, body.id);
                    const v = velocityOf(frame, body.id);
                    const parentR = body.orbit
                        ? positionOf(frame, body.orbit.parent)
                        : undefined;
                    const parentV = body.orbit
                        ? velocityOf(frame, body.orbit.parent)
                        : undefined;
                    if (big && r && v && parentR && parentV) {
                        spin.fromArray(
                            lvlhMatrix(sub(r, parentR), sub(v, parentV)),
                        );
                        model.quaternion.setFromRotationMatrix(spin);
                    }
                }
                if (big) {
                    if (options.maps && !entry.mapped && !model) {
                        entry.mapped = true;
                        entry.extras.load(maps);
                    }

                    const orientation = orientationOf(frame, body.id);
                    if (orientation) {
                        spin.fromArray(spinMatrix(orientation));
                        sphere.quaternion.setFromRotationMatrix(spin);
                    }
                }
                sphere.geometry = laid.fine ? fineGeometry : sphereGeometry;
                if (big && entry.mapped)
                    entry.extras.update(camera, sphere.geometry);
                if (corona) {
                    corona.scale.set(
                        laid.coronaDiameter,
                        laid.coronaDiameter,
                        1,
                    );
                }

                if (offset !== entry.offset) {
                    entry.offset = offset;
                    label.element.style.setProperty(
                        "--orrery-label-offset",
                        `${offset}px`,
                    );
                    label.element.style.setProperty(
                        "--orrery-label-offset-y",
                        `${offset + LABEL_VERTICAL_GAP_PX}px`,
                    );
                }
            }

            const now = performance.now();
            const settled = settleLabels({
                bodies: screenBodies,
                layout,
                viewport,
                focus,
                selected,
                hovered: hoverId,
                keep,
                folded,
                bare,
                previous: placements,
                held: heldPlacements(placements, changed, now),
                sides: new Map(
                    entries.map(({ body, side }) => [body.id, side]),
                ),
                blocked,
            });
            for (const id of settled.changed) changed.set(id, now);
            placements = settled.placements;
            culled = settled.culled;
            placed = settled.placed;
            for (const entry of entries) {
                if (
                    frame.system.index.has(entry.body.id) &&
                    !folded.has(entry.body.id)
                ) {
                    restyle(entry);
                }
            }

            for (const entry of entries) {
                const { body, marker, corona, label } = entry;
                const placement = placements.get(body.id) ?? "hidden";
                label.visible = placement !== "hidden";
                // A hidden label isn't drawn, so its side can wait.
                if (placement !== "hidden" && placement !== entry.side) {
                    const { classList } = label.element;
                    classList.remove(`orrery__label--${entry.side}`);
                    classList.add(`orrery__label--${placement}`);
                    label.center.set(...CENTERS[placement]);
                    entry.side = placement;
                }

                const shown = settled.shown.get(body.id);
                if (!shown) continue;

                marker.visible = shown.marker;
                if (corona) corona.visible = shown.corona;
            }

            if (rootGroup) sun.position.copy(rootGroup.position);

            return settled.picks;
        },
        placed: () => placed,
        labelAt: (x, y, canvas) => {
            const rects: LabelRect[] = [];
            for (const { body, label } of entries) {
                if (!label.visible) continue;

                const box = label.element.getBoundingClientRect();
                rects.push({
                    id: body.id,
                    left: box.left - canvas.left,
                    top: box.top - canvas.top,
                    right: box.right - canvas.left,
                    bottom: box.bottom - canvas.top,
                });
            }

            return pickLabel(rects, x, y);
        },
        footprint: (id) => {
            if (!drawn || drawn.id !== id) return undefined;

            const { camera, x, y, radiusPx, model } = drawn;
            if (!model) {
                return {
                    left: x - radiusPx,
                    top: y - radiusPx,
                    right: x + radiusPx,
                    bottom: y + radiusPx,
                };
            }

            // The group's matrices are only refreshed when rendering.
            model.updateWorldMatrix(true, true);
            worldBox.setFromObject(model);

            return projectedBox(worldBox, camera, size.width, size.height);
        },
        hover: (id) => {
            if (id === hoverId) return;

            hoverId = id;
        },
        resize: (camera, width, height) => {
            size = { width, height };
            const scale = (pixels: number) =>
                (pixels * 2 * Math.tan((camera.fov * Math.PI) / 360)) / height;
            markerScale = scale;
            for (const { body, marker } of entries) {
                const px = scale(markerPx(body));
                marker.scale.set(px, px, 1);
            }

            styling.measureAll();
        },
        bare: (on) => {
            bare = on;
        },
        recolor: (body) => {
            const entry = entries.find(({ body: b }) => b.id === body.id);
            if (!entry) return;

            // The body is replaced on each edit.
            entry.body = body;

            // Only a satellite's colour follows its orbit, and a mapped sphere must stay white.
            if (!styleOf(body).colorByOrbitClass) return;

            const next = color(body);
            entry.sphere.material.color.copy(next);
            entry.marker.material.color.copy(next);
        },
        add: (body) => {
            const { marker } = addEntry(body);
            sortMarkers();

            if (markerScale) {
                const px = markerScale(markerPx(body));
                marker.scale.set(px, px, 1);
            }
        },
        remove: (id) => {
            const at = entries.findIndex((entry) => entry.body.id === id);
            const removed = at === -1 ? undefined : entries.splice(at, 1)[0];
            if (removed) disposeEntry(removed);
            sortMarkers();

            placements.delete(id);
            culled.delete(id);
            changed.delete(id);
            placed.delete(id);
            if (hoverId === id) hoverId = null;
            if (drawn?.id === id) drawn = null;

            // Two bodies can share a map, so it stays while another body uses it.
            if (removed) {
                const kept = new Set(entries.flatMap((entry) => entry.mapKeys));
                for (const key of removed.mapKeys) {
                    if (!kept.has(key)) maps.release(key);
                }
            }
        },
        dispose: () => {
            disposed = true;
            for (const entry of entries) disposeEntry(entry);
            styling.dispose();
            sun.removeFromParent();
            ambient.removeFromParent();
            sphereGeometry.dispose();
            fineGeometry.dispose();
            for (const texture of Object.values(textures)) texture.dispose();
            glowTexture.dispose();
            maps.dispose();
        },
    };
};
