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
