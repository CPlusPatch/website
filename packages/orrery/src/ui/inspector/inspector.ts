import type { BodyKind } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import type { EditScene } from "../../editing.ts";
import { readouts } from "../../readouts.ts";
import type { Units } from "../../units.ts";
import type { World } from "../../world.ts";
import { type BodyAdder, createBodyAdder } from "../body-adder.ts";
import { showBodyMarker } from "../body-marker.ts";
import { type BurnEditor, createBurnEditor } from "../burn-editor.ts";
import { h, setText } from "../dom.ts";
import { createElementEditor, type ElementEditor } from "../element-editor.ts";
import { sheetAfterDrag } from "../sheet.ts";
import { type ActionButtons, button, createActions } from "./actions.ts";
import {
    createReadoutRows,
    type ReadoutRows,
    refreshReadoutRows,
} from "./readouts.ts";

/** The inspector's element and how to remove it. */
export type Inspector = {
    element: HTMLElement;
    /** Shows the Add body form, with `name` in its Name field if one is given. */
    openAdd: (name?: string) => void;
    destroy: () => void;
};

/** What the card shows: the readouts, or a form that replaces them. */
type Mode = "card" | "edit" | "burn" | "add";

/** How often the readouts refresh while the clock runs, in ms. */
const REFRESH_MS = 250;

const KINDS: Record<BodyKind, string> = {
    star: "Star",
    planet: "Planet",
    dwarf: "Dwarf planet",
    moon: "Moon",
    spacecraft: "Spacecraft",
};

/** A card with the selected body's name, kind and live orbit readouts. */
export const createInspector = (
    world: World,
    units: Units,
    /** Takes keyboard focus when the inspector hides while it holds it. */
    restoreFocus: (id: string) => void,
    /** What the editors draw in the scene. */
    scene: EditScene,
): Inspector => {
    const close = h("button", {
        type: "button",
        class: buttonClasses({
            variant: "ghost",
            tone: "neutral",
            size: "icon-sm",
        }).join(" "),
        "aria-label": "Clear selection",
    });
    close.innerHTML = iconSvg("x");
    close.addEventListener("click", () => {
        if (mode === "add") cancelAdd();
        else world.select(null);
    });
    // The form's Esc doesn't reach the head, and the shortcuts would clear the selection instead.
    close.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || mode !== "add") return;

        event.preventDefault();
        cancelAdd();
    });

    const marker = h("span", { class: "orrery__orbit-marker" });
    const title = h("h2", { id: "orrery-orbit-title" });
    const head = h(
        "div",
        { class: "orrery__inspector-head" },
        marker,
        title,
        close,
    );
    // Scrolls under the head, as a scrolling card left a blank band in Chromium's canvas.
    const content = h("div", { class: "orrery__inspector-body" });
    const element = h(
        "section",
        {
            class: `${cardClasses().join(" ")} orrery__inspector`,
            "aria-label": "Selected body",
        },
        head,
        content,
    );
    element.hidden = true;

    // On a phone the card is a sheet. It starts peeked and keeps its state across bodies.
    let open = false;
    let pressedAt: number | null = null;
    const grip = h("button", {
        type: "button",
        class: "orrery__orbit-grip",
        "aria-label": "All readouts",
        "aria-expanded": "false",
    });
    element.prepend(grip);

    const setSheet = (next: boolean) => {
        open = next;
        element.toggleAttribute("data-peek", !open && mode === "card");
        grip.setAttribute("aria-expanded", String(open));

        // The actions are about to be hidden, which would drop the focus.
        const held = document.activeElement?.closest(
            ".orrery__orbit-meta, .orrery__orbit-actions",
        );
        if (!open && held && element.contains(held)) grip.focus();
    };
    grip.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !event.isPrimary) return;

        pressedAt = event.clientY;
        grip.setPointerCapture(event.pointerId);
    });
    grip.addEventListener("pointerup", (event) => {
        if (pressedAt === null) return;

        const dy = event.clientY - pressedAt;
        pressedAt = null;
        setSheet(sheetAfterDrag(dy, open));
    });
    grip.addEventListener("pointercancel", () => {
        pressedAt = null;
    });
    // A pointer tap is handled on pointerup, so only a keyboard click gets here.
    grip.addEventListener("click", (event) => {
        if (event.detail === 0) setSheet(!open);
    });

    // Only the card shows the body's name big, with a rule under it.
    const setHead = (small: boolean) => {
        title.className = small ? "orrery__panel-title" : "orrery__orbit-title";
        head.classList.toggle("orrery__inspector-head--panel", small);
    };
    setHead(false);

    let rows: ReadoutRows | null = null;
    let shown: string | null = null;
    let mode: Mode = "card";
    let editor: ElementEditor | null = null;
    let burn: BurnEditor | null = null;
    let adder: BodyAdder | null = null;
    const buttons: ActionButtons = { focus: null, edit: null, burn: null };

    const syncFocus = () => {
        if (!buttons.focus) return;

        const on = world.focused === shown;
        buttons.focus.setAttribute("aria-pressed", String(on));
        const label = buttons.focus.querySelector(
            ".orrery__orbit-button-label",
        );
        if (label) setText(label, on ? "Focused" : "Focus");
    };

    const refresh = () => {
        burn?.refresh();

        const id = world.selected;
        if (!id || !rows) return;

        const current = readouts(
            world.scenario,
            id,
            world.states(),
            world.clock.t,
        );
        if (!current) return;

        refreshReadoutRows(rows, current, units.get());
    };

    // The card re-renders, so what had focus moves to the first thing a reader can pick next.
    const focusFirst = () => {
        const next =
            element.querySelector<HTMLElement>(".orrery__orbit-chip") ??
            element.querySelector<HTMLElement>(".orrery__orbit-link");
        (next ?? close).focus();
    };

    let addName = "";

    // Back to the card, or nothing, with the focus on the search button.
    const cancelAdd = () => {
        mode = "card";
        render();
        restoreFocus(world.selected ?? world.focused);
    };

    const openAdd = (name = "") => {
        if (mode === "add" && adder) {
            if (name !== "") adder.setName(name);
            adder.focus();

            return;
        }

        addName = name;
        mode = "add";
        render();
        adder?.focus();
    };

    // Back to the card, with focus on the button that opened the form.
    const closeForm = (opener: "edit" | "burn") => {
        mode = "card";
        render();
        (opener === "edit" ? buttons.edit : buttons.burn)?.focus();
    };

    const openForm = (next: "edit" | "burn") => {
        mode = next;
        render();
        // The Burn step radios are visually hidden, so the first visible field gets the focus.
        content
            .querySelector<HTMLElement>("input:not(.visually-hidden)")
            ?.focus();
    };

    const around = (id: string, name: string): HTMLElement | null => {
        const children = world.scenario.bodies.filter(
            (candidate) => candidate.parent === id,
        );
        if (children.length === 0) return null;

        return h(
            "section",
            { class: "orrery__orbit-around" },
            h("h3", {}, `Around ${name}`),
            h(
                "ul",
                {},
                ...children.map((child) => {
                    const chip = button(child.name, "orrery__orbit-chip", () =>
                        world.select(child.id),
                    );
                    const icon = h("span", {
                        class: "orrery__orbit-chip-marker",
                    });
                    showBodyMarker(icon, child);
                    chip.prepend(icon);

                    return h("li", {}, chip);
                }),
            ),
        );
    };

    const render = () => {
        const id = world.selected;
        const body = world.scenario.bodies.find((b) => b.id === id);
        const adding = mode === "add";
        const hadFocus = element.contains(document.activeElement);
        // Hiding the focused close button would drop focus to <body>.
        if (!body && !adding && shown && hadFocus) restoreFocus(shown);
        shown = body?.id ?? null;
        element.hidden = !body && !adding;
        marker.hidden = adding;
        close.setAttribute("aria-label", adding ? "Cancel" : "Clear selection");
        element.setAttribute(
            "aria-label",
            adding ? "Add a body" : "Selected body",
        );
        rows = null;
        buttons.focus = null;
        content.replaceChildren();
        editor?.destroy();
        editor = null;
        burn?.destroy();
        burn = null;
        adder?.destroy();
        adder = null;
        // The forms need the room, so they never peek.
        grip.hidden = adding;
        if (adding) {
            element.removeAttribute("data-peek");
            setHead(true);
            title.textContent = "Add a body";
            adder = createBodyAdder(world, units, addName, cancelAdd);
            content.append(adder.element);

            return;
        }
        if (!body) return;

        const parent = world.scenario.bodies.find(
            (candidate) => candidate.id === body.parent,
        );
        const hasOrbit = parent !== undefined && body.elements !== undefined;

        let form: HTMLFormElement | null = null;
        if (mode === "edit") {
            editor = createElementEditor(world, units, body.id, scene, () =>
                closeForm("edit"),
            );
            form = editor?.element ?? null;
        } else if (mode === "burn") {
            burn = createBurnEditor(world, units, body.id, scene.ghost, () =>
                closeForm("burn"),
            );
            form = burn?.element ?? null;
        }
        if (!form) mode = "card";

        showBodyMarker(marker, body);
        marker.hidden = mode !== "card";
        setHead(mode !== "card");
        grip.hidden = mode !== "card";
        element.toggleAttribute("data-peek", !open && mode === "card");
        title.textContent =
            mode === "card"
                ? body.name
                : `${mode === "edit" ? "Edit" : "Burn"} ${body.name}`;

        const link = parent
            ? button(parent.name, "orrery__orbit-link", () =>
                  world.select(parent.id),
              )
            : null;
        content.append(
            h(
                "p",
                { class: "orrery__orbit-meta" },
                `${KINDS[body.kind]} `,
                ...(link ? ["around ", link] : ["at the centre"]),
            ),
        );
        if (form) {
            content.append(form);
            return;
        }

        // A body with no parent has no orbit to read.
        if (parent) {
            rows = createReadoutRows(parent.name, units);
            content.append(...rows.elements);
        }

        const chips = parent ? around(body.id, body.name) : null;
        if (chips) content.append(chips);
        content.append(
            createActions(
                { world, element, buttons, syncFocus, openForm },
                body.id,
                body.name,
                parent !== undefined,
                hasOrbit,
            ),
        );
        refresh();

        // Focus was on something this render replaced.
        if (hadFocus && !element.contains(document.activeElement)) {
            focusFirst();
        }
    };
    render();

    const offUnits = units.subscribe(refresh);
    const off = world.on((event) => {
        if (event.type === "selection") {
            mode = "card";
            render();
        } else if (event.type === "scenario") {
            const gone = !world.scenario.bodies.some(
                (candidate) => candidate.id === world.selected,
            );
            // Add and remove elsewhere change the "Around" chips, but must not wipe a draft.
            if (mode === "card" || gone) {
                mode = "card";
                render();
            }
        } else if (event.type === "focus") syncFocus();
        else if (event.type === "clock") refresh();
        else if (event.type === "body" && event.id === world.selected)
            refresh();
    });
    const interval = setInterval(refresh, REFRESH_MS);

    return {
        element,
        openAdd,
        destroy: () => {
            off();
            offUnits();
            clearInterval(interval);
            editor?.destroy();
            burn?.destroy();
            adder?.destroy();
            element.remove();
        },
    };
};
