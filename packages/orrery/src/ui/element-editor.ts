import type { Elements } from "@cpluspatch/orbit";
import {
    type AUnit,
    aMin,
    aUnit,
    DEGREES,
    draftElements,
    type Field,
    fieldError,
    fieldValue,
    fromMetres,
    passesThroughParent,
    toMetres,
} from "../editing.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";
import { createForm, createStepper, type Stepper } from "./form.ts";
import { createWarning } from "./warning.ts";

/** The edit form's element and how to remove it. */
export type ElementEditor = {
    element: HTMLFormElement;
    /** Clears the pending orbit from the scene. */
    destroy: () => void;
};

type Spec = {
    field: Field;
    label: string;
    unit: string;
    step: number;
    decimals: number;
};

const specs = (unit: AUnit): Spec[] => [
    {
        field: "a",
        label: "Semi-major axis",
        unit,
        step: unit === "km" ? 1000 : 0.05,
        decimals: unit === "km" ? 0 : 4,
    },
    { field: "e", label: "Eccentricity", unit: "", step: 0.01, decimals: 4 },
    { field: "i", label: "Inclination", unit: "°", step: 1, decimals: 2 },
    {
        field: "raan",
        label: "Ascending node",
        unit: "°",
        step: 5,
        decimals: 2,
    },
    {
        field: "argp",
        label: "Argument of periapsis",
        unit: "°",
        step: 5,
        decimals: 2,
    },
    { field: "m", label: "Mean anomaly", unit: "°", step: 5, decimals: 2 },
];

/**
 * The edit form for body `id`, or `null` if it has no orbit to edit.
 * Nothing changes in the world until Apply. The pending orbit shows as a ghost.
 */
export const createElementEditor = (
    world: World,
    id: string,
    /** Draws an orbit for a body, or none with `null`. */
    ghost: (id: string, elements: Elements | null) => void,
    /** Called when the form is done, with whether it changed the orbit. */
    done: (applied: boolean) => void,
): ElementEditor | null => {
    const body = world.scenario.bodies.find((candidate) => candidate.id === id);
    const parent = world.scenario.bodies.find(
        (candidate) => candidate.id === body?.parent,
    );
    if (!body?.elements || !parent) return null;

    const original = body.elements;
    const mu = parent.mu + body.mu;
    const min = aMin(parent.radius);
    // Fixed while the form is open, or the text would change unit under the cursor.
    const unit = aUnit(original.a);
    const opened = world.clock.t;

    const toSi = (field: Field, x: number): number => {
        if (field === "a") return toMetres(x, unit);

        return field === "e" ? x : x / DEGREES;
    };
    const toDisplay = (field: Field, si: number): number => {
        if (field === "a") return fromMetres(si, unit);

        return field === "e" ? si : si * DEGREES;
    };

    const alert = createWarning();
    const steppers = new Map<Field, Stepper>();
    const starts = new Map<Field, string>();

    // Only the fields that changed, so an untouched mean anomaly keeps moving with the clock.
    const changes = (): [Field, number][] => {
        const changed: [Field, number][] = [];

        for (const [field, stepper] of steppers) {
            if (stepper.input.value === starts.get(field)) continue;

            changed.push([field, toSi(field, stepper.input.valueAsNumber)]);
        }

        return changed;
    };

    // `show` also puts the messages under the fields. Typing only clears the ones it fixed.
    const check = (show: boolean): boolean => {
        const errors = new Map(
            changes().map(([field, si]) => [
                field,
                fieldError(field, si, min, unit),
            ]),
        );
        let ok = true;

        for (const [field, stepper] of steppers) {
            const error = errors.get(field) ?? null;
            if (error !== null) ok = false;
            if (show || error === null) stepper.setError(error);
        }

        return ok;
    };

    const draft = (): Elements | null =>
        check(false)
            ? draftElements(
                  original,
                  mu,
                  world.clock.t,
                  Object.fromEntries(changes()),
              )
            : null;

    const preview = () => {
        const next = draft();

        ghost(id, changes().length > 0 ? next : null);
        alert.text.textContent = `This orbit passes through ${parent.name}.`;
        alert.element.hidden =
            next === null || !passesThroughParent(next, parent.radius);
    };

    for (const spec of specs(unit)) {
        const start = toDisplay(
            spec.field,
            fieldValue(original, mu, opened, spec.field),
        ).toFixed(spec.decimals);
        const stepper = createStepper({
            id: `orrery-edit-${spec.field}`,
            name: spec.field,
            label: spec.label,
            unit: spec.unit,
            value: start,
            step: () => spec.step,
            format: (x) => x.toFixed(spec.decimals),
            onInput: preview,
            onChange: () => check(true),
        });

        steppers.set(spec.field, stepper);
        starts.set(spec.field, start);
    }

    const submit = () => {
        if (!check(true)) {
            for (const stepper of steppers.values()) {
                if (stepper.input.getAttribute("aria-invalid") === "true") {
                    stepper.input.focus();
                    break;
                }
            }

            return;
        }

        const next = draft();
        if (next && changes().length > 0) world.setElements(id, next);

        ghost(id, null);
        done(true);
    };

    const form = createForm(
        "orrery-orbit-title",
        [
            h(
                "p",
                { class: "orrery__form-hint" },
                "Type values, or use − and +.",
            ),
            ...[...steppers.values()].map((stepper) => stepper.element),
            alert.element,
        ],
        submit,
        () => {
            ghost(id, null);
            done(false);
        },
    );

    return {
        element: form.element,
        destroy: () => ghost(id, null),
    };
};
