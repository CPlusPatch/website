import type { BodyKind } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { removalNote } from "../adding.ts";
import type { AUnit, EditScene } from "../editing.ts";
import {
    distanceParts,
    formatAngle,
    formatDistance,
    formatDuration,
    formatSoon,
    formatSpeed,
} from "../format.ts";
import { type Readouts, readouts } from "../readouts.ts";
import { otherUnit, type Units } from "../units.ts";
import type { World } from "../world.ts";
import { type BodyAdder, createBodyAdder } from "./body-adder.ts";
import { showBodyMarker } from "./body-marker.ts";
import { type BurnEditor, createBurnEditor } from "./burn-editor.ts";
import { h, setText } from "./dom.ts";
import { createElementEditor, type ElementEditor } from "./element-editor.ts";
import { sheetAfterDrag } from "./sheet.ts";

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

/** A readout row: a distance in metres, which gets a unit switch, or finished text. */
type Row = { label: (parent: string) => string } & (
    | { metres: (r: Readouts) => number }
    | { text: (r: Readouts) => string }
);

const FIELDS: Row[] = [
    { label: (parent) => `Distance to ${parent}`, metres: (r) => r.distance },
    { label: () => "Speed", text: (r) => formatSpeed(r.speed) },
    { label: () => "Period", text: (r) => formatDuration(r.period) },
    {
        label: () => "Periapsis altitude",
        metres: (r) => r.periapsisAltitude,
    },
    { label: () => "Apoapsis altitude", metres: (r) => r.apoapsisAltitude },
    { label: () => "True anomaly", text: (r) => formatAngle(r.trueAnomaly) },
];

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

const KINDS: Record<BodyKind, string> = {
    star: "Star",
    planet: "Planet",
    dwarf: "Dwarf planet",
    moon: "Moon",
    spacecraft: "Spacecraft",
};

/** The apsides line, as `Ap 408 km in 41d`, and the sentence for a screen reader. */
const apsides = (
    r: Readouts,
    unit: AUnit | null,
): { parts: string[]; spoken: string } => ({
    parts: [
        `Ap ${formatDistance(r.apoapsisAltitude, unit)} in ${formatSoon(r.timeToApoapsis)}`,
        `Pe ${formatDistance(r.periapsisAltitude, unit)} in ${formatSoon(r.timeToPeriapsis)}`,
        formatSpeed(r.speed),
    ],
    spoken: `Apoapsis ${formatDistance(r.apoapsisAltitude, unit)} up, in ${formatDuration(r.timeToApoapsis)}. Periapsis ${formatDistance(r.periapsisAltitude, unit)} up, in ${formatDuration(r.timeToPeriapsis)}. Speed ${formatSpeed(r.speed)}. Period ${formatDuration(r.period)}.`,
});

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

    let values: HTMLElement[] = [];
    // The switch of each distance row, or none for the rows that aren't distances.
    let switches: (HTMLButtonElement | null)[] = [];
    let line: HTMLElement[] = [];
    let spoken: HTMLElement | null = null;
    let focusButton: HTMLButtonElement | null = null;
    let shown: string | null = null;
    let mode: Mode = "card";
    let editor: ElementEditor | null = null;
    let burn: BurnEditor | null = null;
    let adder: BodyAdder | null = null;
    let editButton: HTMLButtonElement | null = null;
    let burnButton: HTMLButtonElement | null = null;

    const syncFocus = () => {
        if (!focusButton) return;

        const on = world.focused === shown;
        focusButton.setAttribute("aria-pressed", String(on));
        const label = focusButton.querySelector(".orrery__orbit-button-label");
        if (label) setText(label, on ? "Focused" : "Focus");
    };

    const refresh = () => {
        burn?.refresh();

        const id = world.selected;
        if (!id || values.length === 0) return;

        const current = readouts(
            world.scenario,
            id,
            world.states(),
            world.clock.t,
        );
        if (!current) return;

        const chosen = units.get();
        FIELDS.forEach((row, k) => {
            const cell = values[k];
            if (!cell) return;

            if (!("metres" in row)) {
                setText(cell, row.text(current));
                return;
            }

            const [number, unit] = distanceParts(row.metres(current), chosen);
            setText(cell, number);

            // Rewritten only when the unit changes, so a pressed switch keeps its focus.
            const control = switches[k];
            if (control && control.textContent !== unit) {
                const other = otherUnit(unit);
                control.textContent = unit;
                control.setAttribute(
                    "aria-label",
                    `${control.dataset.row} in ${unit}. Show distances in ${other}`,
                );
                control.title = `Show in ${other} (U)`;
            }
        });

        const text = apsides(current, chosen);
        text.parts.forEach((part, k) => {
            const span = line[k];
            if (span) setText(span, part);
        });
        if (spoken) setText(spoken, text.spoken);
    };

    // The card re-renders, so what had focus moves to the first thing a reader can pick next.
    const focusFirst = () => {
        const next =
            element.querySelector<HTMLElement>(".orrery__orbit-chip") ??
            element.querySelector<HTMLElement>(".orrery__orbit-link");
        (next ?? close).focus();
    };

    const button = (label: string, className: string, onClick: () => void) => {
        const control = h(
            "button",
            { type: "button", class: className },
            label,
        );
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
        control.append(
            h("span", { class: "orrery__orbit-button-label" }, label),
        );

        return control;
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
        (opener === "edit" ? editButton : burnButton)?.focus();
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

    const actions = (
        id: string,
        name: string,
        hasParent: boolean,
        hasOrbit: boolean,
    ) => {
        const row = h("div", { class: "orrery__orbit-actions" });
        // Remove goes under this row, so the three buttons keep the card's width.
        const buttons = h("div", { class: "orrery__orbit-buttons" });
        const base = "orrery__orbit-button";

        const showRow = () => {
            focusButton = iconButton(
                "Focus",
                `${base} orrery__orbit-focus`,
                FOCUS_ICON,
                () => world.focus(id),
            );
            syncFocus();
            buttons.replaceChildren(focusButton);
            row.replaceChildren(buttons);
            editButton = null;
            burnButton = null;
            if (hasOrbit) {
                editButton = iconButton("Edit", base, EDIT_ICON, () =>
                    openForm("edit"),
                );
                burnButton = iconButton("Burn", base, BURN_ICON, () =>
                    openForm("burn"),
                );
                buttons.append(editButton, burnButton);
            }
            if (hasParent) {
                row.append(
                    button("Remove", "orrery__orbit-quiet", showConfirm),
                );
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
            focusButton = null;
            row.replaceChildren(group);
            cancel.focus();
        };

        showRow();

        return row;
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
        values = [];
        switches = [];
        line = [];
        spoken = null;
        focusButton = null;
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
            const [ap, pe, speed] = [h("span"), h("span"), h("span")];
            line = [ap, pe, speed];
            spoken = h("p", { class: "visually-hidden", "aria-live": "off" });
            const list = h("dl", { class: "orrery__readouts" });
            for (const row of FIELDS) {
                const dd = h("dd", { class: "orrery__readout" });

                if ("metres" in row) {
                    // The text is filled in by `refresh`, which knows the unit.
                    const number = h("span");
                    const control = h("button", {
                        type: "button",
                        class: "orrery__unit-switch",
                        // The row's label, so the switches don't all read the same.
                        "data-row": row.label(parent.name),
                    });
                    control.addEventListener("click", () =>
                        units.set(
                            otherUnit(
                                control.textContent === "km" ? "km" : "AU",
                            ),
                        ),
                    );
                    dd.append(number, " ", control);
                    values.push(number);
                    switches.push(control);
                } else {
                    values.push(dd);
                    switches.push(null);
                }
                list.append(h("dt", {}, row.label(parent.name)), dd);
            }
            content.append(
                h(
                    "p",
                    { class: "orrery__orbit-line", "aria-hidden": "true" },
                    ap,
                    pe,
                    speed,
                ),
                spoken,
                list,
            );
        }

        const chips = parent ? around(body.id, body.name) : null;
        if (chips) content.append(chips);
        content.append(
            actions(body.id, body.name, parent !== undefined, hasOrbit),
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
