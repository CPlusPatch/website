import type { Body } from "@cpluspatch/sim";
import {
    type Group,
    type Mesh,
    type MeshBasicMaterial,
    MeshStandardMaterial,
    type SphereGeometry,
} from "three";
import { atmosphereExtra } from "./atmosphere.ts";
import { cloudsExtra } from "./clouds.ts";
import { nightExtra } from "./night.ts";
import { applyPatches, type Extra } from "./patches.ts";
import { ringsExtra } from "./rings.ts";

/** Everything a body's sphere gets on top of its map: its atmosphere, and for Earth and Saturn more. */
export const createExtras = (
    body: Body,
    group: Group,
    sphere: Mesh<SphereGeometry, MeshBasicMaterial | MeshStandardMaterial>,
): Extra => {
    const extras: Extra[] = [];
    if (body.model === "earth") extras.push(nightExtra(), cloudsExtra(sphere));
    if (body.model === "saturn") extras.push(ringsExtra(body, group, sphere));

    const atmosphere = atmosphereExtra(body, sphere);
    if (atmosphere) extras.push(atmosphere);

    const patches = extras.flatMap((extra) => extra.patches);
    if (sphere.material instanceof MeshStandardMaterial)
        applyPatches(sphere.material, patches);

    return {
        patches,
        load: (maps) => {
            for (const extra of extras) extra.load(maps);
        },
        update: (camera, geometry) => {
            for (const extra of extras) extra.update(camera, geometry);
        },
        dispose: () => {
            for (const extra of extras) extra.dispose();
        },
    };
};
