import type { Body } from "@cpluspatch/orbit";
import {
    type CanvasTexture,
    type Color,
    Group,
    Mesh,
    type MeshBasicMaterial,
    MeshStandardMaterial,
    type SphereGeometry,
    Sprite,
    SpriteMaterial,
} from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Placement } from "../geometry/labels.ts";
import { createExtras } from "./extras.ts";
import { CENTERS } from "./labels.ts";
import { HALO_OPACITY, type Shape, shapeOf } from "./markers.ts";
import type { Extra } from "./patches.ts";
import { createSpacecraftModel } from "./spacecraft.ts";
import { createStarMaterial } from "./star.ts";

export type Entry = {
    body: Body;
    group: Group;
    sphere: Mesh<SphereGeometry, MeshBasicMaterial | MeshStandardMaterial>;
    /** A spacecraft's model, which stands in for its sphere. */
    model: Group | null;
    marker: Sprite;
    /** The root's glow, drawn with its marker. */
    halo: Sprite | null;
    label: CSS2DObject;
    /** The label's name and the "+N" count of the bodies folded into it. */
    name: HTMLElement;
    count: HTMLElement;
    /** What the label is drawn and measured with, as a key. Empty until the first update. */
    style: string;
    /** The label's width and height in px, without its offset. */
    text: { width: number; height: number };
    /** The px from the label's anchor to its box, which clears the sphere. */
    offset: number;
    /** Where the label sits, as a class modifier. */
    side: Placement;
    /** What the sphere has beyond its map: an atmosphere, and Earth's lights and clouds or Saturn's rings. */
    extras: Extra;
    /** Whether the body's map has been asked for. */
    mapped: boolean;
};

/** A body's group, with its sphere, marker, halo and label made but not added to the scene. */
export const createEntry = (
    body: Body,
    color: (body: Body) => Color,
    geometry: SphereGeometry,
    textures: Record<Shape, CanvasTexture>,
    haloTexture: CanvasTexture,
): Entry => {
    const group = new Group();

    const sphere = new Mesh(
        geometry,
        body.kind === "star"
            ? createStarMaterial(color(body))
            : new MeshStandardMaterial({
                  color: color(body),
                  roughness: 1,
                  // Turned on with the map, so a flat colour stays the theme's.
                  toneMapped: false,
              }),
    );
    sphere.scale.setScalar(body.radius / 1000);

    const marker = new Sprite(
        new SpriteMaterial({
            sizeAttenuation: false,
            map: textures[shapeOf(body)],
            color: color(body),
            // Markers draw in `renderOrder`, so they mustn't hide each other.
            depthWrite: false,
            toneMapped: false,
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
                      toneMapped: false,
                  }),
              )
            : null;

    const text = document.createElement("div");
    text.className = "orrery__label";
    const name = document.createElement("span");
    name.className = "orrery__label-name";
    name.textContent = body.name;
    const count = document.createElement("span");
    count.className = "orrery__label-count";
    text.append(name, count);
    const label = new CSS2DObject(text);
    // Its left edge sits on the body.
    label.center.set(...CENTERS.right);

    // The sphere stays for occlusion, picking and framing.
    const model =
        body.kind === "spacecraft" ? createSpacecraftModel(body) : null;
    if (model) {
        sphere.material.visible = false;
        group.add(model);
    }

    group.add(sphere, marker, label);
    if (halo) group.add(halo);
    const extras = createExtras(body, group, sphere);

    return {
        body,
        group,
        sphere,
        model,
        marker,
        halo,
        label,
        name,
        count,
        style: "",
        text: { width: 0, height: 0 },
        // Unset, so the first update writes it.
        offset: -1,
        side: "right",
        extras,
        mapped: false,
    };
};
