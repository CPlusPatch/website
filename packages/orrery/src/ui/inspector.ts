import type { BodyKind, Elements } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { removalNote } from "../adding.ts";
import type { AUnit } from "../editing.ts";
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
    /** Draws an orbit for a body, or none with `null`. */
    ghost: (id: string, elements: Elements | null) => void,
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
    const title = h("h2", {
        class: "orrery__orbit-title",
        id: "orrery-orbit-title",
    });
    // Scrolls under the head, as a scrolling card left a blank band in Chromium's canvas.
    const content = h("div", { class: "orrery__inspector-body" });
    const element = h(
        "section",
        {
            class: `${cardClasses().join(" ")} orrery__inspector`,
            "aria-label": "Selected body",
        },
        h("div", { class: "orrery__inspector-head" }, marker, title, close),
        content,
    );
    element.hidden = true;

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
        setText(focusButton, on ? "Focused" : "Focus");
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
                    `${unit}. Show distances in ${other}`,
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
        const base = "orrery__orbit-button";

        const showRow = () => {
            focusButton = button("Focus", `${base} orrery__orbit-focus`, () =>
                world.focus(id),
            );
            syncFocus();
            row.replaceChildren(focusButton);
            editButton = null;
            burnButton = null;
            if (hasOrbit) {
                editButton = button("Edit", base, () => openForm("edit"));
                burnButton = button("Burn", base, () => openForm("burn"));
                row.append(editButton, burnButton);
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
        if (adding) {
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
            editor = createElementEditor(world, units, body.id, ghost, () =>
                closeForm("edit"),
            );
            form = editor?.element ?? null;
        } else if (mode === "burn") {
            burn = createBurnEditor(world, units, body.id, ghost, () =>
                closeForm("burn"),
            );
            form = burn?.element ?? null;
        }
        if (!form) mode = "card";

        showBodyMarker(marker, body);
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
