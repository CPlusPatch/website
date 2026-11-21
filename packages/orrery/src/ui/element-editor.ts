import { iconSvg } from "@cpluspatch/ui";
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { fill } from "@cpluspatch/ui/lib/media.ts";
import {
    A_MAX,
    type AUnit,
    aMin,
    aToSlider,
    aUnit,
    clamp,
    editElements,
    type Field,
    fieldValue,
    fromMetres,
    passesThroughParent,
    SLIDER_MAX,
    sliderToA,
    toMetres,
} from "../editing.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";

/** The Orbit section's element and how to update and remove it. */
export type ElementEditor = {
    /** The Orbit section, then the warning, which stays visible when the section is closed. */
    elements: HTMLElement[];
    /** Shows the body's current elements, except in a control being used. */
    refresh: () => void;
    destroy: () => void;
};

type Row = {
    field: Field;
    name: string;
    short: string;
    label: HTMLLabelElement;
    range: HTMLInputElement;
    number: HTMLInputElement;
};

const ROWS: [field: Field, name: string, short: string][] = [
    ["a", "Semi-major axis", "Semi-major axis"],
    ["e", "Eccentricity", "Eccentricity"],
    ["i", "Inclination", "Inclination"],
    ["raan", "Longitude of the ascending node", "Ascending node"],
    ["argp", "Argument of periapsis", "Argument of periapsis"],
    ["m", "Mean anomaly", "Mean anomaly"],
];

/** The range's top and the number's decimals, in the displayed unit, for the fields but a. */
const SCALES: Record<
    Exclude<Field, "a">,
    { max: number; decimals: number; step: number }
> = {
    e: { max: 0.99, decimals: 4, step: 0.01 },
    i: { max: 180, decimals: 2, step: 1 },
    raan: { max: 360, decimals: 2, step: 1 },
    argp: { max: 360, decimals: 2, step: 1 },
    m: { max: 360, decimals: 2, step: 1 },
};

const DEGREES = 180 / Math.PI;

// Lucide's triangle-alert (ISC); @cpluspatch/ui only ships the icons its components draw.
const TRIANGLE_ALERT =
    '<svg class="icon" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01"/></svg>';

const warning = (): { element: HTMLElement; text: HTMLElement } => {
    const text = h("span");
    const element = h(
        "div",
        {
            class: `${alertClasses({ variant: "warning", icon: true }).join(" ")} orrery__warning`,
            role: "status",
        },
        h(
            "div",
            { class: "content" },
            h(
                "p",
                {},
                h(
                    "span",
                    { class: "visually-hidden" },
                    alertPrefix("warning") ?? "",
                ),
                " ",
                text,
            ),
        ),
    );
    element.insertAdjacentHTML("afterbegin", TRIANGLE_ALERT);
    element.hidden = true;

    return { element, text };
};

/** The Orbit section for body `id`, or `null` if it has no orbit to edit. */
export const createElementEditor = (
    world: World,
    id: string,
): ElementEditor | null => {
    // The scenario is replaced on every edit, so read it again each time.
    const context = () => {
        const body = world.scenario.bodies.find(
            (candidate) => candidate.id === id,
        );
        const parent = world.scenario.bodies.find(
            (candidate) => candidate.id === body?.parent,
        );
        if (!body?.elements || !parent) return null;

        return { el: body.elements, mu: parent.mu + body.mu, parent };
    };

    const first = context();
    if (!first) return null;

    const min = aMin(first.parent.radius);
    let unit: AUnit = aUnit(first.el.a);
    let dragging: Row | null = null;

    const decimals = (field: Field): number =>
        field === "a" ? (unit === "km" ? 0 : 3) : SCALES[field].decimals;
    const step = (field: Field): string => String(10 ** -decimals(field));
    const toDisplay = (field: Field, si: number): number => {
        if (field === "a") return fromMetres(si, unit);

        return field === "e" ? si : si * DEGREES;
    };
    const toSi = (field: Field, x: number): number => {
        if (field === "a") return toMetres(x, unit);

        return field === "e" ? x : x / DEGREES;
    };
    const clampSi = (field: Field, si: number): number =>
        field === "a"
            ? clamp(si, min, A_MAX)
            : clamp(si, 0, toSi(field, SCALES[field].max));
    const unitText = (field: Field): string => {
        if (field === "a") return ` (${unit})`;

        return field === "e" ? "" : " (°)";
    };
    const spokenUnit = (field: Field): string => {
        if (field === "a") return ` ${unit}`;

        return field === "e" ? "" : " degrees";
    };

    const rows: Row[] = ROWS.map(([field, name, short]) => {
        const inputId = `orrery-edit-${field}`;
        const range = h("input", {
            type: "range",
            class: "slider",
            min: "0",
            max: field === "a" ? String(SLIDER_MAX) : String(SCALES[field].max),
            // The arrow keys move by one step; the number input is for fine values.
            step: field === "a" ? "1" : String(SCALES[field].step),
            "aria-label": name,
        });
        const number = h("input", {
            id: inputId,
            type: "number",
            class: "field input orrery__editor-number",
        });

        return {
            field,
            name,
            short,
            label: h("label", { for: inputId }),
            range,
            number,
        };
    });

    const alert = warning();

    // A range keeps focus after a drag, so only a drag or keyboard focus counts.
    const busy = (row: Row, control: HTMLInputElement): boolean =>
        control === row.range
            ? dragging === row || control.matches(":focus-visible")
            : document.activeElement === control;

    const show = (row: Row, si: number, force: boolean) => {
        const { field, range, number } = row;

        if (force || !busy(row, range)) {
            range.value = String(
                field === "a"
                    ? aToSlider(si, min, A_MAX)
                    : toDisplay(field, si),
            );
            fill(range);
        }
        // Rounded once, so the field and the spoken value agree.
        const value = Number(toDisplay(field, si).toFixed(decimals(field)));
        if (force || !busy(row, number)) {
            number.value =
                field === "e" ? String(value) : value.toFixed(decimals(field));
        }

        const spoken = new Intl.NumberFormat("en", {
            maximumFractionDigits: decimals(field),
        }).format(value);
        range.setAttribute("aria-valuetext", `${spoken}${spokenUnit(field)}`);
    };

    const label = (row: Row) => {
        row.label.textContent = `${row.short}${unitText(row.field)}`;
        row.number.step = step(row.field);
    };

    const refresh = (force = false) => {
        const c = context();
        if (!c) return;

        const aRow = rows[0];
        // Not while typing, or the text would change unit under the cursor.
        if (aRow && (force || !busy(aRow, aRow.number))) {
            const next = aUnit(c.el.a);
            if (next !== unit) {
                unit = next;
                label(aRow);
            }
        }
        for (const row of rows) {
            show(row, fieldValue(c.el, c.mu, world.clock.t, row.field), force);
        }

        alert.text.textContent = `This orbit passes through ${c.parent.name}.`;
        alert.element.hidden = !passesThroughParent(c.el, c.parent.radius);
    };

    const edit = (row: Row, si: number) => {
        const c = context();
        if (!c) return;

        world.setElements(
            id,
            editElements(
                c.el,
                c.mu,
                world.clock.t,
                row.field,
                clampSi(row.field, si),
            ),
        );
    };

    const stopDrag = () => {
        dragging = null;
    };
    const controller = new AbortController();
    const { signal } = controller;
    window.addEventListener("pointerup", stopDrag, { signal });
    window.addEventListener("pointercancel", stopDrag, { signal });

    for (const row of rows) {
        const { field, range, number } = row;

        range.addEventListener("pointerdown", () => {
            dragging = row;
        });
        range.addEventListener("input", () => {
            const x = range.valueAsNumber;
            if (Number.isNaN(x)) return;

            // `show` leaves a dragged range alone, so its fill follows here.
            fill(range);
            edit(
                row,
                field === "a" ? sliderToA(x, min, A_MAX) : toSi(field, x),
            );
        });
        number.addEventListener("input", () => {
            const x = number.valueAsNumber;
            // Empty, or half typed like the "5" of "5000", so wait for `change`.
            if (
                Number.isNaN(x) ||
                clampSi(field, toSi(field, x)) !== toSi(field, x)
            )
                return;

            edit(row, toSi(field, x));
        });
        // Picks a's unit again once the edit is done.
        const settle = () => refresh(true);
        range.addEventListener("change", settle);
        number.addEventListener("change", () => {
            const x = number.valueAsNumber;
            if (!Number.isNaN(x)) edit(row, clampSi(field, toSi(field, x)));
            settle();
        });
    }

    for (const row of rows) label(row);

    const chevron = h("span");
    chevron.innerHTML = iconSvg("chevron-down");
    const element = h(
        "details",
        { class: "orrery__editor", open: "" },
        h("summary", {}, "Orbit", chevron),
        ...rows.map((row) =>
            h(
                "div",
                { class: "orrery__editor-row" },
                row.label,
                h(
                    "div",
                    { class: "orrery__editor-controls" },
                    row.range,
                    row.number,
                ),
            ),
        ),
    );
    refresh(true);

    return {
        elements: [element, alert.element],
        refresh: () => refresh(),
        destroy: () => {
            controller.abort();
            element.remove();
            alert.element.remove();
        },
    };
};
