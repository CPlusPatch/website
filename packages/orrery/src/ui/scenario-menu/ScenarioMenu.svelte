<script lang="ts">
import { builtInScenarios } from "@cpluspatch/catalog";
import type { Scenario } from "@cpluspatch/sim";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
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
import { getDocument, getView } from "../../state/context.ts";
import { download, fileName } from "./files.ts";
import { bodyCount, savedMeta } from "./rows.ts";

type Props = {
    storage: SavedStorage;
    /** Opens the Add body form. */
    openAdd: () => void;
};

/** What the status line shows: nothing, a message, or the errors of an invalid file. */
type Status = string | { invalid: string[] } | null;

/** The most import errors the dialog lists. */
const MAX_SHOWN_ERRORS = 20;

const { storage, openAdd }: Props = $props();

const documents = getDocument();
const view = getView();

let dialog: HTMLDialogElement | undefined;
let nameInput: HTMLInputElement | undefined;
let linkInput: HTMLInputElement | undefined;
let file: HTMLInputElement | undefined;

let saved = $state.raw<SavedScenario[]>([]);
let name = $state("");
let nameError = $state<string | null>(null);
let link = $state("");
let status = $state.raw<Status>(null);
// The index in `saved` of the Delete button waiting for its second press.
let armed = $state<number | null>(null);

// Each open takes an id, so a link that finishes late can tell it's stale.
let linkId = 0;
let pressedOn: EventTarget | null = null;

const rows = $derived(
    saved
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => b.entry.savedAt - a.entry.savedAt),
);

const classes = (
    variant: "solid" | "outline" | "ghost",
    className?: string,
): string =>
    buttonClasses({
        variant,
        tone: variant === "solid" ? "primary" : "neutral",
        size: "sm",
        class: className
            ? `orrery__small-button ${className}`
            : "orrery__small-button",
    }).join(" ");

const closeClasses = buttonClasses({
    variant: "ghost",
    tone: "neutral",
    size: "icon-sm",
}).join(" ");

/** The scenario as it is now, with the clock's time. */
const current = (): Scenario => ({
    ...documents.doc.scenario,
    time: view.now(),
});

const close = () => {
    if (dialog?.open) dialog.close();
};

const buildLink = () => {
    const id = ++linkId;
    link = "";

    encodeScenario(current()).then(
        (payload) => {
            if (id !== linkId) return;

            if (payload.length > MAX_PAYLOAD_CHARS) {
                status =
                    "The scenario is too big to share as a link. Use Export instead.";
                return;
            }

            const { origin, pathname, search } = location;
            link = `${origin}${pathname}${search}${HASH_PREFIX}${payload}`;
        },
        () => {
            if (id !== linkId) return;

            status = "The link couldn't be made.";
        },
    );
};

const open = () => {
    if (!dialog || dialog.open) return;

    status = null;
    nameError = null;
    saved = readList(storage);
    buildLink();
    dialog.showModal();
};

const loadScenario = (scenario: Scenario) => {
    cue("load");
    documents.load(scenario, startTime(scenario));
    close();
};

const save = () => {
    const trimmed = name.trim();
    const problem = nameProblem(saved, trimmed);
    nameError = problem;
    if (problem) {
        nameInput?.focus();

        return;
    }

    const next = [
        ...saved,
        {
            savedAt: Date.now(),
            scenario: {
                ...documents.doc.scenario,
                name: trimmed,
                time: view.now(),
            },
        },
    ];
    if (!writeList(storage, next)) {
        status = "The browser wouldn't save it.";

        return;
    }

    saved = next;
    window.dispatchEvent(new Event(SAVED_CHANGED));
    name = "";
    status = `Saved ${trimmed}.`;
};

const remove = (index: number) => {
    const gone = saved[index];
    if (!gone) return;

    const next = saved.filter((_, at) => at !== index);
    if (!writeList(storage, next)) {
        status = "The browser wouldn't save it.";

        return;
    }

    saved = next;
    window.dispatchEvent(new Event(SAVED_CHANGED));
    status = `Deleted ${gone.scenario.name}.`;
    nameInput?.focus();
};

/** Press-twice: the first press arms the button, the second deletes. */
const pressDelete = (index: number) => {
    const target = saved[index]?.scenario.name;
    if (target === undefined) return;

    if (armed === index) {
        armed = null;
        remove(index);
    } else {
        armed = index;
        status = `Press Confirm to delete ${target}.`;
    }
};

const exportJson = () => {
    const scenario = current();
    const fileLabel = fileName(scenario.name);

    download(fileLabel, JSON.stringify(scenario, null, 2));
    status = `Exported ${fileLabel}.`;
};

const importFile = async () => {
    const [chosen] = file?.files ?? [];
    if (!file || !chosen) return;

    let text: string;
    try {
        if (chosen.size > MAX_INFLATED_BYTES) {
            status = "The file is too big to be a scenario.";
            return;
        }

        text = await chosen.text();
    } catch {
        status = "The file couldn't be read.";
        return;
    } finally {
        // So choosing the same file again still fires `change`.
        file.value = "";
    }

    const result = parseScenarioJson(text);
    if (!result.ok) {
        status = { invalid: result.errors };
        return;
    }

    loadScenario(result.scenario);
};

const copyLink = async () => {
    try {
        await navigator.clipboard.writeText(link);
        status = "Copied the link.";
    } catch {
        linkInput?.select();
        status =
            "Couldn't copy. The link is selected, so copy it with your keyboard.";
    }
};

const addBody = () => {
    close();
    openAdd();
};

const dialogEvents: Attachment<HTMLDialogElement> = (node) => {
    const offs = [
        on(node, "pointerdown", (event) => {
            pressedOn = event.target;
        }),
        on(node, "click", (event) => {
            // The dialog has no padding, so a click on it itself is on the backdrop.
            // A drag that starts in a field and ends outside also clicks the dialog.
            if (event.target === node && pressedOn === node) {
                close();

                return;
            }

            const pressed =
                event.target instanceof Element
                    ? event.target.closest("button")
                    : null;
            const isArmed =
                pressed?.dataset.action === "delete" &&
                Number(pressed.dataset.index) === armed;
            if (armed !== null && !isArmed) armed = null;
        }),
        // Esc and the close button both end here.
        on(node, "close", () => {
            armed = null;
        }),
    ];

    return () => {
        for (const off of offs) off();
        if (node.open) node.close();
    };
};

// A scenario can load from anywhere, like a link in the address bar.
let seenLoads = documents.loads;
$effect(() => {
    const loads = documents.loads;
    if (loads === seenLoads) return;

    seenLoads = loads;
    close();
});
</script>

<button
    type="button"
    class="orrery__tool"
    aria-haspopup="dialog"
    onclick={open}
>
    <span class="orrery__tool-icon">{@html iconSvg("bookmark")}</span
    ><span class="orrery__tool-label">Scenarios</span>
</button>
<dialog
    bind:this={dialog}
    id="orrery-scenarios"
    class="orrery__scenarios"
    aria-labelledby="orrery-scenarios-title"
    {@attach dialogEvents}
>
    <div class="orrery__inspector-head orrery__inspector-head--panel">
        <h2 class="orrery__panel-title" id="orrery-scenarios-title">
            Scenarios
        </h2>
        <button
            type="button"
            class={closeClasses}
            aria-label="Close scenarios"
            onclick={close}
        >
            {@html iconSvg("x")}
        </button>
    </div>
    <div class="orrery__scenarios-body">
        <h3 class="orrery__scenarios-heading" id="orrery-scenarios-built-in">
            Built in
        </h3>
        <section aria-labelledby="orrery-scenarios-built-in">
            <ul class="orrery__scenarios-list">
                {#each builtInScenarios as scenario, index}
                    <li class="orrery__scenarios-row">
                        <div>
                            <strong>{scenario.name}</strong
                            ><small>{bodyCount(scenario)}</small>
                        </div>
                        <button
                            type="button"
                            class={classes("outline")}
                            data-action="built-in"
                            data-index={index}
                            aria-label="Load {scenario.name}"
                            onclick={() => loadScenario(scenario)}
                        >
                            Load
                        </button>
                    </li>
                {/each}
            </ul>
        </section>
        <h3 class="orrery__scenarios-heading" id="orrery-scenarios-saved">
            Saved
        </h3>
        <section aria-labelledby="orrery-scenarios-saved">
            {#if saved.length === 0}
                <p class="orrery__scenarios-empty">Nothing saved yet.</p>
            {:else}
                <ul class="orrery__scenarios-list">
                    {#each rows as { entry, index } (entry)}
                        {@const entryName = entry.scenario.name}
                        <li class="orrery__scenarios-row">
                            <div>
                                <strong>{entryName}</strong
                                ><small>{savedMeta(entry)}</small>
                            </div>
                            <button
                                type="button"
                                class={classes("outline")}
                                data-action="load"
                                data-index={index}
                                aria-label="Load {entryName}"
                                onclick={() => loadScenario(entry.scenario)}
                            >
                                Load
                            </button>
                            <button
                                type="button"
                                class={classes(
                                    "ghost",
                                    "orrery__scenarios-quiet orrery__orbit-quiet",
                                )}
                                data-action="delete"
                                data-index={index}
                                aria-label={armed === index
                                    ? `Confirm deleting ${entryName}`
                                    : `Delete ${entryName}`}
                                onclick={() => pressDelete(index)}
                            >
                                {armed === index ? "Confirm" : "Delete"}
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}
        </section>
        <form
            class="orrery__form-row"
            novalidate
            onsubmit={(event) => {
                event.preventDefault();
                save();
            }}
        >
            <label for="orrery-scenario-name">Save the current view as</label>
            <div class="orrery__stepper">
                <input
                    bind:this={nameInput}
                    bind:value={name}
                    id="orrery-scenario-name"
                    type="text"
                    autocomplete="off"
                    placeholder="Name"
                    aria-describedby="orrery-scenario-error"
                    aria-invalid={nameError !== null}
                >
                <button type="submit" class={classes("solid")}>Save</button>
            </div>
            <p
                class="orrery__stepper-error"
                id="orrery-scenario-error"
                hidden={nameError === null}
            >
                {nameError ?? ""}
            </p>
        </form>
        <div class="orrery__form-row">
            <label for="orrery-scenario-link">Share link</label>
            <div class="orrery__stepper">
                <input
                    bind:this={linkInput}
                    id="orrery-scenario-link"
                    type="text"
                    readonly
                    class="orrery__scenarios-link"
                    value={link}
                >
                <button
                    type="button"
                    class={classes("outline")}
                    disabled={link === ""}
                    onclick={copyLink}
                >
                    Copy
                </button>
            </div>
        </div>
        <div class="orrery__scenarios-actions">
            <button
                type="button"
                class={classes("ghost")}
                data-action="import"
                onclick={() => file?.click()}
            >
                Import
            </button>
            <button
                type="button"
                class={classes("ghost")}
                data-action="export"
                onclick={exportJson}
            >
                Export
            </button>
            <button
                type="button"
                class={classes("ghost")}
                data-action="add"
                onclick={addBody}
            >
                Add a body
            </button>
        </div>
        <div class="orrery__form-hint orrery__scenarios-status" role="status">
            {#if typeof status === "string"}
                {status}
            {:else if status}
                <p>The file isn't a valid scenario:</p>
                <ul>
                    {#each status.invalid.slice(0, MAX_SHOWN_ERRORS) as error}
                        <li>{error}</li>
                    {/each}
                    {#if status.invalid.length > MAX_SHOWN_ERRORS}
                        <li>
                            and {status.invalid.length - MAX_SHOWN_ERRORS} more
                        </li>
                    {/if}
                </ul>
            {/if}
        </div>
        <input
            bind:this={file}
            type="file"
            accept=".json,application/json"
            hidden
            onchange={() => void importFile()}
        >
    </div>
</dialog>
