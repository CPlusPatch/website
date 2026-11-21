/**
 * @module
 * The Orrery, an interactive model of the solar system drawn with three.js.
 */

import { solarSystem, unixMsToJ2000s } from "@cpluspatch/orbit";
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";
import { Clock, DEFAULT_RATE } from "./clock.ts";
import { createBodyList } from "./ui/body-list.ts";
import { h } from "./ui/dom.ts";
import { createInspector } from "./ui/inspector.ts";
import { bindShortcuts } from "./ui/shortcuts.ts";
import { createTimeBar } from "./ui/time-bar.ts";
import { createView } from "./view/scene.ts";
import { World } from "./world.ts";

/** A mounted Orrery. */
export type Orrery = {
    /** Centres the view on a body. */
    focus: (id: string) => void;
    /** Selects a body, or clears the selection with `null`. */
    select: (id: string | null) => void;
    destroy: () => void;
};

const webglAlert = (): HTMLElement =>
    h(
        "div",
        {
            class: alertClasses({ variant: "warning" }).join(" "),
            role: "status",
        },
        h(
            "div",
            { class: "content" },
            h(
                "span",
                { class: "visually-hidden" },
                alertPrefix("warning") ?? "",
            ),
            " WebGL isn't available, so the model can't be drawn.",
        ),
    );

/** Draws the Orrery into the `.orrery` root of `src/pages/orbits.astro`. */
export const mount = (root: HTMLElement): Orrery => {
    const container = root.querySelector<HTMLElement>(".orrery__canvas");
    if (!container) throw new Error("The Orrery needs a .orrery__canvas.");

    const clock = new Clock(
        unixMsToJ2000s(Date.now()),
        DEFAULT_RATE,
        reducedMotion(),
    );
    const world = new World(solarSystem, clock);

    const view = createView(container, world);
    if (!view) {
        const alert = webglAlert();
        container.append(alert);
        return {
            focus: () => {},
            select: () => {},
            destroy: () => alert.remove(),
        };
    }

    const panels = root.querySelectorAll<HTMLElement>(".orrery__panel");
    for (const panel of panels) panel.hidden = false;

    const timeBar = createTimeBar(world);
    root.querySelector(".orrery__panel--bottom")?.append(timeBar.element);
    const bodyList = createBodyList(world);
    root.querySelector(".orrery__panel--left")?.append(bodyList.element);
    const inspector = createInspector(
        world,
        (id) => bodyList.focusRow(id),
        view.ghost,
    );
    root.querySelector(".orrery__panel--right")?.append(inspector.element);
    const unbind = bindShortcuts(world);

    return {
        focus: (id) => world.focus(id),
        select: (id) => world.select(id),
        destroy: () => {
            unbind();
            timeBar.destroy();
            bodyList.destroy();
            inspector.destroy();
            view.destroy();
            for (const panel of panels) panel.hidden = true;
        },
    };
};
