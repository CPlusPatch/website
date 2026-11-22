import { j2000sToUnixMs, solarSystem, unixMsToJ2000s } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import {
    encodeScenario,
    HASH_PREFIX,
    nameProblem,
    parseScenarioJson,
    readList,
    type SavedScenario,
    type SavedStorage,
    startTime,
    writeList,
} from "../persistence.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";

/** The Scenarios dialog, the top bar button that opens it and how to remove them. */
export type Scenarios = {
    toggle: HTMLButtonElement;
    destroy: () => void;
};

/** The scenario as it is now, with the clock's time. */
const current = (world: World) => ({
    ...world.scenario,
    time: world.clock.t,
});

/** The file name for a scenario called `name`. */
const fileName = (name: string): string => {
    // Control characters and the ones most file systems refuse.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: that's the point
    const safe = name.replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "").trim();

    return `${safe || "scenario"}.orrery.json`;
};

const download = (filename: string, text: string): void => {
    const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
    );
    const link = h("a", { href: url, download: filename });

    // Firefox ignores a click on an anchor that isn't in the document.
    document.body.append(link);
    link.click();
    link.remove();
    // The download may not have started yet.
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

const button = (
    label: string,
    variant: "solid" | "outline" | "ghost",
    attributes: Record<string, string> = {},
    className?: string,
): HTMLButtonElement =>
    h(
        "button",
        {
            type: "button",
            class: buttonClasses({
                variant,
                tone: variant === "solid" ? "primary" : "neutral",
                size: "sm",
                class: className
                    ? `orrery__small-button ${className}`
                    : "orrery__small-button",
            }).join(" "),
            ...attributes,
        },
        label,
    );

/** The meta line of a saved scenario, like "12 bodies · 2026-11-22". */
const meta = ({ savedAt, scenario }: SavedScenario): string => {
    const count = scenario.bodies.length;
    const date = new Date(j2000sToUnixMs(startTime(scenario, savedAt)))
        .toISOString()
        .slice(0, 10);

    return `${count} ${count === 1 ? "body" : "bodies"} · ${date}`;
};

/** A button that asks to be pressed twice, and what to put back when it's disarmed. */
type Armed = { button: HTMLButtonElement; label: string; aria: string | null };

/**
 * Builds the Scenarios dialog in `root`, and the button that opens it.
 * The caller puts the button in the top bar. Its Add a body button calls `openAdd`.
 */
export const createScenarios = (
    root: HTMLElement,
    world: World,
    storage: SavedStorage,
    /** Opens the Add body form. */
    openAdd: () => void,
): Scenarios => {
    const abort = new AbortController();
    const { signal } = abort;

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
    root.append(dialog);

    let saved: SavedScenario[] = [];
    let armed: Armed | null = null;
    // Each open takes an id, so a link that finishes late can tell it's stale.
    let linkId = 0;
    let pressedOn: EventTarget | null = null;

    const setStatus = (...content: (Node | string)[]) => {
        status.replaceChildren(...content);
    };

    const arm = (
        target: HTMLButtonElement,
        message: string,
        aria: string | null = null,
    ) => {
        armed = {
            button: target,
            label: target.textContent ?? "",
            aria: target.getAttribute("aria-label"),
        };
        target.textContent = "Confirm";
        if (aria !== null) target.setAttribute("aria-label", aria);
        setStatus(message);
    };

    const disarm = () => {
        if (!armed) return;

        armed.button.textContent = armed.label;
        if (armed.aria !== null) {
            armed.button.setAttribute("aria-label", armed.aria);
        }
        armed = null;
    };

    const render = () => {
        if (saved.length === 0) {
            list.replaceChildren(
                h("p", { class: "orrery__form-hint" }, "Nothing saved yet."),
            );

            return;
        }

        const rows = saved
            .map((entry, index) => ({ entry, index }))
            .sort((a, b) => b.entry.savedAt - a.entry.savedAt)
            .map(({ entry, index }) => {
                const { name } = entry.scenario;

                return h(
                    "li",
                    { class: "orrery__scenarios-row" },
                    h(
                        "div",
                        {},
                        h("strong", {}, name),
                        h("small", {}, meta(entry)),
                    ),
                    button("Load", "outline", {
                        "data-action": "load",
                        "data-index": String(index),
                    }),
                    button(
                        "Delete",
                        "ghost",
                        {
                            "data-action": "delete",
                            "data-index": String(index),
                            "aria-label": `Delete ${name}`,
                        },
                        "orrery__scenarios-quiet orrery__orbit-quiet",
                    ),
                );
            });

        list.replaceChildren(
            h("ul", { class: "orrery__scenarios-list" }, ...rows),
        );
    };

    const buildLink = () => {
        const id = ++linkId;
        linkInput.value = "";
        copy.disabled = true;

        encodeScenario(current(world)).then(
            (payload) => {
                if (id !== linkId) return;

                const { origin, pathname, search } = location;
                linkInput.value = `${origin}${pathname}${search}${HASH_PREFIX}${payload}`;
                copy.disabled = false;
            },
            (error) => {
                if (id !== linkId) return;

                console.warn("The Orrery couldn't make the link.", error);
                setStatus("The link couldn't be made.");
            },
        );
    };

    const open = () => {
        if (dialog.open) return;

        setStatus();
        showNameError(null);
        saved = readList(storage);
        render();
        buildLink();
        dialog.showModal();
    };

    const close = () => {
        if (dialog.open) dialog.close();
    };

    const showNameError = (problem: string | null) => {
        nameInput.setAttribute("aria-invalid", String(problem !== null));
        nameError.textContent = problem ?? "";
        nameError.hidden = problem === null;
    };

    const save = () => {
        const name = nameInput.value.trim();
        const problem = nameProblem(saved, name);
        showNameError(problem);
        if (problem) {
            nameInput.focus();

            return;
        }

        const next = [
            ...saved,
            {
                savedAt: Date.now(),
                scenario: { ...world.scenario, name, time: world.clock.t },
            },
        ];
        if (!writeList(storage, next)) {
            setStatus("The browser wouldn't save it.");

            return;
        }

        saved = next;
        nameInput.value = "";
        render();
        setStatus(`Saved ${name}.`);
    };

    const remove = (index: number) => {
        const gone = saved[index];
        if (!gone) return;

        const next = saved.filter((_, at) => at !== index);
        if (!writeList(storage, next)) {
            setStatus("The browser wouldn't save it.");

            return;
        }

        saved = next;
        render();
        setStatus(`Deleted ${gone.scenario.name}.`);
        nameInput.focus();
    };

    const exportJson = () => {
        const scenario = current(world);
        const name = fileName(scenario.name);

        download(name, JSON.stringify(scenario, null, 2));
        setStatus(`Exported ${name}.`);
    };

    const importFile = async () => {
        const [chosen] = file.files ?? [];
        if (!chosen) return;

        let text: string;
        try {
            text = await chosen.text();
        } catch {
            setStatus("The file couldn't be read.");
            return;
        } finally {
            // So choosing the same file again still fires `change`.
            file.value = "";
        }

        const result = parseScenarioJson(text);
        if (!result.ok) {
            setStatus(
                h("p", {}, "The file isn't a valid scenario:"),
                h(
                    "ul",
                    {},
                    ...result.errors.map((error) => h("li", {}, error)),
                ),
            );
            return;
        }

        world.load(result.scenario, startTime(result.scenario));
        close();
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(linkInput.value);
            setStatus("Copied the link.");
        } catch (error) {
            console.warn("The Orrery couldn't copy the link.", error);
            linkInput.select();
            setStatus(
                "Couldn't copy. The link is selected, so copy it with your keyboard.",
            );
        }
    };

    dialog.addEventListener(
        "click",
        (event) => {
            // The dialog has no padding, so a click on it itself is on the backdrop.
            // A drag that starts in a field and ends outside also clicks the dialog.
            if (event.target === dialog && pressedOn === dialog) {
                close();

                return;
            }

            const pressed =
                event.target instanceof Element
                    ? event.target.closest("button")
                    : null;
            if (armed && armed.button !== pressed) disarm();

            if (pressed === closeButton) {
                close();
            } else if (pressed === copy) {
                void copyLink();
            } else if (pressed) {
                const { action, index } = pressed.dataset;

                if (action === "load") {
                    const entry = saved[Number(index)];
                    if (!entry) return;

                    world.load(entry.scenario, startTime(entry.scenario));
                    close();
                } else if (action === "delete") {
                    const name = saved[Number(index)]?.scenario.name;
                    if (name === undefined) return;

                    if (armed?.button === pressed) {
                        disarm();
                        remove(Number(index));
                    } else {
                        arm(
                            pressed,
                            `Press Confirm to delete ${name}.`,
                            `Confirm deleting ${name}`,
                        );
                    }
                } else if (action === "import") {
                    file.click();
                } else if (action === "export") {
                    exportJson();
                } else if (action === "reset") {
                    if (armed?.button === pressed) {
                        disarm();
                        world.load(solarSystem, unixMsToJ2000s(Date.now()));
                        close();
                    } else {
                        arm(
                            pressed,
                            "Press Confirm to reset to the solar system now.",
                        );
                    }
                } else if (action === "add") {
                    close();
                    openAdd();
                }
            }
        },
        { signal },
    );
    dialog.addEventListener(
        "pointerdown",
        (event) => {
            pressedOn = event.target;
        },
        { signal },
    );
    form.addEventListener(
        "submit",
        (event) => {
            event.preventDefault();
            save();
        },
        { signal },
    );
    file.addEventListener("change", () => void importFile(), { signal });
    // Esc and the close button both end here.
    dialog.addEventListener("close", disarm, { signal });
    toggle.addEventListener("click", open, { signal });

    const off = world.on((event) => {
        if (event.type === "scenario") close();
    });

    return {
        toggle,
        destroy: () => {
            abort.abort();
            off();
            close();
            dialog.remove();
            toggle.remove();
        },
    };
};
