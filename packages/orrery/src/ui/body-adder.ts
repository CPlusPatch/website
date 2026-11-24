import { AU, type Body, type BodyKind, solarSystem } from "@cpluspatch/orbit";
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { type AddField, addErrors, newBody, slugId } from "../adding.ts";
import { cue } from "../audio/cues.ts";
import { type AUnit, aUnit, fromMetres, toMetres } from "../editing.ts";
import { otherUnit, type Units } from "../units.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";
import { createForm, createStepper } from "./form.ts";

/** The Add body form's element and how to use it. */
export type BodyAdder = {
    element: HTMLFormElement;
    /** The Cancel and Add row, for the card to pin below the form. */
    foot: HTMLElement;
    /** Puts `name` in the Name field. */
    setName: (name: string) => void;
    /** Moves the focus to the Name field. */
    focus: () => void;
    destroy: () => void;
};

/** The longest name the Name field takes. */
const NAME_MAX = 40;

const KINDS: [BodyKind, string][] = [
    ["planet", "Planet"],
    ["dwarf", "Dwarf planet"],
    ["moon", "Moon"],
    ["asteroid", "Asteroid"],
    ["comet", "Comet"],
    ["spacecraft", "Spacecraft"],
];

const kindOf = (value: string): BodyKind => {
    const found = KINDS.find(([kind]) => kind === value);
    if (!found)
        throw new Error(`The Kind select holds an unknown kind, ${value}.`);

    return found[0];
};

// Asteroids can have moons, like Didymos.
const canParent = (body: Body): boolean =>
    body.kind !== "moon" && body.kind !== "comet" && body.kind !== "spacecraft";

/** A new body's kind around `parent`: a planet around the root, else a moon. */
const defaultKind = (parent: Body): BodyKind =>
    parent.parent === null ? "planet" : "moon";

/** A new body's semi-major axis around `parent`, in metres. */
const defaultA = (parent: Body): number =>
    parent.parent === null ? AU : parent.radius * 10;

const text = (x: number): string => String(Number(x.toPrecision(10)));

/** A row with a text field or a select, and a line for an error. */
const createRow = (
    id: string,
    label: string,
    control: HTMLInputElement | HTMLSelectElement,
    kind: "text" | "select",
) => {
    const errorId = `${id}-error`;
    const error = h("p", { class: "orrery__stepper-error", id: errorId });
    error.hidden = true;
    control.id = id;
    control.setAttribute("aria-describedby", errorId);

    return {
        control,
        element: h(
            "div",
            { class: "orrery__form-row" },
            h("label", { for: id }, label),
            h(
                "div",
                { class: `orrery__stepper orrery__stepper--${kind}` },
                control,
            ),
            error,
        ),
        setError: (message: string | null) => {
            error.textContent = message ?? "";
            error.hidden = message === null;
            control.setAttribute("aria-invalid", String(message !== null));
        },
    };
};

/**
 * The Add body form, with `name` in its Name field.
 * Adding selects the new body. `done` is called when the form is cancelled.
 */
export const createBodyAdder = (
    world: World,
    /** The distance unit of the semi-major axis, which its switch changes. */
    units: Units,
    name: string,
    done: () => void,
): BodyAdder => {
    const { bodies } = world.scenario;
    const root = bodies.find((body) => body.parent === null);
    if (!root) throw new Error("The scenario has no root body.");

    const parents = world.order.filter(canParent);
    const start = parents.find((body) => body.id === world.focused) ?? root;
    const parentOf = (): Body =>
        parents.find((body) => body.id === parent.control.value) ?? root;
    const unitFor = (body: Body): AUnit => units.get() ?? aUnit(defaultA(body));

    let unit = unitFor(start);
    let attempted = false;
    // A default follows the parent until the person sets it.
    let kindTouched = false;
    let aTouched = false;
    // A typed semi-major axis keeps its exact size across a unit switch, or the rounding would add up.
    let exact: { metres: number; text: string } | null = null;

    const nameRow = createRow(
        "orrery-add-name",
        "Name",
        h("input", {
            type: "text",
            name: "name",
            maxlength: String(NAME_MAX),
            autocomplete: "off",
            spellcheck: "false",
            // maxlength doesn't cut a value set from code.
            value: name.slice(0, NAME_MAX),
        }),
        "text",
    );
    const kindRow = createRow(
        "orrery-add-kind",
        "Kind",
        h(
            "select",
            { name: "kind" },
            ...KINDS.map(([value, label]) => h("option", { value }, label)),
        ),
        "select",
    );
    const parent = createRow(
        "orrery-add-parent",
        "Parent",
        h(
            "select",
            { name: "parent" },
            ...parents.map((body) =>
                h("option", { value: body.id }, body.name),
            ),
        ),
        "select",
    );
    // Kind and Parent are selects, so their values are set after the options exist.
    const kind = kindRow.control;
    kind.value = defaultKind(start);
    parent.control.value = start.id;

    const live = () => {
        if (attempted) check();
    };
    const radius = createStepper({
        id: "orrery-add-radius",
        name: "radius",
        label: "Radius",
        unit: "km",
        value: "500",
        step: () => 100,
        onInput: live,
    });
    const mass = createStepper({
        id: "orrery-add-mass",
        name: "mass",
        label: "Mass",
        unit: "kg",
        value: "1e20",
        // Rounded to drop float noise, like 1.0000000000000001e+21.
        move: (value, sign) =>
            Number((sign === 1 ? value * 10 : value / 10).toPrecision(12)),
        onInput: live,
    });
    const a = createStepper({
        id: "orrery-add-a",
        name: "a",
        label: "Semi-major axis",
        unit,
        onUnit: () => units.set(otherUnit(unit)),
        value: text(fromMetres(defaultA(start), unit)),
        step: () => (unit === "km" ? 1000 : 0.05),
        onInput: () => {
            aTouched = true;
            live();
        },
    });
    const e = createStepper({
        id: "orrery-add-e",
        name: "e",
        label: "Eccentricity",
        unit: "",
        value: "0",
        step: () => 0.01,
        onInput: live,
    });
    const inclination = createStepper({
        id: "orrery-add-i",
        name: "i",
        label: "Inclination",
        unit: "°",
        value: "0",
        step: () => 1,
        onInput: live,
    });

    // In the order of the form, so the first failure gets the focus.
    const fields: [
        AddField,
        { setError: (m: string | null) => void },
        HTMLElement,
    ][] = [
        ["name", nameRow, nameRow.control],
        ["radius", radius, radius.input],
        ["mass", mass, mass.input],
        ["a", a, a.input],
        ["e", e, e.input],
        ["i", inclination, inclination.input],
    ];

    const metresOf = (): number =>
        exact?.text === a.input.value
            ? exact.metres
            : toMetres(a.input.valueAsNumber, unit);

    const check = (): Partial<Record<AddField, string>> => {
        const errors = addErrors(
            {
                name: nameRow.control.value,
                parent: parentOf(),
                radiusKm: radius.input.valueAsNumber,
                massKg: mass.input.valueAsNumber,
                aMetres: metresOf(),
                e: e.input.valueAsNumber,
                iDeg: inclination.input.valueAsNumber,
                unit,
            },
            world.scenario,
        );

        for (const [field, row] of fields) row.setError(errors[field] ?? null);

        return errors;
    };

    const failureText = h("span");
    const failure = h(
        "div",
        {
            class: `${alertClasses({ variant: "destructive" }).join(" ")} orrery__warning`,
            role: "alert",
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
                    alertPrefix("destructive") ?? "",
                ),
                " ",
                failureText,
            ),
        ),
    );
    failure.hidden = true;

    const showUnit = (next: AUnit) => {
        const metres = metresOf();

        unit = next;
        a.setUnit(unit);
        exact = null;
        if (!aTouched) {
            a.input.value = text(fromMetres(defaultA(parentOf()), unit));
        } else if (Number.isFinite(metres)) {
            const typed = text(fromMetres(metres, unit));

            a.input.value = typed;
            exact = { metres, text: typed };
        }

        // The limits in the message are in the old unit.
        live();
    };

    parent.control.addEventListener("change", () => {
        const next = parentOf();

        if (!kindTouched) kind.value = defaultKind(next);
        if (unitFor(next) !== unit) showUnit(unitFor(next));
        else if (!aTouched) {
            a.input.value = text(fromMetres(defaultA(next), unit));
        }
        live();
    });
    kind.addEventListener("change", () => {
        kindTouched = true;
        live();
    });
    nameRow.control.addEventListener("input", live);

    // The units can change under the form through the switch of this field, or a shortcut.
    const offUnits = units.subscribe(() => {
        const next = unitFor(parentOf());
        if (next !== unit) showUnit(next);
    });

    const submit = () => {
        attempted = true;
        failure.hidden = true;

        const errors = check();
        const invalid = fields.find(([field]) => errors[field] !== undefined);
        if (invalid) {
            invalid[2].focus();

            return;
        }

        const owner = parentOf();
        const trimmed = nameRow.control.value.trim();
        const body = newBody(
            {
                // Built-in ids stay reserved, since maps and spin are keyed on them.
                id: slugId(
                    trimmed,
                    new Set(
                        [...bodies, ...solarSystem.bodies].map(({ id }) => id),
                    ),
                ),
                name: trimmed,
                kind: kindOf(kind.value),
                parent: owner,
                radiusKm: radius.input.valueAsNumber,
                massKg: mass.input.valueAsNumber,
                aKm: metresOf() / 1000,
                e: e.input.valueAsNumber,
                iDeg: inclination.input.valueAsNumber,
            },
            world.clock.t,
        );
        // Selecting the new body replaces the form with its card, so the root is found first.
        const orrery = form.element.closest<HTMLElement>(".orrery");

        try {
            world.addBody(body);
        } catch (error) {
            failureText.textContent =
                error instanceof Error ? error.message : String(error);
            failure.hidden = false;

            return;
        }

        cue("add");
        world.select(body.id);
        orrery?.querySelector<HTMLElement>(".orrery__orbit-focus")?.focus();
    };

    const form = createForm(
        "orrery-orbit-title",
        [
            nameRow.element,
            kindRow.element,
            parent.element,
            radius.element,
            mass.element,
            a.element,
            e.element,
            inclination.element,
            failure,
        ],
        submit,
        done,
        "Add",
        "orrery-add-form",
    );

    return {
        element: form.element,
        foot: form.actions,
        setName: (next) => {
            nameRow.control.value = next.slice(0, NAME_MAX);
            live();
        },
        focus: () => nameRow.control.focus(),
        destroy: offUnits,
    };
};
