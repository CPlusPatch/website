<script lang="ts">
import type { Body } from "@cpluspatch/sim";
import { untrack } from "svelte";
import { getDocument, getView } from "../../state/context.ts";
import { bodyMarker } from "../body-marker.ts";

type Props = {
    /** The body whose satellites the section lists. */
    centre: Body;
};

const { centre }: Props = $props();

const documents = getDocument();
const view = getView();

const children = $derived(
    documents.presentBodies.filter(
        (candidate) => candidate.orbit?.parent === centre.id,
    ),
);

let expanded = $state(false);
let list = $state<HTMLElement>();
let toggleItem = $state.raw<HTMLElement>();
let toggle = $state.raw<HTMLButtonElement>();

// Hides chips from the end until the row and "+N more" fit.
const fit = (node: HTMLElement) => {
    if (!toggleItem || !toggle || node.clientWidth === 0) return;

    const items = [...node.children].filter(
        (item): item is HTMLElement =>
            item instanceof HTMLElement && item !== toggleItem,
    );
    const focused = node.contains(document.activeElement)
        ? document.activeElement
        : null;
    for (const item of items) item.hidden = false;
    toggleItem.hidden = true;
    // One child has nothing to fold away, so it stays clipped.
    if (node.scrollWidth > node.clientWidth && items.length > 1) {
        toggleItem.hidden = false;
        for (let shown = items.length - 1; shown >= 1; shown--) {
            for (const [index, item] of items.entries()) {
                item.hidden = index >= shown;
            }
            toggle.textContent = `+${items.length - shown} more`;
            if (node.scrollWidth <= node.clientWidth) break;
        }
    }

    // The fit can hide the chip or toggle that had focus.
    if (focused?.closest("li")?.hidden) {
        (toggleItem.hidden
            ? items[0]?.querySelector("button")
            : toggle
        )?.focus();
    }
};

const update = (node: HTMLElement) => {
    if (!expanded) {
        fit(node);

        return;
    }

    for (const item of node.children) {
        if (item instanceof HTMLElement) item.hidden = false;
    }
    if (toggleItem) toggleItem.hidden = false;
    if (toggle) toggle.textContent = "Show fewer";
};

// A new list of chips, or a click on the toggle.
$effect(() => {
    void children;
    void expanded;

    const node = list;
    if (node) untrack(() => update(node));
});

// Fitting changes what overflows, not the row's width, so only a new width refits.
$effect(() => {
    const node = list;
    if (!node) return;

    let width = node.clientWidth;
    const observer = new ResizeObserver(() => {
        if (node.clientWidth === width) return;

        width = node.clientWidth;
        if (!expanded) fit(node);
    });
    observer.observe(node);
    // A web font that loads late widens the chips but not the row.
    let destroyed = false;
    document.fonts.ready.then(() => {
        if (!destroyed && !expanded) fit(node);
    });

    return () => {
        destroyed = true;
        observer.disconnect();
    };
});
</script>

{#if children.length > 0}
    <section class="orrery__orbit-around">
        <h3>Around {centre.name}</h3>
        <ul
            class="orrery__orbit-chips"
            data-expanded={expanded ? "" : undefined}
            bind:this={list}
        >
            {#each children as child (child.id)}
                <li>
                    <button
                        type="button"
                        class="orrery__orbit-chip"
                        onclick={() => view.select(child.id)}
                    >
                        <span
                            class="orrery__orbit-chip-marker"
                            style:color={documents.colorOf(child, centre)}
                            >{@html bodyMarker(child)}</span
                        >{child.name}
                    </button>
                </li>
            {/each}
            <li bind:this={toggleItem}>
                <!-- One button for good, so focus stays on it when it toggles. fit() writes its label. -->
                <!-- svelte-ignore a11y_consider_explicit_label -->
                <button
                    type="button"
                    class="orrery__orbit-chip orrery__orbit-chip--more"
                    aria-expanded={expanded}
                    bind:this={toggle}
                    onclick={() => {
                        expanded = !expanded;
                    }}
                ></button>
            </li>
        </ul>
    </section>
{/if}

<style>
.orrery__orbit-around {
    margin-block-start: var(--orrery-pad);

    h3 {
        margin: 0 0 6px;
        color: var(--orrery-muted);
        font-size: var(--orrery-size-label);
        font-weight: 500;
    }

    /* The scroll body has its own top padding. */
    &:first-child {
        margin-block-start: 0;
    }
}

/* One row. The fit hides the chips that don't leave room for "+N more". */
.orrery__orbit-chips {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;

    &[data-expanded] {
        flex-wrap: wrap;
    }

    li {
        display: flex;
        flex: none;
    }

    > :global([hidden]) {
        display: none;
    }
}

.orrery__orbit-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    block-size: 1.5rem;
    padding: 0 6px;
    border: 1px solid var(--orrery-rule);
    background: transparent;
    color: var(--orrery-text);
    font: 500 var(--orrery-size-label) var(--orrery-font-ui);
    white-space: nowrap;
    cursor: pointer;

    @media (hover: hover) {
        &:hover {
            background: var(--orrery-panel-raised);
        }
    }
}

.orrery__orbit-chip--more {
    color: var(--orrery-muted);
}

.orrery__orbit-chip-marker {
    flex: none;
    display: flex;
    inline-size: 0.75rem;
    block-size: 0.75rem;

    :global(svg) {
        inline-size: 100%;
        block-size: 100%;
    }
}

@media (max-width: 720px) {
    /* A touch target. */
    .orrery__orbit-chip {
        min-block-size: var(--control-height-md);
    }
}
</style>
