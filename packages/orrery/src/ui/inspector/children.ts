import { h } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import type { World } from "../../world.ts";
import { showBodyMarker } from "../body-marker.ts";
import { button } from "./actions.ts";

/** The children section and how to stop its resize observer. */
export type ChildrenSection = {
    element: HTMLElement;
    destroy: () => void;
};

/**
 * The "Around" section: one row of chips for the bodies orbiting `centre`, with a "+N more" toggle
 * for the ones that don't fit. Null if there are none.
 */
export const createChildrenSection = (
    world: World,
    centre: Body,
): ChildrenSection | null => {
    const children = world.scenario.bodies.filter(
        (candidate) => candidate.parent === centre.id,
    );
    if (children.length === 0) return null;

    let expanded = false;

    const items = children.map((child) => {
        const chip = button(child.name, "orrery__orbit-chip", () =>
            world.select(child.id),
        );
        const icon = h("span", { class: "orrery__orbit-chip-marker" });
        showBodyMarker(icon, child, centre);
        chip.prepend(icon);

        return h("li", {}, chip);
    });

    // One button for good, so focus stays on it when it toggles.
    const toggle = button(
        "",
        "orrery__orbit-chip orrery__orbit-chip--more",
        () => {
            expanded = !expanded;
            update();
        },
    );
    const toggleItem = h("li", {}, toggle);
    const list = h(
        "ul",
        { class: "orrery__orbit-chips" },
        ...items,
        toggleItem,
    );

    // Hides chips from the end until the row and "+N more" fit.
    const fit = () => {
        if (list.clientWidth === 0) return;

        const focused = list.contains(document.activeElement)
            ? document.activeElement
            : null;
        for (const item of items) item.hidden = false;
        toggleItem.hidden = true;
        // One child has nothing to fold away, so it stays clipped.
        if (list.scrollWidth > list.clientWidth && items.length > 1) {
            toggleItem.hidden = false;
            for (let shown = items.length - 1; shown >= 1; shown--) {
                for (const [index, item] of items.entries()) {
                    item.hidden = index >= shown;
                }
                toggle.textContent = `+${items.length - shown} more`;
                if (list.scrollWidth <= list.clientWidth) break;
            }
        }

        // The fit can hide the chip or toggle that had focus.
        if (focused?.closest("li")?.hidden) {
            (toggleItem.hidden
                ? items[0]?.querySelector("button")
                : toggle
            )?.focus();
        }
    };

    const update = () => {
        list.toggleAttribute("data-expanded", expanded);
        toggle.setAttribute("aria-expanded", String(expanded));
        if (expanded) {
            for (const item of items) item.hidden = false;
            toggleItem.hidden = false;
            toggle.textContent = "Show fewer";
        } else {
            fit();
        }
    };
    update();

    // Fitting changes what overflows, not the row's width, so only a new width refits.
    let width = list.clientWidth;
    const observer = new ResizeObserver(() => {
        if (list.clientWidth === width) return;

        width = list.clientWidth;
        if (!expanded) fit();
    });
    observer.observe(list);
    // A web font that loads late widens the chips but not the row.
    let destroyed = false;
    document.fonts.ready.then(() => {
        if (!destroyed && !expanded) fit();
    });

    return {
        element: h(
            "section",
            { class: "orrery__orbit-around" },
            h("h3", {}, `Around ${centre.name}`),
            list,
        ),
        destroy: () => {
            destroyed = true;
            observer.disconnect();
        },
    };
};
