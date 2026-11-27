<script lang="ts">
import type { Document } from "@cpluspatch/sim";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { cue } from "../../audio/cues.ts";
import {
    nameProblem,
    readList,
    SAVED_CHANGED,
    type SavedScenario,
    type SavedStorage,
    startTime,
    writeList,
} from "../../persistence.ts";
import { getDocument, getView } from "../../state/context.ts";
import BuiltInList from "./BuiltInList.svelte";
import FileActions from "./FileActions.svelte";
import { newestFirst, withoutSaved, withSaved } from "./rows.ts";
import SavedList from "./SavedList.svelte";
import SaveForm from "./SaveForm.svelte";
import ShareLink from "./ShareLink.svelte";
import StatusLine from "./StatusLine.svelte";
import { shareLink } from "./share.ts";
import type { Status } from "./status.ts";

type Props = {
    storage: SavedStorage;
    /** Opens the Add body form. */
    openAdd: () => void;
};

const { storage, openAdd }: Props = $props();

const documents = getDocument();
const view = getView();

let toggle: HTMLButtonElement | undefined;
let dialog: HTMLDialogElement | undefined;
let saveForm: ReturnType<typeof SaveForm> | undefined;

let saved = $state.raw<SavedScenario[]>([]);
let nameError = $state<string | null>(null);
let link = $state("");
let status = $state.raw<Status>(null);
// The index in `saved` of the Delete button waiting for its second press.
let armed = $state<number | null>(null);

// Each open takes an id, so a link that finishes late can tell it's stale.
let linkId = 0;
let pressedOn: EventTarget | null = null;

const rows = $derived(newestFirst(saved));

const closeClasses = buttonClasses({
    variant: "ghost",
    tone: "neutral",
    size: "icon-sm",
}).join(" ");

/** The document as it is now, with the clock's time on its scenario. */
const current = (): Document => ({
    ...documents.doc,
    scenario: { ...documents.doc.scenario, time: view.now() },
});

const close = () => {
    if (dialog?.open) dialog.close();
};

const buildLink = () => {
    const id = ++linkId;
    link = "";

    const { origin, pathname, search } = location;
    shareLink(current(), `${origin}${pathname}${search}`).then((result) => {
        if (id !== linkId) return;

        if (result.ok) link = result.link;
        else status = result.message;
    });
};

const open = () => {
    if (!dialog || dialog.open) return;

    status = null;
    nameError = null;
    saved = readList(storage);
    buildLink();
    dialog.showModal();
};

const loadDocument = (doc: Document) => {
    cue("load");
    documents.load(doc, startTime(doc.scenario));
    close();
};

const commit = (next: SavedScenario[]): boolean => {
    if (!writeList(storage, next)) {
        status = "The browser wouldn't save it.";

        return false;
    }

    saved = next;
    window.dispatchEvent(new Event(SAVED_CHANGED));

    return true;
};

const save = (name: string): boolean => {
    const problem = nameProblem(saved, name);
    nameError = problem;
    if (problem) {
        saveForm?.focus();

        return false;
    }

    if (!commit(withSaved(saved, current(), name, Date.now()))) return false;

    status = `Saved ${name}.`;

    return true;
};

const remove = (index: number) => {
    const gone = saved[index];
    if (!gone) return;

    if (!commit(withoutSaved(saved, index))) return;

    status = `Deleted ${gone.doc.scenario.name}.`;
    saveForm?.focus();
};

/** Press-twice: the first press arms the button, the second deletes. */
const pressDelete = (index: number) => {
    const target = saved[index]?.doc.scenario.name;
    if (target === undefined) return;

    if (armed === index) {
        armed = null;
        remove(index);
    } else {
        armed = index;
        status = `Press Confirm to delete ${target}.`;
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

/** Moves focus to the menu's button. */
export const focusToggle = (): void => toggle?.focus();

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
    bind:this={toggle}
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
        <BuiltInList onLoad={loadDocument} />
        <SavedList
            {rows}
            {armed}
            onLoad={loadDocument}
            onPressDelete={pressDelete}
        />
        <SaveForm bind:this={saveForm} error={nameError} onSave={save} />
        <ShareLink {link} onStatus={(next) => (status = next)} />
        <FileActions
            {current}
            onLoad={loadDocument}
            onStatus={(next) => (status = next)}
            onAdd={addBody}
        />
        <StatusLine {status} />
    </div>
</dialog>
