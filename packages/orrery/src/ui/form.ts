import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { nudge } from "../burning.ts";
import { h } from "./dom.ts";

/** A number field with − and + buttons, a unit and a line for an error. */
export type Stepper = {
    element: HTMLElement;
    input: HTMLInputElement;
    /** Shows `message` under the field, or clears it with `null`. */
    setError: (message: string | null) => void;
};

export type StepperOptions = {
    id: string;
    /** The field's name, for the form data and the buttons' labels. */
    name: string;
    label: string;
    unit: string;
    /** The text the field starts with. */
    value: string;
    /** How far − and + move the value. */
    step: () => number;
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
    value,
    step,
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

    const move = (delta: number) => {
        // Stepping from a blank or half-typed value would replace it with the step.
        if (Number.isNaN(input.valueAsNumber)) {
            return;
        }

        input.value = format(nudge(input.valueAsNumber, delta));
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
        control.addEventListener("click", () => move(sign * step()));

        return control;
    };

    input.addEventListener("input", onInput);
    if (onChange) input.addEventListener("change", onChange);
    // The native arrows would move by 1, whatever the step is.
    input.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

        event.preventDefault();
        move(event.key === "ArrowUp" ? step() : -step());
    });

    const element = h(
        "div",
        { class: "orrery__form-row" },
        h("label", { for: id }, label),
        h(
            "div",
            { class: "orrery__stepper" },
            button(-1),
            input,
            h("span", { class: "orrery__stepper-unit" }, unit),
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
    };
};

/** A form that ends in Cancel and Apply buttons. */
export type Form = {
    element: HTMLFormElement;
    apply: HTMLButtonElement;
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
        { type: "submit", class: buttonClasses().join(" ") },
        "Apply",
    );
    const element = h(
        "form",
        {
            class: "orrery__form",
            novalidate: "",
            "aria-labelledby": labelledBy,
        },
        ...children,
        h("div", { class: "orrery__form-actions" }, cancel, apply),
    );

    cancel.addEventListener("click", onCancel);
    element.addEventListener("submit", (event) => {
        event.preventDefault();
        onApply();
    });
    element.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;

        // The shortcut that clears the selection skips a handled key.
        event.preventDefault();
        event.stopPropagation();
        onCancel();
    });

    return { element, apply };
};
