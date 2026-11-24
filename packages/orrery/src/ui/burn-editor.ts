import type { Burn, Elements } from "@cpluspatch/orbit";
import { elementsAt, nextApsisTime } from "@cpluspatch/orbit";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { segmentedClasses } from "@cpluspatch/ui/components/segmented-control.ts";
import { cue } from "../audio/cues.ts";
import {
    failureMessage,
    isZero,
    type Prediction,
    predict,
    STEPS,
    sameElements,
} from "../burning.ts";
import type { AUnit } from "../editing.ts";
import { formatDistance, formatDuration } from "../format.ts";
import type { Units } from "../units.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";
import { createForm, createStepper } from "./form.ts";
import { createWarning } from "./warning.ts";

/** The burn form's element and how to update and remove it. */
export type BurnEditor = {
    element: HTMLFormElement;
    /** Predicts the burn again. */
    refresh: () => void;
    destroy: () => void;
};

type Axis = keyof Burn;

const AXES: [axis: Axis, name: string, hint?: string][] = [
    ["prograde", "Prograde"],
    ["normal", "Normal"],
    [
        "radial",
        "Radial",
        "Away from the parent, at right angles to the velocity. It points straight out only on a circular orbit.",
    ],
];

const DEFAULT_STEP = 10;

const PREDICTED: [
    label: string,
    value: (p: Prediction, unit: AUnit | null) => string,
][] = [
    ["Periapsis altitude", (p, u) => formatDistance(p.periapsisAltitude, u)],
    ["Apoapsis altitude", (p, u) => formatDistance(p.apoapsisAltitude, u)],
    ["Period", (p) => formatDuration(p.period)],
];

/** The burn form for body `id`, or `null` if it has no orbit to burn on. */
export const createBurnEditor = (
    world: World,
    /** The distance unit the previews follow. The card calls `refresh` when it changes. */
    units: Units,
    id: string,
    /** Draws the orbit after the burn, or none with `null`. */
    ghost: (id: string, elements: Elements | null) => void,
    /** Called when the form is done, whether it burned or was cancelled. */
    done: () => void,
): BurnEditor | null => {
    // The scenario is replaced on every edit, so read it again each time.
    const context = () => {
        const body = world.scenario.bodies.find(
            (candidate) => candidate.id === id,
        );
        if (!body || body.parent === null) return null;
        const parent = world.scenario.bodies.find(
            (candidate) => candidate.id === body.parent,
        );
        if (!parent) return null;
        const el = elementsAt(body, world.clock.t);

        return { body, el, mu: parent.mu + body.mu, parent };
    };

    if (!context()) return null;

    let step = DEFAULT_STEP;
    let ghosted: Elements | null = null;
    let wasNonzero = false;
    // Only a pause this editor made is undone when the form closes.
    let pausedHere = false;
    const offClock = world.on((event) => {
        if (event.type === "clock" && !world.clock.paused) pausedHere = false;
    });

    // Any Δv is allowed; the step only sets how far − and + move it.
    const steppers = AXES.map(([axis, name, text]) => {
        const id = `orrery-burn-${axis}`;
        const hint = text
            ? h("p", { id: `${id}-hint`, class: "orrery__stepper-hint" }, text)
            : null;
        const stepper = createStepper({
            id,
            name: axis,
            label: name,
            unit: "m/s",
            value: "0",
            step: () => step,
            describedBy: hint ? [hint.id] : [],
            onInput: () => changed(),
            // An empty or half-typed field reads as 0, so it says so on blur.
            onChange: () => {
                if (stepper.input.value !== "") return;

                stepper.input.value = "0";
                changed();
            },
        });
        if (hint) stepper.element.append(hint);

        return [axis, stepper] as const;
    });
    const inputs = Object.fromEntries(
        steppers.map(([axis, stepper]) => [axis, stepper.input]),
    ) as Record<Axis, HTMLInputElement>;

    const stepControl = h(
        "fieldset",
        {
            class: segmentedClasses({ variant: "subtle" }).join(" "),
        },
        h("legend", { class: "visually-hidden" }, "Step"),
        ...STEPS.map((value) => {
            const radio = h("input", {
                class: "visually-hidden",
                type: "radio",
                name: "orrery-burn-step",
                value: String(value),
            });
            radio.checked = value === DEFAULT_STEP;
            radio.addEventListener("change", () => {
                step = value;
            });

            return h(
                "label",
                { class: "segmented__option" },
                radio,
                h(
                    "span",
                    { class: "segmented__text" },
                    String(value),
                    h("span", { class: "visually-hidden" }, " m/s"),
                ),
            );
        }),
    );

    const list = h("dl", {
        class: "orrery__readouts",
        "aria-labelledby": "orrery-burn-after",
    });
    const values = PREDICTED.map(([label]) => {
        const value = h("dd", { class: "orrery__readout" });
        list.append(h("dt", {}, label), value);

        return value;
    });
    const predictions = h(
        "div",
        {},
        h(
            "h3",
            { id: "orrery-burn-after", class: "orrery__burn-heading" },
            "After the burn",
        ),
        list,
    );
    predictions.hidden = true;

    const alert = createWarning();

    const goTo = (apsis: "periapsis" | "apoapsis") => {
        const button = h(
            "button",
            {
                type: "button",
                class: buttonClasses({
                    variant: "outline",
                    tone: "neutral",
                }).join(" "),
            },
            `Go to ${apsis}`,
        );
        button.addEventListener("click", () => {
            const c = context();
            if (!c) return;

            world.setClock({
                t: nextApsisTime(c.el, c.mu, world.clock.t, apsis),
                paused: true,
            });
        });

        return button;
    };

    const read = (): Burn => ({
        prograde: inputs.prograde.valueAsNumber || 0,
        normal: inputs.normal.valueAsNumber || 0,
        radial: inputs.radial.valueAsNumber || 0,
    });

    const showGhost = (next: Elements | null) => {
        if (next === null) {
            if (ghosted) ghost(id, null);
            ghosted = null;
        } else if (!ghosted || !sameElements(ghosted, next)) {
            ghost(id, next);
            ghosted = next;
        }
    };

    const update = () => {
        const c = context();
        if (!c) return;

        const dv = read();
        const result = isZero(dv) ? null : world.previewBurn(id, dv);

        predictions.hidden = !result?.ok;
        if (result?.ok) {
            const prediction = predict(result.elements, c.parent.radius, c.mu);
            PREDICTED.forEach(([, value], k) => {
                const text = value(prediction, units.get());
                const cell = values[k];
                if (cell && cell.textContent !== text) cell.textContent = text;
            });
        }

        alert.element.hidden = !result || result.ok;
        if (result && !result.ok) {
            alert.text.textContent = failureMessage(
                result.reason,
                c.parent.name,
                c.body.name,
            );
        }

        form.apply.disabled = !result?.ok;
        showGhost(result?.ok ? result.elements : null);
    };

    // The first nudge from zero stops the clock, so the burn is made where it's shown.
    const changed = () => {
        // A half-typed number like "-" reads as 0 but isn't a return to zero.
        if (Object.values(inputs).some((input) => input.validity.badInput)) {
            update();
            return;
        }

        const nonzero = !isZero(read());
        if (nonzero && !wasNonzero && !world.clock.paused) {
            world.setClock({ paused: true });
            pausedHere = true;
        }
        if (!nonzero) pausedHere = false;
        wasNonzero = nonzero;
        update();
    };

    const resume = () => {
        if (pausedHere && world.clock.paused) world.setClock({ paused: false });
        pausedHere = false;
    };

    const form = createForm(
        "orrery-orbit-title",
        [
            h(
                "fieldset",
                { class: "orrery__burn-dv" },
                h("legend", { class: "visually-hidden" }, "Δv"),
                h(
                    "div",
                    { class: "orrery__burn-step" },
                    h("span", { "aria-hidden": "true" }, "Step"),
                    stepControl,
                    h("span", { "aria-hidden": "true" }, "m/s"),
                ),
                ...steppers.map(([, stepper]) => stepper.element),
            ),
            h(
                "div",
                { class: "orrery__burn-actions" },
                goTo("periapsis"),
                goTo("apoapsis"),
            ),
            predictions,
            alert.element,
        ],
        () => {
            if (!world.burn(id, read()).ok) return;

            cue("edit");
            resume();
            done();
        },
        () => {
            for (const input of Object.values(inputs)) input.value = "0";
            wasNonzero = false;
            update();
            resume();
            done();
        },
    );
    form.apply.disabled = true;

    return {
        element: form.element,
        refresh: update,
        destroy: () => {
            showGhost(null);
            resume();
            offClock();
        },
    };
};
