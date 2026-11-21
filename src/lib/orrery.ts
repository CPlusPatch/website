/* Lazy, so three.js stays off the critical path. */

import type { Orrery } from "@cpluspatch/orrery";

let orrery: Promise<Orrery> | undefined;

/** The Orrery in `root`, mounted the first time it's asked for. */
export const loadOrrery = (root: HTMLElement): Promise<Orrery> =>
    (orrery ??= import("@cpluspatch/orrery").then(({ mount }) => mount(root)));
