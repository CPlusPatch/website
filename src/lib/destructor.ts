/*
 * The page's one physics simulation, shared by the gravity gun
 * (components/blocks/destructor.astro) and the terminal's `lego` command, so
 * both throw things into the same world. Browser only.
 */

import type { Destructor } from "@cpluspatch/destructor";

let simulation: Promise<Destructor> | undefined;
let running = false;

/** Whether the simulation exists yet, rather than still loading or not asked for. */
export const isDestructorRunning = (): boolean => running;

/**
 * The simulation, started the first time it's asked for. It gets the page's
 * gravity gun, if it has one, and lands things on that block's ground.
 */
export const loadDestructor = (): Promise<Destructor> =>
    (simulation ??= import("@cpluspatch/destructor").then(({ Destructor }) => {
        const root = document.querySelector<HTMLElement>(".destructor");
        const trigger = root?.querySelector<HTMLElement>(
            ".destructor__trigger",
        );
        const ground = root?.dataset.ground
            ? document.querySelector(root.dataset.ground)
            : null;
        const created = new Destructor({ trigger, ground });
        running = true;
        return created;
    }));
