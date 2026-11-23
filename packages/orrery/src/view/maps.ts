/**
 * @module
 * The surface maps of the bodies, fetched when a body is first shown as a sphere.
 */

import {
    NoColorSpace,
    SRGBColorSpace,
    type Texture,
    TextureLoader,
} from "three";

/** Vite only bundles an asset whose `new URL` is a literal, so each map is spelt out. */
const MAPS: Record<string, string> = {
    sun: new URL("../assets/maps/sun.webp", import.meta.url).href,
    mercury: new URL("../assets/maps/mercury.webp", import.meta.url).href,
    venus: new URL("../assets/maps/venus.webp", import.meta.url).href,
    earth: new URL("../assets/maps/earth.webp", import.meta.url).href,
    moon: new URL("../assets/maps/moon.webp", import.meta.url).href,
    mars: new URL("../assets/maps/mars.webp", import.meta.url).href,
    jupiter: new URL("../assets/maps/jupiter.webp", import.meta.url).href,
    saturn: new URL("../assets/maps/saturn.webp", import.meta.url).href,
    uranus: new URL("../assets/maps/uranus.webp", import.meta.url).href,
    neptune: new URL("../assets/maps/neptune.webp", import.meta.url).href,
    pluto: new URL("../assets/maps/pluto.webp", import.meta.url).href,
    io: new URL("../assets/maps/io.webp", import.meta.url).href,
    europa: new URL("../assets/maps/europa.webp", import.meta.url).href,
    ganymede: new URL("../assets/maps/ganymede.webp", import.meta.url).href,
    callisto: new URL("../assets/maps/callisto.webp", import.meta.url).href,
    mimas: new URL("../assets/maps/mimas.webp", import.meta.url).href,
    enceladus: new URL("../assets/maps/enceladus.webp", import.meta.url).href,
    tethys: new URL("../assets/maps/tethys.webp", import.meta.url).href,
    dione: new URL("../assets/maps/dione.webp", import.meta.url).href,
    rhea: new URL("../assets/maps/rhea.webp", import.meta.url).href,
    iapetus: new URL("../assets/maps/iapetus.webp", import.meta.url).href,
    triton: new URL("../assets/maps/triton.webp", import.meta.url).href,
    phobos: new URL("../assets/maps/phobos.webp", import.meta.url).href,
    charon: new URL("../assets/maps/charon.webp", import.meta.url).href,
    ceres: new URL("../assets/maps/ceres.webp", import.meta.url).href,
    vesta: new URL("../assets/maps/vesta.webp", import.meta.url).href,
    "earth-night": new URL("../assets/maps/earth-night.webp", import.meta.url)
        .href,
    "earth-clouds": new URL("../assets/maps/earth-clouds.webp", import.meta.url)
        .href,
    "saturn-ring": new URL("../assets/maps/saturn-ring.webp", import.meta.url)
        .href,
};

/** Maps that hold data, not colour. */
const LINEAR = new Set(["earth-clouds"]);

/** The maps of the bodies that have one. */
export type Maps = {
    /** Fetches the map of a body once and hands it to `onLoad`. Ignores a body with no map. */
    load: (id: string, onLoad: (texture: Texture) => void) => void;
    /** Frees every loaded map, and any that arrives later. */
    dispose: () => void;
};

/** Maps that load on demand, with `anisotropy` set on each. */
export const createMaps = (anisotropy: number): Maps => {
    const loader = new TextureLoader();
    const started = new Set<string>();
    const loaded: Texture[] = [];
    let disposed = false;

    return {
        load: (id, onLoad) => {
            const url = Object.hasOwn(MAPS, id) ? MAPS[id] : undefined;
            if (url === undefined || started.has(id)) return;

            started.add(id);
            loader.loadAsync(url).then(
                (texture) => {
                    if (disposed) {
                        texture.dispose();
                        return;
                    }

                    texture.colorSpace = LINEAR.has(id)
                        ? NoColorSpace
                        : SRGBColorSpace;
                    texture.anisotropy = anisotropy;
                    loaded.push(texture);
                    onLoad(texture);
                },
                (error: unknown) => {
                    console.warn(
                        `The Orrery couldn't load the map of ${id}.`,
                        error,
                    );
                },
            );
        },
        dispose: () => {
            disposed = true;
            for (const texture of loaded) texture.dispose();
            loaded.length = 0;
        },
    };
};
