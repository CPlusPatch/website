<script lang="ts">
import { roleOf, styleOf } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import { marked } from "../../search.ts";
import { getDocument } from "../../state/context.ts";
import { system } from "../../systems.ts";
import { bodyMarker } from "../body-marker.ts";
import { ROLE_LABELS } from "../labels.ts";
import { optionId, type Pane } from "./nav.ts";

type Props = {
    body: Body;
    bodies: readonly Body[];
    pane: Pane;
    active: boolean;
    /** The row whose system the right pane shows. */
    shown?: boolean;
    nested?: boolean;
    /** Adds the chevron, hidden when the body has no system. */
    chevron?: boolean;
    /** Makes the row two lines, with the match in this query in bold. */
    query?: string;
    /** The body is the picked one. */
    picked: boolean;
    range: string;
    onrow: (event: MouseEvent) => void;
};

const {
    body,
    bodies,
    pane,
    active,
    shown = false,
    nested = false,
    chevron = false,
    query,
    picked,
    range,
    onrow,
}: Props = $props();

const CHEVRON =
    '<svg viewBox="0 0 8 12" aria-hidden="true" focusable="false"><path d="M1.5 1.5 6.5 6l-5 4.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

const documents = getDocument();
const parent = $derived(
    bodies.find((candidate) => candidate.id === body.orbit?.parent),
);
const [before, match, after] = $derived(marked(body.name, query ?? ""));
// The left column is too narrow for both, and its Spacecraft heading says what they are.
const style = $derived(styleOf(body));
const bodyRole = $derived(style.craft ? roleOf(body) : "other");
const role = $derived(
    pane !== "left" && bodyRole !== "other"
        ? ROLE_LABELS[bodyRole].toLowerCase()
        : "",
);
const sub = $derived.by(() => {
    const kind =
        bodyRole !== "other" ? `${ROLE_LABELS[bodyRole]} craft` : style.label;

    return parent ? `${kind} around ${parent.name}` : kind;
});
// The root's system is every body, which the right pane doesn't list.
const opens = $derived(
    body.orbit !== undefined && system(bodies, body.id).length > 0,
);
</script>

{#snippet name()}
    <!-- biome-ignore format: a space here would split the name around the match -->
    <span class="orrery__search-name">{before}{#if match}<b>{match}</b>{/if}{after}</span>
{/snippet}

<!-- The combobox input owns the keyboard, so the row needs neither a key handler nor a tab stop. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
<!-- biome-ignore lint/a11y/useFocusableInteractive: the combobox input owns focus -->
<!-- biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input owns the keyboard -->
<div
    role="option"
    id={optionId(pane, body.id)}
    class={[
        "orrery__search-row",
        shown && "orrery__search-row--shown",
        nested && "orrery__search-row--nested",
        query !== undefined && "orrery__search-row--two",
    ]}
    data-id={body.id}
    aria-selected={active}
    onclick={onrow}
>
    <span
        class="orrery__search-marker orrery__search-marker--row"
        style:color={documents.colorOf(body, parent)}
        >{@html bodyMarker(body)}</span
    >
    {#if query === undefined}
        {@render name()}
        {#if role}
            <span class="orrery__search-role">{role}</span>
        {/if}
    {:else}
        <span class="orrery__search-text">
            {@render name()}
            <span class="orrery__search-sub">{sub}</span>
        </span>
    {/if}
    {#if picked}
        <span
            class="orrery__search-picked"
            role="img"
            aria-label="Picked"
        ></span>
    {/if}
    <span class="orrery__search-range">{range}</span>
    {#if chevron}
        <span
            class="orrery__search-chevron"
            style:visibility={opens ? undefined : "hidden"}
            >{@html CHEVRON}</span
        >
    {/if}
</div>

<style>
.orrery__search-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-block-size: var(--orrery-control);
    padding: 0 var(--orrery-pad);
    cursor: default;

    &:hover {
        background-color: var(--orrery-search-hover);
    }

    &.orrery__search-row--shown {
        background-color: var(--orrery-panel-raised);
    }

    &[aria-selected="true"] {
        background-color: var(--orrery-search-selected);
    }

    b {
        font-weight: 700;
    }

    @media (pointer: coarse), (max-width: 720px) {
        min-block-size: 2.5rem;
    }
}

.orrery__search-row--nested {
    padding-inline-start: calc(var(--orrery-pad) + 1.5rem);
}

.orrery__search-row--two {
    min-block-size: 2.75rem;
    padding-block: 0.25rem;

    @media (pointer: coarse), (max-width: 720px) {
        min-block-size: 3rem;
    }
}

.orrery__search-marker {
    display: flex;
    flex: none;
    align-self: center;
    inline-size: 16px;
    block-size: 16px;

    :global(svg) {
        inline-size: 100%;
        block-size: 100%;
    }
}

.orrery__search-text {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
}

.orrery__search-name {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.orrery__search-row--two .orrery__search-name {
    font-weight: 400;
}

/* The role gives way before the name does. */
.orrery__search-role {
    flex: 0 100 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--orrery-muted);
    font-size: var(--orrery-size-sm);
    white-space: nowrap;
}

.orrery__search-sub {
    overflow: hidden;
    color: var(--orrery-muted);
    font-size: var(--orrery-size-label);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.orrery__search-range {
    flex: none;
    margin-inline-start: auto;
    padding-inline-start: var(--space-sm);
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) var(--orrery-font-data);
    font-variant-numeric: tabular-nums;
    text-align: end;
    white-space: nowrap;
}

.orrery__search-chevron {
    display: flex;
    flex: none;
    inline-size: 8px;
    block-size: 12px;
    color: var(--orrery-muted);

    :global(svg) {
        inline-size: 100%;
        block-size: 100%;
    }
}

.orrery__search-picked {
    flex: none;
    align-self: center;
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background-color: var(--orrery-pick);
}

@media (forced-colors: active) {
    .orrery__search-row {
        &[aria-selected="true"] {
            outline: 2px solid Highlight;
        }

        &.orrery__search-row--shown:not([aria-selected="true"]) {
            outline: 1px solid CanvasText;
            outline-offset: -1px;
        }
    }

    .orrery__search-picked {
        background-color: CanvasText;
    }
}
</style>
