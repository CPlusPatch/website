/**
 * @module
 * What the satellite snapshot holds. Written by `scripts/build-satellites.ts`: don't edit by hand.
 */

import type { OrbitClass, SatelliteGroup } from "@cpluspatch/sim";

/** The satellites in each group of `assets/satellites.bin`, by orbit class. */
export const GROUP_CLASSES: Record<
    SatelliteGroup,
    Record<OrbitClass, number>
> = {
    starlink: { leo: 11199, meo: 0, geo: 0, heo: 0 },
    oneweb: { leo: 651, meo: 0, geo: 0, heo: 0 },
    kuiper: { leo: 391, meo: 0, geo: 0, heo: 0 },
    "guowang-qianfan": { leo: 536, meo: 0, geo: 0, heo: 0 },
    "phone-iot": { leo: 301, meo: 0, geo: 0, heo: 0 },
    navigation: { leo: 0, meo: 126, geo: 24, heo: 0 },
    imaging: { leo: 629, meo: 2, geo: 4, heo: 0 },
    weather: { leo: 20, meo: 0, geo: 25, heo: 0 },
    other: { leo: 2376, meo: 51, geo: 520, heo: 42 },
};

/** The day the snapshot was fetched from CelesTrak. */
export const SNAPSHOT_DATE = "23 Nov 2026";

/** The latest element epoch in unix ms, which the ±1 year window is measured from. */
export const SNAPSHOT_EPOCH = 1795557541434;
