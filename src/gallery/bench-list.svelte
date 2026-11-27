<script lang="ts">
import Icon from "@cpluspatch/ui/svelte/icon.svelte";
import { type BenchGroup, type Pick, pickId, pickPath } from "./bench.ts";

/**
 * The bench's story list. Each link targets the stage frame, so it works
 * without JS. It's drawn twice, a plain list and a <details> for narrow
 * benches. Which shows depends on the width of an ancestor container named
 * `bench` (bench.svelte); without one, it's the plain list.
 */
type Props = {
    groups: BenchGroup[];
    /** The current item's id (pickId). */
    current: string;
    /** What the narrow list's summary says is picked. */
    label: string;
    onpick: (pick: Pick) => void;
};

const { groups, current, label, onpick }: Props = $props();

const several = $derived(groups.length > 1);
let open = $state(false);

/** "All stories", then each story. */
const picks = (group: BenchGroup): Pick[] => [
    { group: group.id, story: null, query: "" },
    ...group.stories.map((story) => ({
        group: group.id,
        story: story.name,
        query: "",
    })),
];

const go = (event: MouseEvent, pick: Pick) => {
    // Leave a new tab or window to the link.
    if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
    ) {
        return;
    }

    event.preventDefault();
    open = false;
    onpick(pick);
};
</script>

{#snippet list()}
    {#each groups as group (group.id)}
        <div class="bench-list__group">
            {#if several}
                <h2 class="bench-list__title">{group.title}</h2>
            {/if}
            <ul>
                {#each picks(group) as pick (pick.story ?? "")}
                    <li>
                        <a
                            class="bench-list__link"
                            class:bench-list__link--all={pick.story === null}
                            href={pickPath(pick)}
                            target="stage"
                            aria-current={pickId(pick) === current
                                ? "true"
                                : undefined}
                            onclick={(event) => go(event, pick)}
                        >
                            {#if pick.story === null}
                                All stories
                            {:else}
                                <code>{pick.story}</code>
                            {/if}
                        </a>
                    </li>
                {/each}
            </ul>
        </div>
    {/each}
{/snippet}

<div class="bench-list bench-list--wide">
    {@render list()}
</div>

<details class="bench-list bench-list--narrow" bind:open>
    <summary>
        <span class="bench-list__heading">
            <Icon
                name="lucide:chevron-down"
                class="bench-list__chevron"
                aria-hidden="true"
            />
            Stories
        </span>
        <code class="text-meta">{label}</code>
    </summary>
    <div class="bench-list__folded">
        {@render list()}
    </div>
</details>

<style>
.bench-list {
    min-width: 0;
    font-size: var(--font-size-sm);
}

.bench-list__group + .bench-list__group {
    margin-top: var(--space-md);
}

.bench-list__title {
    margin: 0 0 var(--space-xs);
    font-family: var(--font-base);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
}

ul {
    margin: 0;
    padding: 0;
    list-style: none;
}

.bench-list__link {
    display: block;
    padding: var(--space-xs) var(--space-sm);
    color: var(--color-text-muted);
    text-decoration: none;
    overflow-wrap: anywhere;
    border-left: 2px solid transparent;
    /* WCAG 2.2's minimum target size, as the rows touch. */
    min-height: 1.5rem;

    code {
        font-family: var(--font-mono);
        font-size: var(--font-size-xs);
        color: inherit;
    }

    /* Also replaces the global link hover's highlighter fill. */
    @media (hover: hover) {
        &:hover {
            color: var(--color-text);
            background-color: transparent;
            border-left-color: var(--color-border-strong);
        }
    }

    &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
    }

    /* After :hover, so the current item keeps its fill under the pointer. */
    &[aria-current] {
        color: var(--color-text);
        font-weight: 500;
        background-color: var(--color-bg-alt);
    }

    @media (pointer: coarse) {
        min-height: var(--control-height-sm);
    }

    /* Forced colours paint every link's spare border, which would mark them all. */
    @media (forced-colors: active) {
        forced-color-adjust: none;
        color: LinkText;
        border-left-color: transparent;

        @media (hover: hover) {
            &:hover {
                border-left-color: CanvasText;
            }
        }

        &[aria-current] {
            background: Highlight;
            color: HighlightText;
        }
    }
}

.bench-list__link--all {
    font-style: italic;
}

.bench-list__heading {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
}

.bench-list--narrow {
    display: none;
    background-color: var(--color-surface);
    border: var(--border-width) solid var(--border-color);
    border-radius: var(--radius);

    summary {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-sm);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;

        :global(.bench-list__chevron) {
            flex-shrink: 0;
            transition: rotate var(--transition);
        }

        code {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    &[open] summary :global(.bench-list__chevron) {
        rotate: 180deg;
    }

    .bench-list__folded {
        max-height: 50vh;
        padding: var(--space-xs) var(--space-sm) var(--space-sm);
        overflow-y: auto;
        border-top: var(--border-width) solid var(--border-color);
    }
}

/* Narrow: the list folds into a <details> above the stage. */
@container bench (width < 52rem) {
    .bench-list--wide {
        display: none;
    }

    .bench-list--narrow {
        display: block;
    }
}
</style>
