import type { Burn, Elements } from "@cpluspatch/orbit";
import { nextApsisTime } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { segmentedClasses } from "@cpluspatch/ui/components/segmented-control.ts";
import {
    failureMessage,
    isZero,
    nudge,
    type Prediction,
    predict,
    STEPS,
    sameElements,
} from "../burning.ts";
import { formatDistance, formatDuration } from "../format.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";
import { createWarning } from "./warning.ts";

/** The Burn section's element and how to update and remove it. */
export type BurnEditor = {
    /** The Burn section. */
    elements: HTMLElement[];
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

const PREDICTED: [label: string, value: (p: Prediction) => string][] = [
    ["Periapsis altitude", (p) => formatDistance(p.periapsisAltitude)],
    ["Apoapsis altitude", (p) => formatDistance(p.apoapsisAltitude)],
    ["Period", (p) => formatDuration(p.period)],
];

/** The Burn section for body `id`, or `null` if it has no orbit to burn on. */
export const createBurnEditor = (
    world: World,
    id: string,
    /** Draws the orbit after the burn, or none with `null`. */
    ghost: (id: string, elements: Elements | null) => void,
): BurnEditor | null => {
    // The scenario is replaced on every edit, so read it again each time.
    const context = () => {
        const body = world.scenario.bodies.find(
            (candidate) => candidate.id === id,
        );
        const parent = world.scenario.bodies.find(
            (candidate) => candidate.id === body?.parent,
        );
        if (!body?.elements || !parent) return null;

        return { body, el: body.elements, mu: parent.mu + body.mu, parent };
    };

    if (!context()) return null;

    let step = DEFAULT_STEP;
    let ghosted: Elements | null = null;
    let wasNonzero = false;

    const move = (axis: Axis, delta: number) => {
        const input = inputs[axis];
        input.value = String(nudge(input.valueAsNumber, delta));
        changed();
    };

    const stepButton = (axis: Axis, name: string, sign: 1 | -1) => {
        const button = h("button", {
            type: "button",
            class: buttonClasses({
                variant: "outline",
                tone: "neutral",
                size: "icon",
            }).join(" "),
            "aria-label": `${
                sign === 1 ? "More" : "Less"
            } ${name.toLowerCase()}`,
        });
        button.textContent = sign === 1 ? "+" : "−";
        button.addEventListener("click", () => move(axis, sign * step));

        return button;
    };

    // Any Δv is allowed; the step only sets how far − and + move it.
    const makeInput = (axis: Axis) => {
        const input = h("input", {
            id: `orrery-burn-${axis}`,
            type: "number",
            class: "field input orrery__editor-number",
            value: "0",
            step: "any",
        });
        // An empty or half-typed field reads as 0, so it says so on blur.
        input.addEventListener("change", () => {
            if (input.value !== "") return;

            input.value = "0";
            changed();
        });
        input.addEventListener("input", () => changed());
        // The native arrows would move by 1, whatever the step is.
        input.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            move(axis, event.key === "ArrowUp" ? step : -step);
        });

        return input;
    };

    const inputs: Record<Axis, HTMLInputElement> = {
        prograde: makeInput("prograde"),
        normal: makeInput("normal"),
        radial: makeInput("radial"),
    };

    const rows = AXES.map(([axis, name, text]) => {
        const input = inputs[axis];
        const label = h("label", { for: input.id }, `${name} (m/s)`);
        let hint: HTMLElement | null = null;
        if (text) {
            hint = h(
                "p",
                { id: `${input.id}-hint`, class: "orrery__editor-hint" },
                text,
            );
            input.setAttribute("aria-describedby", hint.id);
        }

        return h(
            "div",
            { class: "orrery__editor-row" },
            label,
            h(
                "div",
                { class: "orrery__editor-controls" },
                stepButton(axis, name, -1),
                input,
                stepButton(axis, name, 1),
            ),
            ...(hint ? [hint] : []),
        );
    });

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

    const apply = h(
        "button",
        {
            type: "button",
            class: buttonClasses().join(" "),
        },
        "Apply",
    );
    apply.disabled = true;
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
                const text = value(prediction);
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

        apply.disabled = !result?.ok;
        pending.hidden = element.open || isZero(dv);
        footer.hidden = !element.open;
        // A closed section hides its preview, so it hides the ghost too.
        showGhost(result?.ok && element.open ? result.elements : null);
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
        }
        wasNonzero = nonzero;
        update();
    };

    apply.addEventListener("click", () => {
        if (!world.burn(id, read()).ok) return;

        // Apply is disabled next, which would drop focus to <body>.
        inputs.prograde.focus();
        for (const input of Object.values(inputs)) input.value = "0";
        changed();
    });

    const pending = h("span", { class: "orrery__burn-pending" }, "Δv set");
    pending.hidden = true;
    const chevron = h("span");
    chevron.innerHTML = iconSvg("chevron-down");
    const element = h(
        "details",
        { class: "orrery__editor orrery__burn" },
        h("summary", {}, "Burn", pending, chevron),
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
            ...rows,
        ),
        // Here, not in the footer, since they go to the current orbit's apsides.
        h(
            "div",
            { class: "orrery__burn-actions" },
            goTo("periapsis"),
            goTo("apoapsis"),
        ),
    );
    // Outside the <details>, so it sticks to the card's bottom even when the section starts below the fold.
    const footer = h(
        "div",
        {
            class: "orrery__burn-footer",
            role: "group",
            "aria-label": "Burn result",
        },
        predictions,
        alert.element,
        h("div", { class: "orrery__burn-actions" }, apply),
    );
    footer.hidden = true;

    // Focus scrolling keeps fields clear of the footer that covers the card's bottom.
    const footerSize = new ResizeObserver(() => {
        footer.parentElement?.style.setProperty(
            "scroll-padding-block-end",
            `${footer.offsetHeight}px`,
        );
    });
    footerSize.observe(footer);

    element.addEventListener("toggle", () => {
        update();
        // Otherwise the footer that just appeared covers the section.
        if (element.open) element.scrollIntoView({ block: "start" });
    });

    return {
        elements: [element, footer],
        refresh: update,
        destroy: () => {
            showGhost(null);
            footerSize.disconnect();
            footer.parentElement?.style.removeProperty(
                "scroll-padding-block-end",
            );
            element.remove();
            footer.remove();
        },
    };
};
