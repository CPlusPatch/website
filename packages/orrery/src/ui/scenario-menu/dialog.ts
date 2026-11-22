import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { h } from "../dom.ts";
import { button } from "./buttons.ts";

/** The dialog's elements, and the ones the menu reads or listens to. */
export type ScenarioDialog = {
    toggle: HTMLButtonElement;
    closeButton: HTMLButtonElement;
    list: HTMLElement;
    nameInput: HTMLInputElement;
    nameError: HTMLElement;
    form: HTMLFormElement;
    linkInput: HTMLInputElement;
    copy: HTMLButtonElement;
    file: HTMLInputElement;
    status: HTMLElement;
    dialog: HTMLDialogElement;
};

/** Builds the Scenarios dialog and the top bar button that opens it. */
export const createScenarioDialog = (): ScenarioDialog => {
    const toolIcon = h("span", { class: "orrery__tool-icon" });
    toolIcon.innerHTML = iconSvg("bookmark");
    const toggle = h(
        "button",
        {
            type: "button",
            class: "orrery__tool",
            "aria-haspopup": "dialog",
        },
        toolIcon,
        h("span", { class: "orrery__tool-label" }, "Scenarios"),
    );

    const closeButton = h("button", {
        type: "button",
        class: buttonClasses({
            variant: "ghost",
            tone: "neutral",
            size: "icon-sm",
        }).join(" "),
        "aria-label": "Close scenarios",
    });
    closeButton.innerHTML = iconSvg("x");

    const list = h("div", { class: "orrery__scenarios-saved" });

    const nameInput = h("input", {
        id: "orrery-scenario-name",
        type: "text",
        autocomplete: "off",
        placeholder: "Name",
        "aria-describedby": "orrery-scenario-error",
    });
    const nameError = h("p", {
        class: "orrery__stepper-error",
        id: "orrery-scenario-error",
    });
    nameError.hidden = true;
    const form = h(
        "form",
        { class: "orrery__form-row", novalidate: "" },
        h("label", { for: nameInput.id }, "Save the current view as"),
        h(
            "div",
            { class: "orrery__stepper" },
            nameInput,
            button("Save", "solid", { type: "submit" }),
        ),
        nameError,
    );

    const linkInput = h("input", {
        id: "orrery-scenario-link",
        type: "text",
        readonly: "",
        class: "orrery__scenarios-link",
    });
    const copy = button("Copy", "outline");
    copy.disabled = true;

    const file = h("input", {
        type: "file",
        accept: ".json,application/json",
        hidden: "",
    });
    const status = h("div", {
        class: "orrery__form-hint orrery__scenarios-status",
        role: "status",
    });

    const importButton = button("Import", "ghost", { "data-action": "import" });
    const exportButton = button("Export", "ghost", { "data-action": "export" });
    const resetButton = button("Reset", "ghost", { "data-action": "reset" });
    const addButton = button("Add a body", "ghost", { "data-action": "add" });

    const dialog = h(
        "dialog",
        {
            id: "orrery-scenarios",
            class: "orrery__scenarios",
            "aria-labelledby": "orrery-scenarios-title",
        },
        h(
            "div",
            { class: "orrery__inspector-head orrery__inspector-head--panel" },
            h(
                "h2",
                { class: "orrery__panel-title", id: "orrery-scenarios-title" },
                "Scenarios",
            ),
            closeButton,
        ),
        h(
            "div",
            { class: "orrery__scenarios-body" },
            list,
            form,
            h(
                "div",
                { class: "orrery__form-row" },
                h("label", { for: linkInput.id }, "Share link"),
                h("div", { class: "orrery__stepper" }, linkInput, copy),
            ),
            h(
                "div",
                { class: "orrery__scenarios-actions" },
                importButton,
                exportButton,
                resetButton,
                addButton,
            ),
            status,
            file,
        ),
    );

    return {
        toggle,
        closeButton,
        list,
        nameInput,
        nameError,
        form,
        linkInput,
        copy,
        file,
        status,
        dialog,
    };
};
