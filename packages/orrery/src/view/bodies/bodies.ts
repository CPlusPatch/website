import {
    type Body,
    bodyOrientation,
    type State,
    sub,
    type Vec3,
} from "@cpluspatch/orbit";
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
import { lvlhMatrix } from "../geometry/attitude.ts";
import { projectedBox } from "../geometry/footprint.ts";
import {
    type Dot,
    LABEL_ANCHOR_GAP_PX,
    LABEL_VERTICAL_GAP_PX,
    type LabelBox,
    labelRect,
    type Placement,
    placeLabels,
    type Rect,
} from "../geometry/labels.ts";
import { READOUT_BLOCK_PX, READOUTS_MIN_ORBIT_PX } from "../geometry/notes.ts";
import {
    type Anchor,
    coronaDiameter,
    culledByParent,
    foldOrbits,
    hiddenBehindSpheres,
    hiddenMarkers,
    labelRank,
    labelShownForOrbit,
    type MarkerPoint,
    orbitShown,
    projectedRadiusPx,
    type Sphere,
} from "../geometry/visibility.ts";
import { createMaps } from "../maps.ts";
import { type LabelRect, type PickPoint, pickLabel } from "../picking.ts";
import { spinMatrix } from "../spin.ts";
import { coronaTexture } from "./corona.ts";
import { createEntry, type Entry } from "./entry.ts";
import { CENTERS, createLabels } from "./labels.ts";
import { markerPx, markerTexture, SHAPES, type Shape } from "./markers.ts";
import { disposeModel } from "./spacecraft.ts";

/** The bodies of a scene: a sphere, a marker and a label each, and the light. */
export type Bodies = {
    /** Places every body relative to `origin` at clock time `t` and picks what to show. Labels keep out of `blocked`. Returns where the shown bodies are on screen. */
    update: (
        camera: PerspectiveCamera,
        t: number,
        origin: Vec3,
        focus: string,
        selected: string | null,
        states: Map<string, State>,
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

const SPHERE_MIN_PX = 4;

/** The kinds whose markers are icons rather than plain dots, which bare mode hides. */
const ICON_KINDS = new Set(["spacecraft", "asteroid", "comet"]);

/** The projected radius in px from which a model replaces the marker, since smaller it's a few dark pixels. */
const MODEL_MIN_PX = 12;

/** The ms a label keeps a new placement, so a fast moon doesn't blink as it passes other labels. */
const LABEL_HOLD_MS = 500;

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
        body.parent === null ? Infinity : body.radius;
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
        if (model) disposeModel(model);
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
    const placed = new Map<string, Rect>();
    const bareHidden = new Set<string>();
    let bare = false;

    let disposed = false;
    document.fonts.ready.then(() => {
        if (!disposed) styling.measureAll();
    });

    const rootGroup = entries.find(({ body }) => body.parent === null)?.group;
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
        update: (camera, t, origin, focus, selected, states, blocked) => {
            const fov = (camera.fov * Math.PI) / 180;
            const keep = new Set([focus]);
            if (selected) keep.add(selected);

            // An orbit's size on screen sets what folds and which labels show.
            const orbitPx = new Map<string, number>();
            for (const { body } of entries) {
                if (body.parent === null) continue;
                const parentR = states.get(body.parent)?.r;
                if (!parentR) continue;

                view.set(
                    (parentR.x - origin.x) / 1000,
                    (parentR.y - origin.y) / 1000,
                    (parentR.z - origin.z) / 1000,
                );
                orbitPx.set(
                    body.id,
                    projectedRadiusPx(
                        body.elements.a / 1000,
                        camera.position.distanceTo(view),
                        fov,
                        size.height,
                    ),
                );
            }
            const folds = foldOrbits(
                entries.flatMap(({ body }) => {
                    const aPx = orbitPx.get(body.id);

                    return body.parent && aPx !== undefined
                        ? [{ id: body.id, parent: body.parent, aPx }]
                        : [];
                }),
                keep,
            );
            const folded = new Set([...folds.values()].flat());
            const names = new Map(
                entries.map(({ body }) => [body.id, body.name]),
            );
            const isMajor = (body: Body) =>
                body.kind === "star" ||
                body.kind === "planet" ||
                body.id === focus;
            const restyle = (entry: Entry) => {
                const { body } = entry;
                const hidden = [
                    ...(folds.get(body.id) ?? []),
                    ...(culled.get(body.id) ?? []),
                ];
                const hovered = body.id === hoverId;
                styling.restyle(entry, {
                    selected: body.id === selected,
                    big: isMajor(body),
                    hover: hovered,
                    count: !hidden.length
                        ? ""
                        : hovered
                          ? `+ ${hidden.map((id) => names.get(id)).join(", ")}`
                          : `+${hidden.length}`,
                });
            };
            // The picked orbit's readouts show from the same size as `readouts.ts` uses.
            const pickedPx = selected ? orbitPx.get(selected) : undefined;
            const readoutRoom =
                pickedPx !== undefined &&
                pickedPx > READOUTS_MIN_ORBIT_PX &&
                orbitShown(pickedPx, size.width, size.height, true);
            const anchors: Anchor[] = [];
            const spheres: Sphere[] = [];
            const labels: LabelBox[] = [];
            const markers: MarkerPoint[] = [];
            const dots: Dot[] = [];
            const picks: PickPoint[] = [];
            drawn = null;

            for (const entry of entries) {
                const { body, group, sphere, model, marker, corona, label } =
                    entry;
                const r = states.get(body.id)?.r;
                if (!r) continue;

                if (folded.has(body.id)) {
                    sphere.visible = false;
                    if (model) model.visible = false;
                    marker.visible = false;
                    if (corona) corona.visible = false;
                    continue;
                }

                const hovered = body.id === hoverId;
                const major = isMajor(body);
                restyle(entry);

                group.position.set(
                    (r.x - origin.x) / 1000,
                    (r.y - origin.y) / 1000,
                    (r.z - origin.z) / 1000,
                );

                const depth = camera.position.distanceTo(group.position);
                const radiusPx = projectedRadiusPx(
                    body.radius / 1000,
                    depth,
                    fov,
                    size.height,
                );
                const big = radiusPx >= (model ? MODEL_MIN_PX : SPHERE_MIN_PX);
                sphere.visible = big;
                if (model) {
                    model.visible = big;
                    const state = states.get(body.id);
                    const parent = body.parent && states.get(body.parent);
                    if (big && state && parent) {
                        spin.fromArray(
                            lvlhMatrix(
                                sub(state.r, parent.r),
                                sub(state.v, parent.v),
                            ),
                        );
                        model.quaternion.setFromRotationMatrix(spin);
                    }
                }
                if (big) {
                    if (options.maps && !entry.mapped && !model) {
                        entry.mapped = true;
                        if (body.model !== undefined) {
                            maps.load(body.model, (map) => {
                                sphere.material.map = map;
                                sphere.material.color.set(0xffffff);
                                // The Sun is its own light, so it keeps its colours.
                                sphere.material.toneMapped =
                                    body.kind !== "star";
                                sphere.material.needsUpdate = true;
                            });
                        }
                        entry.extras.load(maps);
                    }

                    const orientation = bodyOrientation(body.model, t);
                    if (orientation) {
                        spin.fromArray(spinMatrix(orientation));
                        sphere.quaternion.setFromRotationMatrix(spin);
                    }
                }
                sphere.geometry =
                    radiusPx > size.height ? fineGeometry : sphereGeometry;
                if (big && entry.mapped)
                    entry.extras.update(camera, sphere.geometry);
                marker.visible = !big;
                if (corona) {
                    corona.visible = true;
                    const diameter = coronaDiameter(
                        body.radius / 1000,
                        depth,
                        fov,
                        size.height,
                    );
                    corona.scale.set(diameter, diameter, 1);
                }

                // Pushes the label from the disc's or marker's centre to its edge.
                const offset =
                    LABEL_ANCHOR_GAP_PX +
                    Math.round(big ? radiusPx : markerPx(body) / 2);
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

                // A point behind the camera projects to a mirrored spot.
                view.copy(group.position).applyMatrix4(
                    camera.matrixWorldInverse,
                );
                if (view.z >= 0) continue;

                const pos = { x: view.x, y: view.y, z: view.z };
                view.applyMatrix4(camera.projectionMatrix);
                const x = (view.x * 0.5 + 0.5) * size.width;
                const y = (0.5 - view.y * 0.5) * size.height;

                picks.push({
                    id: body.id,
                    x,
                    y,
                    depth,
                    radius: big ? radiusPx : markerPx(body) / 2,
                });
                anchors.push({ id: body.id, pos });
                if (big && body.id === selected) {
                    drawn = { id: body.id, camera, x, y, radiusPx, model };
                }
                if (
                    labelShownForOrbit(
                        orbitPx.get(body.id),
                        keep.has(body.id) || hovered,
                    )
                ) {
                    labels.push({
                        id: body.id,
                        x,
                        y,
                        width: entry.text.width,
                        height: entry.text.height,
                        offset,
                        disc: big,
                        rank: labelRank(body.kind, body.mu),
                        big: major,
                        readout:
                            readoutRoom && body.id === selected
                                ? READOUT_BLOCK_PX
                                : undefined,
                    });
                }
                if (big) {
                    spheres.push({
                        id: body.id,
                        pos,
                        radius: body.radius / 1000,
                    });
                } else {
                    markers.push({ id: body.id, x, y, radius: body.radius });
                    dots.push({ id: body.id, x, y, size: markerPx(body) / 2 });
                }
            }

            const now = performance.now();
            const held = new Map<string, Placement>();
            for (const [id, placement] of placements) {
                if (now - (changed.get(id) ?? -Infinity) < LABEL_HOLD_MS) {
                    held.set(id, placement);
                }
            }
            const sides = new Map(
                entries.map(({ body, side }) => [body.id, side]),
            );

            const behind = hiddenBehindSpheres(anchors, spheres, keep);
            const covered = hiddenMarkers(markers, keep);
            const next = placeLabels(
                labels.filter(({ id }) => !behind.has(id)),
                size,
                focus,
                dots.filter(({ id }) => !covered.has(id)),
                [selected, hoverId].filter((id) => id !== null),
                sides,
                blocked,
                held,
            );
            for (const [id, placement] of next) {
                if (placement !== (placements.get(id) ?? "hidden")) {
                    changed.set(id, now);
                }
            }
            placements = next;

            const boxes = new Map(labels.map((box) => [box.id, box]));
            // A moon or craft with no label would show as an unnamed marker.
            const unnamed = new Set<string>();
            for (const { body } of entries) {
                if (
                    (placements.get(body.id) ?? "hidden") === "hidden" &&
                    (body.kind === "moon" || body.kind === "spacecraft") &&
                    !keep.has(body.id) &&
                    body.id !== hoverId
                ) {
                    unnamed.add(body.id);
                }
            }

            // The "+N" counts them too, once placement has culled them.
            culled = culledByParent(
                entries.map(({ body }) => body),
                unnamed,
                folded,
            );
            for (const entry of entries) {
                if (states.has(entry.body.id) && !folded.has(entry.body.id)) {
                    restyle(entry);
                }
            }

            placed.clear();
            bareHidden.clear();
            for (const entry of entries) {
                const { body, sphere, marker, corona, label } = entry;
                const placement = placements.get(body.id) ?? "hidden";
                const box = boxes.get(body.id);
                if (box && placement !== "hidden") {
                    placed.set(body.id, labelRect(box, placement));
                }
                label.visible = placement !== "hidden";
                // A hidden label isn't drawn, so its side can wait.
                if (placement !== "hidden" && placement !== entry.side) {
                    const { classList } = label.element;
                    classList.remove(`orrery__label--${entry.side}`);
                    classList.add(`orrery__label--${placement}`);
                    label.center.set(...CENTERS[placement]);
                    entry.side = placement;
                }

                if (bare && marker.visible && ICON_KINDS.has(body.kind)) {
                    bareHidden.add(body.id);
                }
                if (
                    covered.has(body.id) ||
                    unnamed.has(body.id) ||
                    bareHidden.has(body.id)
                ) {
                    marker.visible = false;
                    // The disc, when drawn, still glows.
                    if (corona && !sphere.visible) corona.visible = false;
                }
            }

            if (rootGroup) sun.position.copy(rootGroup.position);

            return picks.filter(
                ({ id }) =>
                    !behind.has(id) &&
                    !covered.has(id) &&
                    !unnamed.has(id) &&
                    !bareHidden.has(id),
            );
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
            if (body.kind !== "spacecraft") return;

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
            bareHidden.delete(id);
            if (hoverId === id) hoverId = null;
            if (drawn?.id === id) drawn = null;

            // Two bodies can share a model, so its map stays while another body has it.
            const model = removed?.body.model;
            if (model && !entries.some((entry) => entry.body.model === model)) {
                maps.release(model);
                // Saturn's rings are a map of their own, which a later Saturn needs again.
                if (model === "saturn") maps.release("saturn-ring");
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
