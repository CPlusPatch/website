import { removalNote } from "../../adding.ts";
import { cue } from "../../audio/cues.ts";
import type { World } from "../../world.ts";
import { h } from "../dom.ts";

const SVG = (body: string) =>
    `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${body}</svg>`;

const FOCUS_ICON = SVG(
    '<g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="4"/><path d="M8 0.5V3.5M8 12.5V15.5M0.5 8H3.5M12.5 8H15.5"/></g>',
);
const EDIT_ICON = SVG(
    '<path d="M10.5 2.5l3 3-8 8H2.5v-3z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
);
const BURN_ICON = SVG(
    '<path d="M8 13V3M4 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
);

/** A button with `label` that calls `onClick`. */
export const button = (
    label: string,
    className: string,
    onClick: () => void,
): HTMLButtonElement => {
    const control = h("button", { type: "button", class: className }, label);
    control.addEventListener("click", onClick);

    return control;
};

// The label is its own span, so changing it leaves the icon alone.
const iconButton = (
    label: string,
    className: string,
    svg: string,
    onClick: () => void,
) => {
    const control = button("", className, onClick);
    control.innerHTML = svg;
    control.append(h("span", { class: "orrery__orbit-button-label" }, label));

    return control;
};

/** The card's action buttons, or none while a confirm or a form replaces them. */
export type ActionButtons = {
    focus: HTMLButtonElement | null;
    edit: HTMLButtonElement | null;
    burn: HTMLButtonElement | null;
};

/** What the actions row needs from the inspector. */
export type ActionsContext = {
    world: World;
    element: HTMLElement;
    /** Where the row keeps its buttons, so the inspector can focus and label them. */
    buttons: ActionButtons;
    syncFocus: () => void;
    openForm: (mode: "edit" | "burn") => void;
};

/** The row of Focus, Edit, Burn and Remove for a body, with the Remove confirm. */
export const createActions = (
    { world, element, buttons: kept, syncFocus, openForm }: ActionsContext,
    id: string,
    name: string,
    hasParent: boolean,
    hasOrbit: boolean,
): HTMLElement => {
    const row = h("div", { class: "orrery__orbit-actions" });
    // Remove goes under this row, so the three buttons keep the card's width.
    const buttons = h("div", { class: "orrery__orbit-buttons" });
    const base = "orrery__orbit-button";

    const showRow = () => {
        kept.focus = iconButton(
            "Focus",
            `${base} orrery__orbit-focus`,
            FOCUS_ICON,
            () => world.focus(id),
        );
        syncFocus();
        buttons.replaceChildren(kept.focus);
        row.replaceChildren(buttons);
        kept.edit = null;
        kept.burn = null;
        if (hasOrbit) {
            kept.edit = iconButton("Edit", base, EDIT_ICON, () =>
                openForm("edit"),
            );
            kept.burn = iconButton("Burn", base, BURN_ICON, () =>
                openForm("burn"),
            );
            buttons.append(kept.edit, kept.burn);
        }
        if (hasParent) {
            row.append(button("Remove", "orrery__orbit-quiet", showConfirm));
        }
    };

    const back = () => {
        showRow();
        row.querySelector<HTMLElement>(".orrery__orbit-quiet")?.focus();
    };

    const showConfirm = () => {
        const note = removalNote(world.scenario, id);
        const cancel = button("Cancel", base, back);
        const remove = button(
            "Remove",
            `${base} orrery__orbit-button--danger`,
            () => {
                const root = element.closest<HTMLElement>(".orrery");
                const parent = world.scenario.bodies.find(
                    (candidate) => candidate.id === id,
                )?.parent;

                cue("remove");
                // The parent stays selected, so its card is the one that replaces this.
                if (parent) world.select(parent);
                world.removeBody(id);
                // This card is gone, so the new one takes focus.
                root?.querySelector<HTMLElement>(
                    ".orrery__orbit-focus",
                )?.focus();
            },
        );
        const group = h(
            "div",
            {
                class: "orrery__orbit-confirm",
                role: "group",
                "aria-labelledby": "orrery-orbit-confirm-title",
            },
            h(
                "p",
                {
                    class: "orrery__orbit-confirm-title",
                    id: "orrery-orbit-confirm-title",
                },
                `Remove ${name}?`,
            ),
            ...(note
                ? [h("p", { class: "orrery__orbit-confirm-note" }, note)]
                : []),
            h("div", { class: "orrery__orbit-row" }, cancel, remove),
        );
        group.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;

            // The shortcut that clears the selection skips a handled key.
            event.preventDefault();
            event.stopPropagation();
            back();
        });
        kept.focus = null;
        row.replaceChildren(group);
        cancel.focus();
    };

    showRow();

    return row;
};
