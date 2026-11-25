import { EARTH_RADIUS, km } from "@cpluspatch/orbit";
import type { Gravity } from "@cpluspatch/sim";

/** The oblateness of the bodies that have satellites with J2 precession. The Sun's is ignored. */
export const GRAVITY: Record<string, Gravity> = {
    // WGS 84 / EGM2008.
    earth: { j2: 1.08262668e-3, radius: EARTH_RADIUS },
    // MRO gravity model (MRO120), unnormalised -C20.
    mars: { j2: 1.9566e-3, radius: km(3396) },
    // GRAIL, GL0660B.
    moon: { j2: 2.033e-4, radius: km(1738) },
    // Juno, Iess et al. 2018.
    jupiter: { j2: 1.4696e-2, radius: km(71492) },
};
