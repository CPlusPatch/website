import type { Sphere } from "../layers/index.ts";
import type { Extra } from "./patches.ts";

/** The surface map on `sphere`, once it loads. */
export const surfaceExtra = (
    map: string,
    glow: boolean,
    sphere: Sphere,
): Extra => ({
    patches: [],
    load: (maps) =>
        maps.load(map, (texture) => {
            sphere.material.map = texture;
            sphere.material.color.set(0xffffff);
            // A glowing body is its own light, so it keeps its colours.
            sphere.material.toneMapped = !glow;
            sphere.material.needsUpdate = true;
        }),
    update: () => {},
    dispose: () => {},
});
