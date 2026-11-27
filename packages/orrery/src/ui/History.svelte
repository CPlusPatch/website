<script lang="ts">
import { iconSvg } from "@cpluspatch/ui";
import { getDocument } from "../state/context.ts";
import { MOD_KEY } from "./shortcuts.ts";

type Props = {
    onUndo: () => void;
    onRedo: () => void;
};

const { onUndo, onRedo }: Props = $props();

const documentStore = getDocument();
</script>

<!-- aria-disabled, not disabled, so focus stays on the button after the last undo. -->
<!-- biome-ignore lint/a11y/useSemanticElements: A fieldset's default styles fight the top bar's flex layout. -->
<div class="orrery__history" role="group" aria-label="History">
    <button
        type="button"
        class="orrery__history-button"
        aria-label="Undo"
        aria-keyshortcuts="Control+Z Meta+Z"
        title="Undo ({MOD_KEY}+Z)"
        aria-disabled={!documentStore.canUndo}
        onclick={() => documentStore.canUndo && onUndo()}
    >
        <span class="orrery__tool-icon">{@html iconSvg("undo-2")}</span>
    </button>
    <button
        type="button"
        class="orrery__history-button"
        aria-label="Redo"
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        title="Redo ({MOD_KEY}+Shift+Z)"
        aria-disabled={!documentStore.canRedo}
        onclick={() => documentStore.canRedo && onRedo()}
    >
        <span class="orrery__tool-icon">{@html iconSvg("redo-2")}</span>
    </button>
</div>

<style>
.orrery__history {
    display: flex;
    align-self: stretch;
}

.orrery__history-button {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    min-block-size: var(--orrery-control);
    padding: 0;
    color: var(--orrery-text);
    cursor: pointer;

    &:hover {
        background-color: var(--orrery-panel-raised);
    }

    /* Clear of the shared frame, and above the other button. */
    &:focus-visible {
        position: relative;
        z-index: 1;
        outline-offset: 3px;
    }

    &[aria-disabled="true"] {
        background-color: transparent;
        color: var(--orrery-dim);
        cursor: default;
    }
}
</style>
