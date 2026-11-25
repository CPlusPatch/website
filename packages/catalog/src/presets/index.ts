import type { Presets } from "@cpluspatch/sim";
import { GRAVITY } from "./gravity.ts";
import { IAU_ROTATIONS } from "./iau.ts";
import { KERBOL_ROTATIONS } from "./kerbol.ts";

export { KERBOL_LOCKED } from "./kerbol.ts";

const ROTATIONS = { ...IAU_ROTATIONS, ...KERBOL_ROTATIONS };

/** The preset of each model that has a rotation: the solar system bodies and the Kerbol bodies, with gravity where known. */
export const PRESETS: Presets = Object.fromEntries(
    Object.entries(ROTATIONS).map(([id, rotation]) => [
        id,
        { rotation, ...(GRAVITY[id] ? { gravity: GRAVITY[id] } : {}) },
    ]),
);
