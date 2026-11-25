import type { Presets } from "@cpluspatch/sim";
import { IAU_ROTATIONS } from "./iau.ts";
import { KERBOL_ROTATIONS } from "./kerbol.ts";

export { KERBOL_LOCKED } from "./kerbol.ts";

/** The preset of each model that has a rotation: the solar system bodies and the Kerbol bodies. */
export const PRESETS: Presets = Object.fromEntries(
    Object.entries({ ...IAU_ROTATIONS, ...KERBOL_ROTATIONS }).map(
        ([id, rotation]) => [id, { rotation }],
    ),
);
