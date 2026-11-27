<script lang="ts">
import { type AUnit, styleOf } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import type { Attachment } from "svelte/attachments";
import { leftPane, rail, system } from "../../systems.ts";
import { idsOf, named, rangesFor, rootNote, systemIds } from "./nav.ts";
import Rail from "./Rail.svelte";
import Row from "./Row.svelte";
import SystemHead from "./SystemHead.svelte";

type Props = {
    bodies: readonly Body[];
    /** The id of the body whose system the right pane shows. */
    shown: string;
    pane: "left" | "right";
    active: string | null;
    /** True when the right pane covers the left one. */
    narrow: boolean;
    picked: string | null;
    chosen: AUnit | null;
    distances: ReadonlyMap<string, number | null>;
    /** False until the panel has been opened once, as the lists start empty. */
    built: boolean;
    /** The lists stay empty while a query shows matches. */
    searching: boolean;
    left?: HTMLElement;
    systemList?: HTMLElement;
    right?: HTMLElement;
    /** Fades the foot of a scrolling list while more rows are below. */
    more: Attachment<HTMLElement>;
    /** A left row was clicked. */
    onshow: (id: string) => void;
    /** A row of the right pane was clicked. */
    onpick: (id: string, andFocus: boolean) => void;
    /** A left row was double-clicked. */
    ondouble: (id: string) => void;
    onact: (act: "pick" | "focus" | "back" | "add-blank") => void;
};

let {
    bodies,
    shown,
    pane,
    active,
    narrow,
    picked,
    chosen,
    distances,
    built,
    searching,
    left = $bindable(),
    systemList = $bindable(),
    right = $bindable(),
    more,
    onshow,
    onpick,
    ondouble,
    onact,
}: Props = $props();

const BACK_ICON =
    '<svg viewBox="0 0 8 12" aria-hidden="true" focusable="false"><path d="M6.5 1.5 1.5 6l5 4.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

const tree = $derived(built && !searching);
const { root, groups } = $derived(leftPane(bodies));
const body = $derived(
    bodies.find((candidate) => candidate.id === shown) ?? root,
);
const groupsOf = $derived(system(bodies, body.id));
const metres = $derived(rail(bodies, body.id));
const leftRange = $derived(
    rangesFor(distances, chosen, [root.id, ...idsOf(groups)]),
);
const headRange = $derived(rangesFor(distances, chosen, [body.id]));
const systemRange = $derived(rangesFor(distances, chosen, idsOf(groupsOf)));
const systemHasOptions = $derived(systemIds(bodies, body.id).length > 0);
// A note or empty state isn't an option, so its list stops being a listbox.
const systemListed = $derived(!built || (!searching && systemHasOptions));
const leftActive = $derived(pane === "left" ? active : null);
const rightActive = $derived(pane === "right" ? active : null);

const onDouble = (event: MouseEvent) => {
    const id =
        event.target instanceof Element
            ? event.target.closest<HTMLElement>('[role="option"]')?.dataset.id
            : undefined;

    if (id) ondouble(id);
};
</script>

{#snippet heading(
    label: string,
    count?: number,
)}
    <div class="orrery__search-group" role="presentation">
        {label}
        {#if count !== undefined}
            <span>{count}</span>
        {/if}
    </div>
{/snippet}

<!-- Scrollable lists would otherwise take a Tab stop of their own. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
    id="orrery-search-left"
    class="orrery__search-left"
    tabindex="-1"
    role="listbox"
    aria-label={built ? `Bodies around ${named(root)}` : undefined}
    bind:this={left}
    ondblclick={onDouble}
    {@attach more}
>
    {#if tree}
        {@render heading(styleOf(root).label)}
        <Row
            body={root}
            {bodies}
            pane="left"
            active={root.id === leftActive}
            shown={root.id === shown}
            chevron
            picked={root.id === picked}
            range={leftRange(root.id)}
            onrow={() => onshow(root.id)}
        />
        {#each groups as { label, rows } (label)}
            {@render heading(label, rows.filter((row) => !row.nested).length)}
            {#each rows as { body: child } (child.id)}
                <Row
                    body={child}
                    {bodies}
                    pane="left"
                    active={child.id === leftActive}
                    shown={child.id === shown}
                    chevron
                    picked={child.id === picked}
                    range={leftRange(child.id)}
                    onrow={() => onshow(child.id)}
                />
            {/each}
        {/each}
    {/if}
</div>
<div class="orrery__search-right" bind:this={right}>
    <button
        type="button"
        class="orrery__search-back"
        data-act="back"
        aria-label={built ? `Back to bodies around ${named(root)}` : undefined}
        onclick={() => onact("back")}
    >
        <span class="orrery__search-back-icon">{@html BACK_ICON}</span>
        <span>{built ? `Bodies around ${named(root)}` : ""}</span>
    </button>
    <div class="orrery__search-head">
        {#if tree}
            <SystemHead
                {body}
                {bodies}
                picked={body.id === picked}
                range={headRange(body.id)}
                onact={(act) => onact(act)}
            />
        {/if}
    </div>
    <!-- The rows of the rail say the same, so a screen reader skips it. -->
    <div
        class="orrery__search-rail"
        aria-hidden="true"
        hidden={!tree || !metres}
    >
        {#if tree && metres}
            <Rail {body} {bodies} {metres} active={rightActive} {chosen} />
        {/if}
    </div>
    <!-- biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is on only while the list holds an option -->
    <div
        id="orrery-search-right"
        class="orrery__search-system"
        tabindex="-1"
        role={systemListed ? "listbox" : undefined}
        aria-label={built && systemListed
            ? `Bodies around ${named(body)}`
            : undefined}
        bind:this={systemList}
        {@attach more}
    >
        {#if tree}
            {#if body.id === root.id}
                <p class="orrery__search-note">{rootNote(bodies, narrow)}</p>
            {:else if groupsOf.length === 0}
                <div class="orrery__search-nothing">
                    <p>Nothing is tracked around {body.name}.</p>
                    <button
                        type="button"
                        class="orrery__search-button"
                        data-act="add-blank"
                        onclick={() => onact("add-blank")}
                    >
                        Add a body…
                    </button>
                </div>
            {:else}
                {#each groupsOf as { label, rows } (label)}
                    {@render heading(
                        label,
                        rows.filter((row) => !row.nested).length,
                    )}
                    {#each rows as { body: child, nested } (child.id)}
                        <Row
                            body={child}
                            {bodies}
                            pane="right"
                            active={child.id === rightActive}
                            {nested}
                            picked={child.id === picked}
                            range={systemRange(child.id)}
                            onrow={(event) => onpick(child.id, event.shiftKey)}
                        />
                    {/each}
                {/each}
            {/if}
        {/if}
    </div>
</div>

<style>
.orrery__search-left {
    grid-column: 1;
    grid-row: 1;
    min-block-size: 0;
    padding-block-end: 0.25rem;
    overflow-y: auto;
    overscroll-behavior: contain;
}

/* Fades the foot of a list while more rows are below. */
.orrery__search-left,
.orrery__search-system {
    &:global([data-more]) {
        mask-image: linear-gradient(
            to bottom,
            #000 calc(100% - 1.5rem),
            transparent
        );
    }
}

.orrery__search-right {
    display: flex;
    flex-direction: column;
    grid-column: 2;
    grid-row: 1 / -1;
    min-block-size: 0;
    min-inline-size: 0;
    border-inline-start: 1px solid var(--orrery-rule);
}

/* Shown under 720 px only, as the way back from the right pane. */
.orrery__search-back {
    display: none;
    align-items: center;
    gap: var(--space-sm);
    inline-size: 100%;
    min-block-size: var(--control-height-sm);
    padding: 0 var(--orrery-pad);
    border: 0;
    border-block-end: 1px solid var(--orrery-rule);
    border-radius: 0;
    background: none;
    color: var(--orrery-text);
    font: inherit;
    text-align: start;
    cursor: pointer;

    &:hover {
        background-color: var(--orrery-search-hover);
    }

    &:focus-visible {
        outline-offset: -2px;
    }
}

.orrery__search-back-icon {
    display: flex;
    inline-size: 8px;
    block-size: 12px;
    color: var(--orrery-muted);

    :global(svg) {
        inline-size: 100%;
        block-size: 100%;
    }
}

.orrery__search-head {
    flex: none;
    padding: var(--orrery-pad);
    border-block-end: 1px solid var(--orrery-rule);
}

.orrery__search-rail {
    /* Where the marks start after the primary, and the room kept at the far end for labels. */
    --orrery-rail-start: 24px;
    --orrery-rail-end: 2rem;

    flex: none;
    padding: 0.5rem var(--orrery-pad) 0.375rem;
    border-block-end: 1px solid var(--orrery-rule);
}

.orrery__search-system {
    flex: 1;
    min-block-size: 0;
    padding-block-end: 0.25rem;
    overflow-y: auto;
    overscroll-behavior: contain;
}

.orrery__search-group {
    display: flex;
    gap: var(--space-sm);
    padding: 0.625rem var(--orrery-pad) 0.25rem;
    color: var(--orrery-dim);
    font-size: var(--orrery-size-label);
    font-weight: 500;

    span {
        font: 400 var(--orrery-size-label) var(--orrery-font-data);
    }
}

.orrery__search-note,
.orrery__search-nothing {
    margin: 0;
    padding: 1rem var(--orrery-pad);
    color: var(--orrery-muted);
    font-size: var(--orrery-size-sm);
}

.orrery__search-nothing {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;

    p {
        margin: 0;
    }
}

.orrery__search-button {
    block-size: var(--orrery-control);
    padding: 0 var(--orrery-pad);
    border: 1px solid var(--orrery-frame);
    border-radius: 0;
    background: none;
    color: inherit;
    font: 500 var(--orrery-size-sm) var(--orrery-font-ui);
    cursor: pointer;

    &:hover {
        background-color: var(--orrery-panel-raised);
    }

    @media (pointer: coarse), (max-width: 720px) {
        block-size: var(--control-height-sm);
    }
}

@media (max-width: 720px) {
    .orrery__search-left {
        transition: transform var(--orrery-search-slide) ease;
    }

    .orrery__search-right {
        position: relative;
        z-index: 1;
        display: block;
        grid-column: 1;
        border-inline-start: 0;
        background-color: var(--orrery-panel-solid);
        overflow-y: auto;
        overscroll-behavior: contain;
        transform: translateX(100%);
        transition:
            transform var(--orrery-search-slide) ease,
            visibility 0s var(--orrery-search-slide);
        visibility: hidden;
    }

    /* Sticky, so a long system doesn't scroll the way back out of reach. */
    .orrery__search-back {
        position: sticky;
        inset-block-start: 0;
        z-index: 3;
        display: flex;
        background-color: var(--orrery-panel-solid);
    }

    /* The pane scrolls as one column, so the list needs no scroll or fade of its own. */
    .orrery__search-system {
        overflow: visible;
        mask-image: none;
    }
}

@media (prefers-reduced-motion: reduce) {
    .orrery__search-left,
    .orrery__search-right {
        transition: none;
    }
}
</style>
