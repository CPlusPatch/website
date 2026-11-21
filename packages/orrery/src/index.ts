/**
 * @module
 * The Orrery, an interactive model of the solar system drawn with three.js.
 */

import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { h } from "./ui/dom.ts";
import { createView } from "./view/scene.ts";

/** A mounted Orrery. */
export type Orrery = { destroy: () => void };

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

    const view = createView(container);
    if (!view) {
        const alert = webglAlert();
        container.append(alert);
        return { destroy: () => alert.remove() };
    }

    const panels = root.querySelectorAll<HTMLElement>(".orrery__panel");
    for (const panel of panels) panel.hidden = false;

    return {
        destroy: () => {
            view.destroy();
            for (const panel of panels) panel.hidden = true;
        },
    };
};
