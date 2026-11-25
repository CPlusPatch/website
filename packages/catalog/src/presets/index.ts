import type { Presets } from "@cpluspatch/sim";
import { APPEARANCE } from "./appearance.ts";
import { GRAVITY } from "./gravity.ts";
import { IAU_ROTATIONS } from "./iau.ts";
import { KERBOL_ROTATIONS } from "./kerbol.ts";

export { KERBOL_LOCKED } from "./kerbol.ts";

const ROTATIONS = { ...IAU_ROTATIONS, ...KERBOL_ROTATIONS };

const IDS = new Set([
    ...Object.keys(ROTATIONS),
    ...Object.keys(GRAVITY),
    ...Object.keys(APPEARANCE),
]);

/** The preset of each model that has a rotation, gravity or appearance: the solar system and Kerbol bodies. */
export const PRESETS: Presets = Object.fromEntries(
    [...IDS].map((id) => [
        id,
        {
            ...(ROTATIONS[id] ? { rotation: ROTATIONS[id] } : {}),
            ...(GRAVITY[id] ? { gravity: GRAVITY[id] } : {}),
            ...(APPEARANCE[id] ? { appearance: APPEARANCE[id] } : {}),
        },
    ]),
);
