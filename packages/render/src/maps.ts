/**
 * @module
 * The surface maps of the bodies, fetched when a body is first shown as a sphere.
 */

import { ImageLoader, NoColorSpace, SRGBColorSpace, Texture } from "three";

/**
 * Keyed by the map names that built-in presets give their bodies' appearance.
 * Vite only bundles an asset whose `new URL` is a literal, so each map is spelt out.
 */
const MAPS: Readonly<Record<string, string>> = {
    sun: new URL("./assets/maps/sun.webp", import.meta.url).href,
    mercury: new URL("./assets/maps/mercury.webp", import.meta.url).href,
    venus: new URL("./assets/maps/venus.webp", import.meta.url).href,
    earth: new URL("./assets/maps/earth.webp", import.meta.url).href,
    moon: new URL("./assets/maps/moon.webp", import.meta.url).href,
    mars: new URL("./assets/maps/mars.webp", import.meta.url).href,
    jupiter: new URL("./assets/maps/jupiter.webp", import.meta.url).href,
    saturn: new URL("./assets/maps/saturn.webp", import.meta.url).href,
    uranus: new URL("./assets/maps/uranus.webp", import.meta.url).href,
    neptune: new URL("./assets/maps/neptune.webp", import.meta.url).href,
    pluto: new URL("./assets/maps/pluto.webp", import.meta.url).href,
    io: new URL("./assets/maps/io.webp", import.meta.url).href,
    europa: new URL("./assets/maps/europa.webp", import.meta.url).href,
    ganymede: new URL("./assets/maps/ganymede.webp", import.meta.url).href,
    callisto: new URL("./assets/maps/callisto.webp", import.meta.url).href,
    mimas: new URL("./assets/maps/mimas.webp", import.meta.url).href,
    enceladus: new URL("./assets/maps/enceladus.webp", import.meta.url).href,
    tethys: new URL("./assets/maps/tethys.webp", import.meta.url).href,
    dione: new URL("./assets/maps/dione.webp", import.meta.url).href,
    rhea: new URL("./assets/maps/rhea.webp", import.meta.url).href,
    iapetus: new URL("./assets/maps/iapetus.webp", import.meta.url).href,
    triton: new URL("./assets/maps/triton.webp", import.meta.url).href,
    phobos: new URL("./assets/maps/phobos.webp", import.meta.url).href,
    charon: new URL("./assets/maps/charon.webp", import.meta.url).href,
    ceres: new URL("./assets/maps/ceres.webp", import.meta.url).href,
    vesta: new URL("./assets/maps/vesta.webp", import.meta.url).href,
    kerbol: new URL("./assets/maps/kerbol.webp", import.meta.url).href,
    moho: new URL("./assets/maps/moho.webp", import.meta.url).href,
    eve: new URL("./assets/maps/eve.webp", import.meta.url).href,
    gilly: new URL("./assets/maps/gilly.webp", import.meta.url).href,
    kerbin: new URL("./assets/maps/kerbin.webp", import.meta.url).href,
    mun: new URL("./assets/maps/mun.webp", import.meta.url).href,
    minmus: new URL("./assets/maps/minmus.webp", import.meta.url).href,
    duna: new URL("./assets/maps/duna.webp", import.meta.url).href,
    ike: new URL("./assets/maps/ike.webp", import.meta.url).href,
    dres: new URL("./assets/maps/dres.webp", import.meta.url).href,
    jool: new URL("./assets/maps/jool.webp", import.meta.url).href,
    laythe: new URL("./assets/maps/laythe.webp", import.meta.url).href,
    vall: new URL("./assets/maps/vall.webp", import.meta.url).href,
    tylo: new URL("./assets/maps/tylo.webp", import.meta.url).href,
    bop: new URL("./assets/maps/bop.webp", import.meta.url).href,
    pol: new URL("./assets/maps/pol.webp", import.meta.url).href,
    eeloo: new URL("./assets/maps/eeloo.webp", import.meta.url).href,
    "earth-night": new URL("./assets/maps/earth-night.webp", import.meta.url)
        .href,
    "earth-clouds": new URL("./assets/maps/earth-clouds.webp", import.meta.url)
        .href,
    "saturn-ring": new URL("./assets/maps/saturn-ring.webp", import.meta.url)
        .href,
};

/** Whether there's a map `id`. */
export const hasMap = (id: string): boolean => Object.hasOwn(MAPS, id);

/** The image of map `id`, or `null` when there's no such map. */
export const loadMapImage = (
    id: string,
    signal: AbortSignal,
): Promise<HTMLImageElement> | null => {
    const url = hasMap(id) ? MAPS[id] : undefined;
    if (url === undefined) return null;

    // `ImageLoader` can't be aborted, so a late image is dropped here.
    return new ImageLoader().loadAsync(url).then((image) => {
        signal.throwIfAborted();

        return image;
    });
};

/** Maps that hold data, not colour. */
const LINEAR = new Set(["earth-clouds"]);

/** The maps of the bodies that have one. */
export type Maps = {
    /** Fetches the map of a body once and hands it to `onLoad`. Ignores a body with no map. */
    load: (id: string, onLoad: (texture: Texture) => void) => void;
    /** Frees map `id`, so a body added later with the same preset loads it again. */
    release: (id: string) => void;
    /** Frees every loaded map, and any that arrives later. */
    dispose: () => void;
};

/** Maps that load on demand from `images`, with `anisotropy` set on each. `onChange` hears each start and settle. */
export const createMaps = (
    images: (id: string) => Promise<HTMLImageElement> | null,
    anisotropy: number,
    onChange?: (done: number, total: number) => void,
): Maps => {
    // The token of each id's current request, so a request that was released can tell it's stale.
    const started = new Map<string, number>();
    const loaded = new Map<string, Texture>();
    let disposed = false;
    let requests = 0;
    let settled = 0;

    const settle = () => {
        settled++;
        onChange?.(settled, requests);
    };

    return {
        load: (id, onLoad) => {
            if (started.has(id)) return;

            const pending = images(id);
            if (pending === null) return;

            const token = ++requests;
            started.set(id, token);
            onChange?.(settled, requests);
            pending.then(
                (image) => {
                    if (disposed) return;
                    if (started.get(id) !== token) {
                        settle();

                        return;
                    }

                    const texture = new Texture(image);
                    texture.colorSpace = LINEAR.has(id)
                        ? NoColorSpace
                        : SRGBColorSpace;
                    texture.anisotropy = anisotropy;
                    texture.needsUpdate = true;
                    loaded.set(id, texture);
                    onLoad(texture);
                    settle();
                },
                (error: unknown) => {
                    // The only report of a failed optional asset, and the project has no logger.
                    console.warn(`Couldn't load the map of ${id}.`, error);
                    settle();
                },
            );
        },
        release: (id) => {
            started.delete(id);
            loaded.get(id)?.dispose();
            loaded.delete(id);
        },
        dispose: () => {
            disposed = true;
            for (const texture of loaded.values()) texture.dispose();
            loaded.clear();
        },
    };
};
