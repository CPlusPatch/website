<script lang="ts">
import { type Document, documentFile } from "@cpluspatch/sim";
import { classes } from "./buttons.ts";
import { download, fileName, readScenarioFile } from "./files.ts";
import type { Status } from "./status.ts";

type Props = {
    /** The document as it is now. */
    current: () => Document;
    onLoad: (doc: Document) => void;
    onStatus: (status: Status) => void;
    onAdd: () => void;
};

const { current, onLoad, onStatus, onAdd }: Props = $props();

let file: HTMLInputElement | undefined;

const exportJson = () => {
    const doc = current();
    const fileLabel = fileName(doc.scenario.name);

    download(fileLabel, JSON.stringify(documentFile(doc), null, 2));
    onStatus(`Exported ${fileLabel}.`);
};

const importFile = async () => {
    const [chosen] = file?.files ?? [];
    if (!file || !chosen) return;

    const result = await readScenarioFile(chosen);
    // So choosing the same file again still fires `change`.
    file.value = "";

    if (!result.ok) {
        onStatus(result.status);
        return;
    }

    onLoad(result.doc);
};
</script>

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
        onclick={onAdd}
    >
        Add a body
    </button>
</div>
<input
    bind:this={file}
    type="file"
    accept=".json,application/json"
    hidden
    onchange={() => void importFile()}
>

<style>
.orrery__scenarios-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
}
</style>
