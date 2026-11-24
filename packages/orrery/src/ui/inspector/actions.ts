import { removalNote } from "../../adding.ts";
import { cue } from "../../audio/cues.ts";
import type { World } from "../../world.ts";
import { h } from "../dom.ts";

const SVG = (body: string) =>
    `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${body}</svg>`;

export const FOCUS_ICON = SVG(
    '<g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="4"/><path d="M8 0.5V3.5M8 12.5V15.5M0.5 8H3.5M12.5 8H15.5"/></g>',
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

/** A button with an icon and a label in its own span, so changing the label keeps the icon. */
export const iconButton = (
    label: string,
    className: string,
    svg: string,
    onClick: () => void,
): HTMLButtonElement => {
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

/** The pinned footer of a card: Focus, Edit, Burn and Remove, with the Remove confirm. */
export const createActions = (
    { world, element, buttons: kept, syncFocus, openForm }: ActionsContext,
    id: string,
    name: string,
    hasParent: boolean,
    hasOrbit: boolean,
): HTMLElement => {
    const foot = h("div", { class: "orrery__inspector-foot" });
    const base = "orrery__foot-button";
    let confirming = false;

    const showRow = () => {
        confirming = false;
        foot.className = "orrery__inspector-foot";
        foot.removeAttribute("role");
        foot.removeAttribute("aria-labelledby");

        kept.focus = button("Focus", `${base} orrery__orbit-focus`, () =>
            world.focus(id),
        );
        syncFocus();
        foot.replaceChildren(kept.focus);
        kept.edit = null;
        kept.burn = null;
        if (hasOrbit) {
            kept.edit = button("Edit", base, () => openForm("edit"));
            kept.burn = button("Burn", base, () => openForm("burn"));
            foot.append(kept.edit, kept.burn);
        }
        if (hasParent) {
            foot.append(button("Remove", "orrery__foot-remove", showConfirm));
        }
    };

    const back = () => {
        showRow();
        foot.querySelector<HTMLElement>(".orrery__foot-remove")?.focus();
    };

    const showConfirm = () => {
        const note = removalNote(world.scenario, id);
        const cancel = button("Cancel", base, back);
        const remove = button(
            "Remove",
            `${base} orrery__foot-button--danger`,
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
        const question = h(
            "div",
            { class: "orrery__foot-question" },
            h(
                "p",
                {
                    class: "orrery__foot-question-title",
                    id: "orrery-orbit-confirm-title",
                },
                `Remove ${name}?`,
            ),
            ...(note
                ? [h("p", { class: "orrery__foot-question-note" }, note)]
                : []),
        );
        confirming = true;
        foot.className =
            "orrery__inspector-foot orrery__inspector-foot--confirm";
        foot.setAttribute("role", "group");
        foot.setAttribute("aria-labelledby", "orrery-orbit-confirm-title");
        kept.focus = null;
        foot.replaceChildren(question, cancel, remove);
        cancel.focus();
    };

    foot.addEventListener("keydown", (event) => {
        if (!confirming || event.key !== "Escape") return;

        // The shortcut that clears the selection skips a handled key.
        event.preventDefault();
        event.stopPropagation();
        back();
    });
    showRow();

    return foot;
};
