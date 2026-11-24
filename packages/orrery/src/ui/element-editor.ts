import { AU, type Elements, elementsAt, wrapAngle } from "@cpluspatch/orbit";
import { cue } from "../audio/cues.ts";
import {
    type AUnit,
    aMin,
    aUnit,
    DEGREES,
    draftElements,
    type EditScene,
    type Field,
    fieldError,
    fieldValue,
    fromMetres,
    passesThroughParent,
    toMetres,
} from "../editing.ts";
import { otherUnit, type Units } from "../units.ts";
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

const aScale = (unit: AUnit, a: number): { step: number; decimals: number } => {
    if (unit === "km") return { step: 1000, decimals: 0 };

    // Four significant digits, so a small orbit in AU doesn't read as zero.
    const magnitude = Math.floor(Math.log10(a / AU));

    return {
        step: Math.min(0.05, 10 ** (magnitude - 1)),
        decimals: Math.max(4, 3 - magnitude),
    };
};

const specs = (unit: AUnit, a: number): Spec[] => [
    { field: "a", label: "Semi-major axis", unit, ...aScale(unit, a) },
    { field: "e", label: "Eccentricity", unit: "", step: 0.01, decimals: 5 },
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
    { field: "m", label: "Mean anomaly now", unit: "°", step: 5, decimals: 2 },
];

/**
 * The edit form for body `id`, or `null` if it has no orbit to edit.
 * Nothing changes in the world until Apply. The pending orbit shows as a ghost.
 */
export const createElementEditor = (
    world: World,
    /** The distance unit of the semi-major axis, which its switch changes. */
    units: Units,
    id: string,
    /** What the form draws in the scene: the ghost orbit and the grips. */
    scene: EditScene,
    /** Called when the form is done, whether it changed the orbit or was cancelled. */
    done: () => void,
): ElementEditor | null => {
    const body = world.scenario.bodies.find((candidate) => candidate.id === id);
    if (!body || body.parent === null) return null;
    const parent = world.scenario.bodies.find(
        (candidate) => candidate.id === body.parent,
    );
    if (!parent) return null;
    const original = elementsAt(body, world.clock.t);

    const mu = parent.mu + body.mu;
    const min = aMin(parent.radius);
    // Only the unit switch changes it, and then the field converts in place.
    let unit = units.get() ?? aUnit(original.a);
    const opened = world.clock.t;

    const toSi = (field: Field, x: number): number => {
        if (field === "a") return toMetres(x, unit);

        return field === "e" ? x : x / DEGREES;
    };
    const toDisplay = (field: Field, si: number): number => {
        if (field === "a") return fromMetres(si, unit);

        return field === "e" ? si : si * DEGREES;
    };

    const startText = (field: Field, decimals: number): string =>
        toDisplay(field, fieldValue(original, mu, opened, field)).toFixed(
            decimals,
        );

    const alert = createWarning();
    const steppers = new Map<Field, Stepper>();
    const starts = new Map<Field, string>();
    // A typed semi-major axis keeps its exact size across a unit switch, or the rounding would add up.
    let exact: { metres: number; text: string } | null = null;

    const siOf = (field: Field, stepper: Stepper): number =>
        field === "a" && exact?.text === stepper.input.value
            ? exact.metres
            : toSi(field, stepper.input.valueAsNumber);

    // Only the fields that changed, so an untouched mean anomaly keeps moving with the clock.
    const changes = (): [Field, number][] => {
        const changed: [Field, number][] = [];

        for (const [field, stepper] of steppers) {
            // A typed value can round to the start text after a unit switch.
            const same =
                field === "a" && exact?.text === stepper.input.value
                    ? exact.metres === original.a
                    : stepper.input.value === starts.get(field);
            if (same) continue;

            changed.push([field, siOf(field, stepper)]);
        }

        return changed;
    };

    // `show` also puts the messages under the fields. Typing only clears the ones it fixed.
    const check = (show: boolean): boolean => {
        const errors = new Map(
            changes().map(([field, si]) => [
                field,
                fieldError(field, si, { aMin: min, unit }),
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

    // Kept for the grips, which read it every frame.
    let current = draft();

    const preview = () => {
        const next = draft();
        current = next;

        scene.ghost(id, changes().length > 0 ? next : null);
        alert.text.textContent = `This orbit passes through ${parent.name}.`;
        alert.element.hidden =
            next === null || !passesThroughParent(next, parent.radius);
    };

    for (const spec of specs(unit, original.a)) {
        // The semi-major axis changes scale with its unit.
        const scale = () =>
            spec.field === "a" ? aScale(unit, original.a) : spec;
        const start = startText(spec.field, scale().decimals);
        const stepper = createStepper({
            id: `orrery-edit-${spec.field}`,
            name: spec.field,
            label: spec.label,
            unit: spec.unit,
            onUnit:
                spec.field === "a"
                    ? () => units.set(otherUnit(unit))
                    : undefined,
            value: start,
            step: () => scale().step,
            format: (x) => x.toFixed(scale().decimals),
            onInput: preview,
            onChange: () => check(true),
        });

        steppers.set(spec.field, stepper);
        starts.set(spec.field, start);
    }

    // A drag writes the fields, so they stay the source of truth.
    const decimals = new Map(
        specs(unit, original.a).map((spec) => [spec.field, spec.decimals]),
    );
    const setFromDrag = (change: Partial<Record<Field, number>>) => {
        for (const [field, stepper] of steppers) {
            const si = change[field];
            if (si === undefined) continue;

            if (field === "a") {
                const text = fromMetres(si, unit).toFixed(
                    aScale(unit, original.a).decimals,
                );
                stepper.input.value = text;
                exact = { metres: si, text };
            } else if (
                field === "m" &&
                Math.abs(
                    wrapAngle(
                        si -
                            fieldValue(original, mu, world.clock.t, "m") +
                            Math.PI,
                    ) - Math.PI,
                ) < 1e-9
            ) {
                // The start text, so a swap and swap back leave the mean anomaly moving with the clock.
                stepper.input.value = starts.get("m") ?? "";
            } else {
                stepper.input.value = toDisplay(field, si).toFixed(
                    decimals.get(field) ?? 2,
                );
            }
        }

        preview();
        check(true);
    };

    scene.grips({
        id,
        original,
        elements: () => current,
        minPeriapsis: min,
        meanAnomaly: (el) => fieldValue(el, mu, world.clock.t, "m"),
        set: setFromDrag,
    });

    // The units can change under the form only through the switch of this field.
    const offUnits = units.subscribe(() => {
        const next = units.get() ?? aUnit(original.a);
        const stepper = steppers.get("a");
        if (next === unit || !stepper) return;

        const { input } = stepper;
        const untouched = input.value === starts.get("a");
        const metres = siOf("a", stepper);

        unit = next;
        stepper.setUnit(unit);

        const { decimals } = aScale(unit, original.a);
        const start = startText("a", decimals);
        starts.set("a", start);
        exact = null;
        if (untouched) {
            input.value = start;
        } else if (Number.isFinite(metres)) {
            const text = fromMetres(metres, unit).toFixed(decimals);
            input.value = text;
            exact = { metres, text };
        }

        // The limits in the message are in the old unit.
        if (input.getAttribute("aria-invalid") === "true") check(true);
    });

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
        if (next && changes().length > 0) {
            cue("edit");
            world.setElements(id, next);
        }

        scene.ghost(id, null);
        scene.grips(null);
        done();
    };

    const form = createForm(
        "orrery-orbit-title",
        [
            h(
                "p",
                { class: "orrery__form-hint" },
                "Type values, use − and +, or drag Pe, Ap, Node and Inc in the view.",
            ),
            ...[...steppers.values()].map((stepper) => stepper.element),
            alert.element,
        ],
        submit,
        () => {
            scene.ghost(id, null);
            scene.grips(null);
            done();
        },
    );

    return {
        element: form.element,
        destroy: () => {
            offUnits();
            scene.ghost(id, null);
            scene.grips(null);
        },
    };
};
