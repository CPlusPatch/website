import { builtInScenarios } from "@cpluspatch/catalog";
import { cue } from "../../audio/cues.ts";
import {
    encodeScenario,
    HASH_PREFIX,
    MAX_INFLATED_BYTES,
    MAX_PAYLOAD_CHARS,
    nameProblem,
    parseScenarioJson,
    readList,
    SAVED_CHANGED,
    type SavedScenario,
    type SavedStorage,
    startTime,
    writeList,
} from "../../persistence.ts";
import type { World } from "../../world.ts";
import { h } from "../dom.ts";
import { createArming } from "./buttons.ts";
import { createScenarioDialog } from "./dialog.ts";
import { current, download, fileName } from "./files.ts";
import { renderBuiltIn, renderSaved } from "./saved-list.ts";

/** The most import errors the dialog lists. */
const MAX_SHOWN_ERRORS = 20;

/** The Scenarios dialog, the top bar button that opens it and how to remove them. */
export type Scenarios = {
    toggle: HTMLButtonElement;
    destroy: () => void;
};

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

    const {
        toggle,
        closeButton,
        builtIn,
        list,
        nameInput,
        nameError,
        form,
        linkInput,
        copy,
        file,
        status,
        dialog,
    } = createScenarioDialog();
    root.append(dialog);
    renderBuiltIn(builtIn, builtInScenarios);

    let saved: SavedScenario[] = [];
    // Each open takes an id, so a link that finishes late can tell it's stale.
    let linkId = 0;
    let pressedOn: EventTarget | null = null;

    const setStatus = (...content: (Node | string)[]) => {
        status.replaceChildren(...content);
    };

    const { arm, disarm, armed } = createArming(setStatus);

    const render = () => renderSaved(list, saved);

    const buildLink = () => {
        const id = ++linkId;
        linkInput.value = "";
        copy.disabled = true;

        encodeScenario(current(world)).then(
            (payload) => {
                if (id !== linkId) return;

                if (payload.length > MAX_PAYLOAD_CHARS) {
                    setStatus(
                        "The scenario is too big to share as a link. Use Export instead.",
                    );
                    return;
                }

                const { origin, pathname, search } = location;
                linkInput.value = `${origin}${pathname}${search}${HASH_PREFIX}${payload}`;
                copy.disabled = false;
            },
            () => {
                if (id !== linkId) return;

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
        window.dispatchEvent(new Event(SAVED_CHANGED));
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
        window.dispatchEvent(new Event(SAVED_CHANGED));
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
            if (chosen.size > MAX_INFLATED_BYTES) {
                setStatus("The file is too big to be a scenario.");
                return;
            }

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
            const shown = result.errors.slice(0, MAX_SHOWN_ERRORS);
            const more = result.errors.length - shown.length;

            setStatus(
                h("p", {}, "The file isn't a valid scenario:"),
                h(
                    "ul",
                    {},
                    ...shown.map((error) => h("li", {}, error)),
                    ...(more > 0 ? [h("li", {}, `and ${more} more`)] : []),
                ),
            );
            return;
        }

        cue("load");
        world.load(result.scenario, startTime(result.scenario));
        close();
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(linkInput.value);
            setStatus("Copied the link.");
        } catch {
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
            if (armed() && armed() !== pressed) disarm();

            if (pressed === closeButton) {
                close();
            } else if (pressed === copy) {
                void copyLink();
            } else if (pressed) {
                const { action, index } = pressed.dataset;

                if (action === "built-in") {
                    const scenario = builtInScenarios[Number(index)];
                    if (!scenario) return;

                    cue("load");
                    world.load(scenario, startTime(scenario));
                    close();
                } else if (action === "load") {
                    const entry = saved[Number(index)];
                    if (!entry) return;

                    cue("load");
                    world.load(entry.scenario, startTime(entry.scenario));
                    close();
                } else if (action === "delete") {
                    const name = saved[Number(index)]?.scenario.name;
                    if (name === undefined) return;

                    if (armed() === pressed) {
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
