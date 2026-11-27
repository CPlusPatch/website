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

<style>
/* Last in the DOM so Tab reaches it after the pane's buttons, and drawn under the list. */
.orrery__search-add {
    display: flex;
    grid-column: 1;
    grid-row: 2;
    align-items: center;
    gap: var(--space-sm);
    inline-size: 100%;
    min-block-size: var(--orrery-control);
    padding: 0 var(--orrery-pad);
    border: 0;
    border-block-start: 1px solid var(--orrery-rule);
    border-radius: 0;
    background: none;
    color: var(--orrery-text);
    font: inherit;
    text-align: start;
    cursor: pointer;

    &:hover {
        background-color: var(--orrery-search-hover);
    }

    /* Inside the popover, so the frame doesn't clip the ring. */
    &:focus-visible {
        outline-offset: -2px;
    }

    @media (pointer: coarse), (max-width: 720px) {
        min-block-size: var(--control-height-sm);
    }
}

.orrery__search-add-icon {
    display: flex;
    inline-size: 16px;
    block-size: 16px;
    color: var(--orrery-muted);

    :global(svg) {
        inline-size: 100%;
        block-size: 100%;
    }
}

@media (max-width: 720px) {
    .orrery__search-add {
        transition: transform var(--orrery-search-slide) ease;
    }
}

@media (prefers-reduced-motion: reduce) {
    .orrery__search-add {
        transition: none;
    }
}
</style>
