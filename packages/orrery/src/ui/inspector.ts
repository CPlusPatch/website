import type { BodyKind, Elements } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { removalNote } from "../adding.ts";
import {
    formatAngle,
    formatDistance,
    formatDuration,
    formatSoon,
    formatSpeed,
} from "../format.ts";
import { type Readouts, readouts } from "../readouts.ts";
import { colorOf } from "../view/theme.ts";
import type { World } from "../world.ts";
import { bodyMarker } from "./body-marker.ts";
import { type BurnEditor, createBurnEditor } from "./burn-editor.ts";
import { h } from "./dom.ts";
import { createElementEditor, type ElementEditor } from "./element-editor.ts";

/** The inspector's element and how to remove it. */
export type Inspector = {
    element: HTMLElement;
    destroy: () => void;
};

/** How often the readouts refresh while the clock runs, in ms. */
const REFRESH_MS = 250;

const FIELDS: [
    label: (parent: string) => string,
    value: (r: Readouts) => string,
][] = [
    [(parent) => `Distance to ${parent}`, (r) => formatDistance(r.distance)],
    [() => "Speed", (r) => formatSpeed(r.speed)],
    [() => "Period", (r) => formatDuration(r.period)],
    [() => "Periapsis altitude", (r) => formatDistance(r.periapsisAltitude)],
    [() => "Apoapsis altitude", (r) => formatDistance(r.apoapsisAltitude)],
    [() => "True anomaly", (r) => formatAngle(r.trueAnomaly)],
];

const KINDS: Record<BodyKind, string> = {
    star: "Star",
    planet: "Planet",
    dwarf: "Dwarf planet",
    moon: "Moon",
    spacecraft: "Spacecraft",
};

/** The apsides line, as `Ap 408 km in 41d`, and the sentence for a screen reader. */
const apsides = (r: Readouts): { parts: string[]; spoken: string } => ({
    parts: [
        `Ap ${formatDistance(r.apoapsisAltitude)} in ${formatSoon(r.timeToApoapsis)}`,
        `Pe ${formatDistance(r.periapsisAltitude)} in ${formatSoon(r.timeToPeriapsis)}`,
        formatSpeed(r.speed),
    ],
    spoken: `Apoapsis ${formatDistance(r.apoapsisAltitude)} up, in ${formatDuration(r.timeToApoapsis)}. Periapsis ${formatDistance(r.periapsisAltitude)} up, in ${formatDuration(r.timeToPeriapsis)}. Speed ${formatSpeed(r.speed)}. Period ${formatDuration(r.period)}.`,
});

const setText = (node: Node, text: string) => {
    if (node.textContent !== text) node.textContent = text;
};

/** A card with the selected body's name, kind and live orbit readouts. */
export const createInspector = (
    world: World,
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
    close.addEventListener("click", () => world.select(null));

    const marker = h("span", { class: "orrery__orbit-marker" });
    const title = h("h2", { class: "orrery__orbit-title" });
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
    let line: HTMLElement[] = [];
    let spoken: HTMLElement | null = null;
    let focusButton: HTMLButtonElement | null = null;
    let shown: string | null = null;
    let editor: ElementEditor | null = null;
    let burn: BurnEditor | null = null;

    const syncFocus = () => {
        if (!focusButton) return;

        const on = world.focused === shown;
        focusButton.setAttribute("aria-pressed", String(on));
        setText(focusButton, on ? "Focused" : "Focus");
    };

    const refresh = () => {
        const id = world.selected;
        if (!id || values.length === 0) return;

        editor?.refresh();
        burn?.refresh();

        const current = readouts(
            world.scenario,
            id,
            world.states(),
            world.clock.t,
        );
        if (!current) return;

        FIELDS.forEach(([, value], k) => {
            const cell = values[k];
            if (cell) setText(cell, value(current));
        });

        const text = apsides(current);
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

    // Opens the section and puts the cursor in its first field.
    const reveal = (section: HTMLElement | undefined) => {
        if (!(section instanceof HTMLDetailsElement)) return;

        section.open = true;
        // The Burn step radios are visually hidden, so the first visible field gets the focus.
        section
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
                    icon.innerHTML = bodyMarker(child.kind);
                    icon.style.color = colorOf(child);
                    chip.prepend(icon);

                    return h("li", {}, chip);
                }),
            ),
        );
    };

    const actions = (id: string, name: string, hasParent: boolean) => {
        const row = h("div", { class: "orrery__orbit-actions" });
        const base = "orrery__orbit-button";

        const showRow = () => {
            focusButton = button("Focus", `${base} orrery__orbit-focus`, () =>
                world.focus(id),
            );
            syncFocus();
            row.replaceChildren(focusButton);
            if (editor) {
                const section = editor.elements[0];
                row.append(button("Edit", base, () => reveal(section)));
            }
            if (burn) {
                const section = burn.elements[0];
                row.append(button("Burn", base, () => reveal(section)));
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
        const hadFocus = element.contains(document.activeElement);
        // Hiding the focused close button would drop focus to <body>.
        if (!body && shown && hadFocus) restoreFocus(shown);
        shown = body?.id ?? null;
        element.hidden = !body;
        values = [];
        line = [];
        spoken = null;
        focusButton = null;
        content.replaceChildren();
        editor?.destroy();
        editor = null;
        burn?.destroy();
        burn = null;
        if (!body) return;

        marker.innerHTML = bodyMarker(body.kind);
        marker.style.color = colorOf(body);
        title.textContent = body.name;

        const parent = world.scenario.bodies.find(
            (candidate) => candidate.id === body.parent,
        );
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

        // A body with no parent has no orbit to read.
        if (parent) {
            const [ap, pe, speed] = [h("span"), h("span"), h("span")];
            line = [ap, pe, speed];
            spoken = h("p", { class: "visually-hidden", "aria-live": "off" });
            const list = h("dl", { class: "orrery__readouts" });
            for (const [label] of FIELDS) {
                const value = h("dd", { class: "orrery__readout" });
                values.push(value);
                list.append(h("dt", {}, label(parent.name)), value);
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
            editor = createElementEditor(world, body.id);
            burn = createBurnEditor(world, body.id, ghost);
        }

        const chips = parent ? around(body.id, body.name) : null;
        if (chips) content.append(chips);
        content.append(actions(body.id, body.name, parent !== undefined));
        for (const section of [editor, burn]) {
            if (section) content.append(...section.elements);
        }
        refresh();

        // Focus was on something this render replaced.
        if (hadFocus && !element.contains(document.activeElement)) {
            focusFirst();
        }
    };
    render();

    const off = world.on((event) => {
        // Add and remove change the "Around" chips without changing the selection.
        if (event.type === "selection" || event.type === "scenario") render();
        else if (event.type === "focus") syncFocus();
        else if (event.type === "clock") refresh();
        else if (event.type === "body" && event.id === world.selected)
            refresh();
    });
    const interval = setInterval(refresh, REFRESH_MS);

    return {
        element,
        destroy: () => {
            off();
            clearInterval(interval);
            editor?.destroy();
            burn?.destroy();
            element.remove();
        },
    };
};
