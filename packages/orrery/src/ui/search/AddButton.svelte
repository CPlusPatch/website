<script lang="ts">
type Props = {
    query: string;
    button?: HTMLButtonElement;
    onadd: () => void;
};

let { query, button = $bindable(), onadd }: Props = $props();

const PLUS_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

const name = $derived(query.trim());
</script>

<button
    type="button"
    class="orrery__search-add"
    data-act="add"
    bind:this={button}
    onclick={onadd}
>
    <span class="orrery__search-add-icon">{@html PLUS_ICON}</span>
    <span>{name !== "" ? `Add “${name}”` : "Add a body…"}</span>
</button>
