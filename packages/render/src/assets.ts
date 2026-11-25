/**
 * @module
 * The sky, the maps and the satellites, fetched and decoded once per page.
 */

import {
    type Catalogue,
    type Gravity,
    prepareSwarm,
    type Rotation,
    type Swarm,
} from "@cpluspatch/sim";
import { loadMapImage } from "./maps.ts";
import { fetchSky, type SkyData } from "./sky.ts";
import { fetchCatalogue } from "./swarm.ts";

/** Decoded assets shared by every view of a page, so a rebuilt view doesn't fetch them again. */
export type Assets = {
    /** The stars and the Milky Way image. `onProgress` is only heard by the call that starts the fetch. */
    sky: (onProgress?: (fraction: number) => void) => Promise<SkyData>;
    /** The image of map `id`, or null when there's no such map. */
    map: (id: string) => Promise<HTMLImageElement> | null;
    /** The prepared satellite swarm for `host`, the body it orbits. The file is fetched and decoded once. */
    swarm: (host: SwarmHost) => Promise<Swarm>;
    /** Aborts the fetches in flight. */
    dispose: () => void;
};

/** The body a swarm orbits: its gravitational parameter, radius and spin, which set the orbit classes, and its gravity field if known. */
export type SwarmHost = {
    mu: number;
    radius: number;
    rotation?: Rotation | undefined;
    gravity?: Gravity | undefined;
};

/** The functions that fetch and decode each asset, so a test can replace them. */
export type Loaders = {
    sky: typeof fetchSky;
    map: typeof loadMapImage;
    catalogue: typeof fetchCatalogue;
    prepare: (catalogue: Catalogue, host: SwarmHost) => Swarm;
};

const defaultLoaders: Loaders = {
    sky: fetchSky,
    map: loadMapImage,
    catalogue: fetchCatalogue,
    prepare: prepareSwarm,
};

/** The promise cached under `key`, or the one `make` starts. A rejection leaves the cache, so the next call retries. */
const once = <K, V>(
    cache: Map<K, Promise<V>>,
    key: K,
    make: () => Promise<V>,
): Promise<V> => {
    const cached = cache.get(key);
    if (cached) return cached;

    const promise = make();
    cache.set(key, promise);
    promise.catch(() => {
        if (cache.get(key) === promise) cache.delete(key);
    });

    return promise;
};

/** Assets that load on first use. `satellitesUrl` is the satellite file, which the caller owns. */
export const createAssets = (
    satellitesUrl: URL,
    loaders: Loaders = defaultLoaders,
): Assets => {
    const loading = new AbortController();
    const sky = new Map<"sky", Promise<SkyData>>();
    const maps = new Map<string, Promise<HTMLImageElement>>();
    const catalogue = new Map<"catalogue", Promise<Catalogue>>();
    const swarms = new Map<string, Promise<Swarm>>();

    return {
        sky: (onProgress) =>
            once(sky, "sky", () => loaders.sky(loading.signal, onProgress)),
        map: (id) => {
            const cached = maps.get(id);
            if (cached) return cached;

            const promise = loaders.map(id, loading.signal);
            if (promise === null) return null;

            return once(maps, id, () => promise);
        },
        swarm: (host) =>
            once(
                swarms,
                JSON.stringify([
                    host.mu,
                    host.radius,
                    host.rotation,
                    host.gravity,
                ]),
                async () =>
                    loaders.prepare(
                        await once(catalogue, "catalogue", () =>
                            loaders.catalogue(satellitesUrl, loading.signal),
                        ),
                        host,
                    ),
            ),
        dispose: () => loading.abort(),
    };
};
