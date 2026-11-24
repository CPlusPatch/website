import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { nudge } from "../burning.ts";
import type { AUnit } from "../editing.ts";
import { otherUnit } from "../units.ts";
import { h } from "./dom.ts";

/** A number field with − and + buttons, a unit and a line for an error. */
export type Stepper = {
    element: HTMLElement;
    input: HTMLInputElement;
    /** Shows `message` under the field, or clears it with `null`. */
    setError: (message: string | null) => void;
    /** Writes `unit` as the text of the unit, and as what its switch offers, if it is one. */
    setUnit: (unit: AUnit) => void;
};

export type StepperOptions = {
    id: string;
    /** The field's name, for the form data and the buttons' labels. */
    name: string;
    label: string;
    unit: string;
    /** Makes the unit a button that calls this, to switch between km and AU. */
    onUnit?: () => void;
    /** The text the field starts with. */
    value: string;
    /** How far − and + move the value. 1 by default. */
    step?: () => number;
    /** Moves the value one step up (`1`) or down (`-1`), in place of adding or subtracting `step`. */
    move?: (value: number, sign: 1 | -1) => number;
    /** The text of a value after − or +. */
    format?: (value: number) => string;
    /** Ids of other elements that describe the field, after its error. */
    describedBy?: string[];
    /** Called when the value changes, by typing or stepping. */
    onInput: () => void;
    /** Called when typing ends, or after a step. */
    onChange?: () => void;
};

/** A labelled stepper, as a row of a form. */
export const createStepper = ({
    id,
    name,
    label,
    unit,
    onUnit,
    value,
    step = () => 1,
    move: stepBy,
    format = String,
    describedBy = [],
    onInput,
    onChange,
}: StepperOptions): Stepper => {
    const errorId = `${id}-error`;
    const input = h("input", {
        id,
        name,
        type: "number",
        inputmode: "decimal",
        step: "any",
        value,
        "aria-describedby": [errorId, ...describedBy].join(" "),
    });
    const error = h("p", { class: "orrery__stepper-error", id: errorId });
    error.hidden = true;

    const move = (sign: 1 | -1) => {
        // Stepping from a blank or half-typed value would replace it with the step.
        if (Number.isNaN(input.valueAsNumber)) {
            return;
        }

        const { valueAsNumber } = input;

        input.value = format(
            stepBy
                ? stepBy(valueAsNumber, sign)
                : nudge(valueAsNumber, sign * step()),
        );
        onInput();
        onChange?.();
    };
    const button = (sign: 1 | -1) => {
        const control = h(
            "button",
            {
                type: "button",
                class: "orrery__stepper-step",
                "aria-label": `${sign === 1 ? "Increase" : "Decrease"} ${label.toLowerCase()}`,
            },
            sign === 1 ? "+" : "−",
        );
        control.addEventListener("click", () => move(sign));

        return control;
    };

    input.addEventListener("input", onInput);
    if (onChange) input.addEventListener("change", onChange);
    // The native arrows would move by 1, whatever the step is.
    input.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

        event.preventDefault();
        move(event.key === "ArrowUp" ? 1 : -1);
    });

    const unitText = onUnit
        ? h("button", {
              type: "button",
              class: "orrery__stepper-unit orrery__unit-switch",
          })
        : h("span", { class: "orrery__stepper-unit" });
    const setUnit = (next: AUnit) => {
        unitText.textContent = next;
        if (!onUnit) return;

        const other = otherUnit(next);
        unitText.setAttribute(
            "aria-label",
            `${next}. Show ${label.toLowerCase()} in ${other}`,
        );
        unitText.title = `Show in ${other} (U)`;
    };
    unitText.textContent = unit;
    if (onUnit) {
        // A switch's unit is km or AU.
        setUnit(unit === "km" ? "km" : "AU");
        unitText.addEventListener("click", onUnit);
    }

    const element = h(
        "div",
        { class: "orrery__form-row" },
        h("label", { for: id }, label),
        h(
            "div",
            { class: "orrery__stepper" },
            button(-1),
            input,
            unitText,
            button(1),
        ),
        error,
    );

    return {
        element,
        input,
        setError: (message) => {
            error.textContent = message ?? "";
            error.hidden = message === null;
            input.setAttribute("aria-invalid", String(message !== null));
        },
        setUnit,
    };
};

/** A form that ends in Cancel and Apply buttons. */
export type Form = {
    element: HTMLFormElement;
    apply: HTMLButtonElement;
    /** The Cancel and Apply row, inside the form unless it was built as a footer. */
    actions: HTMLElement;
};

/** The form of the orbit card: `children`, then Cancel and Apply. */
export const createForm = (
    /** The id of the element that names the form. */
    labelledBy: string,
    children: Node[],
    /** Called on Apply, or Enter in a field. */
    onApply: () => void,
    /** Called on Cancel and Esc. */
    onCancel: () => void,
    /** The text of the submit button. */
    applyLabel = "Apply",
    /** The form's id. With it, the actions are a pinned footer that the caller places outside. */
    footerFor?: string,
): Form => {
    const cancel = h(
        "button",
        {
            type: "button",
            class: buttonClasses({ variant: "outline", tone: "neutral" }).join(
                " ",
            ),
        },
        "Cancel",
    );
    const apply = h(
        "button",
        {
            type: "submit",
            class: buttonClasses().join(" "),
            ...(footerFor ? { form: footerFor } : {}),
        },
        applyLabel,
    );
    const actions = footerFor
        ? h(
              "div",
              { class: "orrery__inspector-foot orrery__inspector-foot--form" },
              cancel,
              apply,
          )
        : h("div", { class: "orrery__form-actions" }, cancel, apply);
    const element = h(
        "form",
        {
            class: "orrery__form",
            novalidate: "",
            "aria-labelledby": labelledBy,
            ...(footerFor ? { id: footerFor } : {}),
        },
        ...children,
        ...(footerFor ? [] : [actions]),
    );

    cancel.addEventListener("click", onCancel);
    element.addEventListener("submit", (event) => {
        event.preventDefault();
        onApply();
    });
    const onKeydown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;

        // The shortcut that clears the selection skips a handled key.
        event.preventDefault();
        event.stopPropagation();
        onCancel();
    };
    element.addEventListener("keydown", onKeydown);
    if (footerFor) actions.addEventListener("keydown", onKeydown);

    return { element, apply, actions };
};
