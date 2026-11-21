import type { Body, State, Vec3 } from "@cpluspatch/orbit";
import {
    AmbientLight,
    CanvasTexture,
    type Color,
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    type PerspectiveCamera,
    PointLight,
    type Scene,
    SphereGeometry,
    Sprite,
    SpriteMaterial,
    SRGBColorSpace,
    Vector3,
} from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import {
    type Anchor,
    type Dot,
    hiddenBehindSpheres,
    hiddenMarkers,
    LABEL_ANCHOR_GAP_PX,
    type LabelBox,
    type MarkerPoint,
    placeLabels,
    projectedRadiusPx,
    type Sphere,
} from "./geometry.ts";

/** The bodies of a scene: a sphere, a marker and a label each, and the light. */
export type Bodies = {
    /** Places every body relative to `origin` and picks what to show. */
    update: (camera: PerspectiveCamera, origin: Vec3, focus: string) => void;
    /** Sizes the markers for a viewport. */
    resize: (camera: PerspectiveCamera, width: number, height: number) => void;
    /** Recolours the bodies. */
    recolor: (color: (body: Body) => Color) => void;
    /** Removes the bodies and frees them. */
    dispose: () => void;
};

type Entry = {
    body: Body;
    group: Group;
    sphere: Mesh<SphereGeometry, MeshBasicMaterial | MeshStandardMaterial>;
    marker: Sprite;
    /** The root's glow, drawn with its marker. */
    halo: Sprite | null;
    label: CSS2DObject;
    /** The label's width and height in px, without its offset. */
    text: { width: number; height: number };
    /** The px from the label's anchor to its box, which clears the sphere. */
    offset: number;
    /** Whether the label sits left of its anchor. */
    left: boolean;
};

const MARKER_PX = 8;
const STAR_MARKER_PX = 12;
const HALO_SCALE = 3;
const HALO_OPACITY = 0.35;
const SPHERE_MIN_PX = 4;

const markerPx = (body: Body): number =>
    body.kind === "star" ? STAR_MARKER_PX : MARKER_PX;

const markerTexture = (halo: boolean): CanvasTexture => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("A 2D canvas is needed to draw markers.");

    if (halo) {
        const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        glow.addColorStop(0, "white");
        glow.addColorStop(1, "rgba(255, 255, 255, 0)");
        context.fillStyle = glow;
        context.fillRect(0, 0, 64, 64);
    } else {
        context.fillStyle = "white";
        context.beginPath();
        context.arc(32, 32, 30, 0, 2 * Math.PI);
        context.fill();
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;

    return texture;
};

/** The bodies of a scenario, in km, with their labels measured in `host`. */
export const createBodies = (
    scene: Scene,
    host: HTMLElement,
    bodies: Body[],
    states: Map<string, State>,
    color: (body: Body) => Color,
): Bodies => {
    const sphereGeometry = new SphereGeometry(1, 128, 64);
    // Up close, as from the ISS, 128 segments show as facets on Earth's limb.
    const fineGeometry = new SphereGeometry(1, 512, 256);
    const texture = markerTexture(false);
    const haloTexture = markerTexture(true);
    const entries: Entry[] = [];
    // Measures labels here, since a label has no layout until it's drawn.
    const probe = document.createElement("div");
    probe.className = "orrery__label orrery__label--probe";
    host.append(probe);

    for (const body of bodies) {
        const group = new Group();

        const sphere = new Mesh(
            sphereGeometry,
            body.kind === "star"
                ? new MeshBasicMaterial({ color: color(body) })
                : new MeshStandardMaterial({
                      color: color(body),
                      roughness: 1,
                  }),
        );
        sphere.scale.setScalar(body.radius / 1000);

        const marker = new Sprite(
            new SpriteMaterial({
                sizeAttenuation: false,
                map: texture,
                color: color(body),
                // Markers draw in `renderOrder`, so they mustn't hide each other.
                depthWrite: false,
            }),
        );
        const halo =
            body.parent === null
                ? new Sprite(
                      new SpriteMaterial({
                          sizeAttenuation: false,
                          map: haloTexture,
                          color: color(body),
                          opacity: HALO_OPACITY,
                          depthWrite: false,
                      }),
                  )
                : null;

        const text = document.createElement("div");
        text.className = "orrery__label";
        text.textContent = body.name;
        const label = new CSS2DObject(text);
        // Its left edge sits on the body.
        label.center.set(0, 0.5);

        group.add(sphere, marker, label);
        if (halo) group.add(halo);
        scene.add(group);
        entries.push({
            body,
            group,
            sphere,
            marker,
            halo,
            label,
            text: { width: 0, height: 0 },
            // Unset, so the first update writes it.
            offset: -1,
            left: false,
        });
    }

    // Bigger bodies draw later, and the root last.
    const drawSize = (body: Body) =>
        body.parent === null ? Infinity : body.radius;
    [...entries]
        .sort((a, b) => drawSize(a.body) - drawSize(b.body))
        .forEach(({ marker }, rank) => {
            marker.renderOrder = rank + 1;
        });

    const measure = () => {
        for (const entry of entries) {
            probe.textContent = entry.body.name;
            entry.text = {
                width: probe.offsetWidth,
                height: probe.offsetHeight,
            };
        }
    };
    measure();

    let disposed = false;
    document.fonts.ready.then(() => {
        if (!disposed) measure();
    });

    const rootGroup = entries.find(({ body }) => body.parent === null)?.group;
    const sun = new PointLight(undefined, 3, 0, 0);
    const ambient = new AmbientLight(undefined, 0.08);
    scene.add(sun, ambient);

    const view = new Vector3();
    let size = { width: 1, height: 1 };

    return {
        update: (camera, origin, focus) => {
            const fov = (camera.fov * Math.PI) / 180;
            const anchors: Anchor[] = [];
            const spheres: Sphere[] = [];
            const labels: LabelBox[] = [];
            const markers: MarkerPoint[] = [];
            const dots: Dot[] = [];

            for (const entry of entries) {
                const { body, group, sphere, marker, halo, label } = entry;
                const r = states.get(body.id)?.r;
                if (!r) continue;

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
                const big = radiusPx >= SPHERE_MIN_PX;
                sphere.visible = big;
                sphere.geometry =
                    radiusPx > size.height ? fineGeometry : sphereGeometry;
                marker.visible = !big;
                if (halo) halo.visible = !big;

                // Pushes the label from the disc's centre to its edge.
                const offset =
                    LABEL_ANCHOR_GAP_PX + (big ? Math.round(radiusPx) : 0);
                if (offset !== entry.offset) {
                    entry.offset = offset;
                    label.element.style.setProperty(
                        "--orrery-label-offset",
                        `${offset}px`,
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

                anchors.push({ id: body.id, pos });
                labels.push({
                    id: body.id,
                    x,
                    y,
                    width: entry.text.width,
                    height: entry.text.height,
                    offset,
                    disc: big,
                    radius: body.radius,
                });
                if (big)
                    spheres.push({
                        id: body.id,
                        pos,
                        radius: body.radius / 1000,
                    });
                else {
                    markers.push({ id: body.id, x, y, radius: body.radius });
                    dots.push({ id: body.id, x, y, size: markerPx(body) / 2 });
                }
            }

            const keep = new Set([focus]);
            const behind = hiddenBehindSpheres(anchors, spheres, keep);
            const covered = hiddenMarkers(markers, keep);
            const placements = placeLabels(
                labels.filter(({ id }) => !behind.has(id)),
                size,
                focus,
                dots.filter(({ id }) => !covered.has(id)),
            );

            for (const entry of entries) {
                const { body, marker, halo, label } = entry;
                const placement = placements.get(body.id) ?? "hidden";
                const left = placement === "left";
                label.visible = placement !== "hidden";
                if (left !== entry.left) {
                    entry.left = left;
                    label.center.set(left ? 1 : 0, 0.5);
                    label.element.classList.toggle("orrery__label--left", left);
                }

                if (covered.has(body.id)) {
                    marker.visible = false;
                    if (halo) halo.visible = false;
                }
            }

            if (rootGroup) sun.position.copy(rootGroup.position);
        },
        resize: (camera, width, height) => {
            size = { width, height };
            const scale = (pixels: number) =>
                (pixels * 2 * Math.tan((camera.fov * Math.PI) / 360)) / height;
            for (const { body, marker, halo } of entries) {
                const markerScale = scale(markerPx(body));
                marker.scale.set(markerScale, markerScale, 1);
                halo?.scale.set(
                    markerScale * HALO_SCALE,
                    markerScale * HALO_SCALE,
                    1,
                );
            }

            measure();
        },
        recolor: (pick) => {
            for (const { body, sphere, marker, halo } of entries) {
                sphere.material.color.copy(pick(body));
                marker.material.color.copy(pick(body));
                halo?.material.color.copy(pick(body));
            }
        },
        dispose: () => {
            disposed = true;
            for (const { group, sphere, marker, halo, label } of entries) {
                label.removeFromParent();
                group.removeFromParent();
                sphere.material.dispose();
                marker.material.dispose();
                halo?.material.dispose();
            }
            probe.remove();
            sun.removeFromParent();
            ambient.removeFromParent();
            sphereGeometry.dispose();
            fineGeometry.dispose();
            texture.dispose();
            haloTexture.dispose();
        },
    };
};
