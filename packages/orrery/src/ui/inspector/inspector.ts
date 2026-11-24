import {
    apoapsis,
    elementsAt,
    periapsis,
    trueAnomalyAt,
} from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { bodyStats } from "../../body-stats.ts";
import type { EditScene } from "../../editing.ts";
import { readouts } from "../../readouts.ts";
import type { Units } from "../../units.ts";
import { colorOf } from "../../view/theme.ts";
import type { World } from "../../world.ts";
import { type BodyAdder, createBodyAdder } from "../body-adder.ts";
import { showBodyMarker } from "../body-marker.ts";
import { type BurnEditor, createBurnEditor } from "../burn-editor.ts";
import { h, setText } from "../dom.ts";
import { createElementEditor, type ElementEditor } from "../element-editor.ts";
import { KIND_LABELS } from "../labels.ts";
import { sheetAfterDrag } from "../sheet.ts";
import { type ActionButtons, button, createActions } from "./actions.ts";
import { type ChildrenSection, createChildrenSection } from "./children.ts";
import { createPlate, type Plate, refreshPlate } from "./plate.ts";
import { createHeadline, type Headline, refreshHeadline } from "./readouts.ts";
import { createStatsSection } from "./stats.ts";

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
    const titleText = h("span");
    const title = h("h2", { id: "orrery-orbit-title" }, marker, titleText);
    // Under the title, so the form heads keep the kind and parent in view too.
    const meta = h("p", { class: "orrery__orbit-meta" });
    const head = h(
        "div",
        { class: "orrery__inspector-head" },
        h("div", { class: "orrery__inspector-titles" }, title, meta),
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
            ".orrery__orbit-meta, .orrery__inspector-body, .orrery__inspector-foot",
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
        title.className = small
            ? "orrery__panel-title"
            : "orrery__inspector-title";
        head.classList.toggle("orrery__inspector-head--panel", small);
        head.classList.toggle("orrery__inspector-head--ruled", !small);
    };
    setHead(false);

    let headline: Headline | null = null;
    let plate: Plate | null = null;
    let foot: HTMLElement | null = null;
    let stats: HTMLElement | null = null;
    let children: ChildrenSection | null = null;
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
        setText(buttons.focus, on ? "Focused" : "Focus");
    };

    const refresh = () => {
        burn?.refresh();

        const id = world.selected;
        if (!id) return;

        const current = readouts(
            world.scenario,
            id,
            world.states(),
            world.clock.t,
        );
        if (headline && current)
            refreshHeadline(headline, current, units.get());

        const body = world.scenario.bodies.find((b) => b.id === id);
        const parent = world.scenario.bodies.find((b) => b.id === body?.parent);
        if (!plate || !body?.elements || !parent) return;

        const grandparent = world.scenario.bodies.find(
            (b) => b.id === parent.parent,
        );
        const drawn = {
            parentRadius: parent.radius,
            bodyColor: colorOf(body, parent),
            parentColor: colorOf(parent, grandparent),
            unit: units.get(),
        };

        // The edit form draws its draft, without the times, as they'd be of the saved orbit.
        if (editor) {
            const draft = editor.elements();
            refreshPlate(plate, {
                a: draft.a,
                e: draft.e,
                raan: draft.raan,
                argp: draft.argp,
                trueAnomaly: trueAnomalyAt(draft, editor.mu, world.clock.t),
                periapsisAltitude: periapsis(draft) - parent.radius,
                apoapsisAltitude: apoapsis(draft) - parent.radius,
                ...drawn,
            });

            return;
        }
        if (!current) return;

        // Precession turns the node and the periapsis.
        const now = elementsAt(
            { ...body, elements: body.elements },
            world.clock.t,
        );
        refreshPlate(plate, {
            a: now.a,
            e: now.e,
            raan: now.raan,
            argp: now.argp,
            trueAnomaly: current.trueAnomaly,
            periapsisAltitude: current.periapsisAltitude,
            apoapsisAltitude: current.apoapsisAltitude,
            timeToPeriapsis: current.timeToPeriapsis,
            timeToApoapsis: current.timeToApoapsis,
            ...drawn,
        });
    };

    // The card re-renders, so what had focus moves to the first thing a reader can pick next.
    const focusFirst = () => {
        const next =
            element.querySelector<HTMLElement>(
                "li:not([hidden]) > .orrery__orbit-chip",
            ) ?? element.querySelector<HTMLElement>(".orrery__orbit-link");
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
        headline?.element.remove();
        headline = null;
        plate?.element.remove();
        plate = null;
        foot?.remove();
        foot = null;
        stats = null;
        children?.destroy();
        children = null;
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
            meta.hidden = true;
            titleText.textContent = "Add a body";
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
            editor = createElementEditor(
                world,
                units,
                body.id,
                scene,
                () => closeForm("edit"),
                refresh,
            );
            form = editor?.element ?? null;
        } else if (mode === "burn") {
            burn = createBurnEditor(world, units, body.id, scene.ghost, () =>
                closeForm("burn"),
            );
            form = burn?.element ?? null;
        }
        if (!form) mode = "card";

        showBodyMarker(marker, body, parent);
        // The edit form keeps the card's head, with its plate under it.
        marker.hidden = mode === "burn";
        setHead(mode === "burn");
        grip.hidden = mode !== "card";
        element.toggleAttribute("data-peek", !open && mode === "card");
        titleText.textContent =
            mode === "card"
                ? body.name
                : `${mode === "edit" ? "Edit" : "Burn"} ${body.name}`;

        const link = parent
            ? button(parent.name, "orrery__orbit-link", () =>
                  world.select(parent.id),
              )
            : null;
        meta.hidden = mode === "edit";
        meta.replaceChildren(
            `${KIND_LABELS[body.kind]} `,
            ...(link ? ["around ", link] : ["at the centre"]),
        );
        if (form) {
            content.append(form);
            if (editor && parent) {
                plate = createPlate(units, body.name, parent.name);
                head.after(plate.element);
                foot = editor.foot;
                element.append(foot);
                refresh();
            }

            return;
        }

        // A body with no parent has no orbit to read.
        if (parent) {
            headline = createHeadline(parent.name);
            head.after(headline.element);
        }
        if (parent && hasOrbit) {
            plate = createPlate(units, body.name, parent.name);
            headline?.element.after(plate.element);
        }

        children = parent ? createChildrenSection(world, body) : null;
        if (children) content.append(children.element);

        stats = createStatsSection(
            bodyStats(world.scenario, body.id, world.clock.t),
        );
        if (stats) content.append(stats);
        foot = createActions(
            { world, element, buttons, syncFocus, openForm },
            body.id,
            body.name,
            parent !== undefined,
            hasOrbit,
        );
        element.append(foot);
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
        } else if (event.type === "bodies") {
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
        else if (event.type === "body" && event.id === world.selected) {
            refresh();

            // A grip drag changes the orbit, and with it the axial tilt.
            if (mode !== "card") return;

            const next = createStatsSection(
                bodyStats(world.scenario, event.id, world.clock.t),
            );
            if (stats && next) stats.replaceWith(next);
            else if (stats) stats.remove();
            // An edit can give a body its first row. The stats come last, so it goes at the end.
            else if (next) content.append(next);
            stats = next;
        }
    });
    const interval = setInterval(refresh, REFRESH_MS);

    return {
        element,
        openAdd,
        destroy: () => {
            off();
            offUnits();
            clearInterval(interval);
            children?.destroy();
            editor?.destroy();
            burn?.destroy();
            adder?.destroy();
            element.remove();
        },
    };
};
