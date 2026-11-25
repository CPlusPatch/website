import type { Body } from "@cpluspatch/sim";
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
import { appearanceOf } from "../appearance.ts";
import type { Placement } from "../geometry/labels.ts";
import { createExtras, mapKeys } from "../layers/index.ts";
import { styleOf } from "../tags.ts";
import { createCorona } from "./corona.ts";
import { CENTERS } from "./labels.ts";
import { type Shape, shapeOf } from "./markers.ts";
import type { Extra } from "./patches.ts";
import { createSpacecraftModel } from "./spacecraft.ts";
import { createStarMaterial } from "./star.ts";

/** Everything one body has in the scene: its group, the parts of it, and its label. */
export type Entry = {
    body: Body;
    group: Group;
    sphere: Mesh<SphereGeometry, MeshBasicMaterial | MeshStandardMaterial>;
    /** A spacecraft's model, which stands in for its sphere. */
    model: Group | null;
    marker: Sprite;
    /** A star's glow, drawn with its disc or its marker. */
    corona: Sprite | null;
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
    /** What the sphere has beyond its colour: its map and whatever its appearance's layers add. */
    extras: Extra;
    /** The keys of the maps `extras` loads. Kept from creation, since an edit replaces `body`. */
    mapKeys: string[];
    /** Whether the body's map has been asked for. */
    mapped: boolean;
};

/** A body's group, with its sphere, marker, corona and label made but not added to the scene. */
export const createEntry = (
    body: Body,
    color: (body: Body) => Color,
    geometry: SphereGeometry,
    textures: Record<Shape, CanvasTexture>,
    coronaTexture: CanvasTexture,
): Entry => {
    const group = new Group();
    const style = styleOf(body);
    const appearance = appearanceOf(body);

    const sphere = new Mesh(
        geometry,
        appearance.glow
            ? createStarMaterial(color(body))
            : new MeshStandardMaterial({
                  color: color(body),
                  roughness: 1,
                  // Turned on with the map, so a flat colour stays the theme's.
                  toneMapped: false,
              }),
    );
    sphere.scale.setScalar(body.mass.radius / 1000);

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
    const corona = appearance.glow
        ? createCorona(coronaTexture, color(body))
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
    const model = style.craftMesh ? createSpacecraftModel(body) : null;
    if (model) {
        sphere.material.visible = false;
        group.add(model);
    }

    group.add(sphere, marker, label);
    if (corona) group.add(corona);
    const extras = createExtras(body, appearance, group, sphere);

    return {
        body,
        group,
        sphere,
        model,
        marker,
        corona,
        label,
        name,
        count,
        style: "",
        text: { width: 0, height: 0 },
        // Unset, so the first update writes it.
        offset: -1,
        side: "right",
        extras,
        mapKeys: mapKeys(appearance),
        mapped: false,
    };
};
