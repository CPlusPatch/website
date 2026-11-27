<script lang="ts">
import type { Attachment } from "svelte/attachments";
import { SEARCH_ICON } from "./icons.ts";

type Props = {
    visible: boolean;
    /** The id of the list the box drives, if it is a listbox. */
    controls: string | undefined;
    /** The DOM id of the active option, or "". */
    activeOption: string;
    input?: HTMLInputElement;
    oninput: () => void;
    keys: Attachment<HTMLInputElement>;
};

let {
    visible,
    controls,
    activeOption,
    input = $bindable(),
    oninput,
    keys,
}: Props = $props();
</script>

<div class="orrery__search-field">
    <span class="orrery__search-icon">{@html SEARCH_ICON}</span>
    <input
        type="text"
        role="combobox"
        aria-label="Find a body"
        aria-expanded={visible}
        aria-controls={controls}
        aria-autocomplete="list"
        aria-activedescendant={activeOption}
        placeholder="Find a body"
        autocomplete="off"
        spellcheck="false"
        bind:this={input}
        {oninput}
        {@attach keys}
    >
</div>

<style>
.orrery__search-field {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-sm);
    block-size: var(--orrery-control-lg);
    padding: 0 var(--orrery-pad);
    border-block-end: 1px solid var(--orrery-rule);

    input {
        flex: 1;
        min-inline-size: 0;
        padding: 0;
        border: 0;
        background: none;
        color: var(--orrery-text);
        font: 500 var(--orrery-size-md) var(--orrery-font-ui);
        outline: none;

        &::placeholder {
            color: var(--orrery-dim);
        }
    }
}

.orrery__search-icon {
    display: flex;
    flex: none;
    inline-size: 14px;
    block-size: 14px;
    color: var(--orrery-muted);

    :global(svg) {
        inline-size: 100%;
        block-size: 100%;
    }
}
</style>
