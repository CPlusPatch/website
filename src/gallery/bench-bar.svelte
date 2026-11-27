<script lang="ts">
import Icon from "@cpluspatch/ui/svelte/icon.svelte";
import Button from "@cpluspatch/ui/svelte/ui/button.svelte";
import type { Snippet } from "svelte";

/**
 * The bar across the top of the bench, and the page's only one: the way
 * back to the gallery, the component, what's on the stage, where the
 * component sits in its category, the components either side of it, and the
 * menus.
 */
type Props = {
    /** The component's title, which is the page's heading. */
    title: string;
    /** The id of what's on the stage, like `button-size/sm`. */
    current: string;
    /** Where the component sits, like "Primitives · 1 of 16". */
    position: string;
    /** The component before this one in its category, if any. */
    previous?: { href: string; title: string };
    /** The component after this one in its category, if any. */
    next?: { href: string; title: string };
    /** The Components and Display menus, from the page. */
    actions?: Snippet;
};

const { title, current, position, previous, next, actions }: Props = $props();
</script>

<div class="bench-bar">
    <Button
        class="bench-bar__home"
        href="/gallery/"
        variant="ghost"
        tone="neutral"
        size="icon"
        aria-label="Component gallery"
    >
        <Icon name="lucide:layout-grid" aria-hidden="true" />
    </Button>
    <h1 class="bench-bar__title text-title">{title}</h1>
    <code class="bench-bar__current text-meta">{current}</code>
    <span class="bench-bar__spacer"></span>
    <div class="bench-bar__pager">
        <p class="bench-bar__position text-meta">{position}</p>
        <!-- A missing link leaves a gap, so the other one stays put. -->
        <div class="bench-bar__steps">
            {#if previous}
                <Button
                    href={previous.href}
                    rel="prev"
                    variant="ghost"
                    tone="neutral"
                    size="icon"
                    aria-label={`Previous: ${previous.title}`}
                >
                    <Icon name="lucide:chevron-left" aria-hidden="true" />
                </Button>
            {:else}
                <span class="bench-bar__gap"></span>
            {/if}
            {#if next}
                <Button
                    href={next.href}
                    rel="next"
                    variant="ghost"
                    tone="neutral"
                    size="icon"
                    aria-label={`Next: ${next.title}`}
                >
                    <Icon name="lucide:chevron-right" aria-hidden="true" />
                </Button>
            {:else}
                <span class="bench-bar__gap"></span>
            {/if}
        </div>
    </div>
    {@render actions?.()}
</div>

<style>
.bench-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-md);
    width: 100%;
    padding: var(--space-xs) var(--space-md);
    min-height: var(--header-height);
    box-sizing: border-box;
    background-color: var(--color-surface);
    border-bottom: var(--border-width) solid var(--border-color);
}

.bench-bar__title {
    flex-shrink: 0;
    margin: 0;
}

.bench-bar__current {
    min-width: 0;
    overflow: hidden;
    font-family: var(--font-mono);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bench-bar__spacer {
    flex: 1;
}

.bench-bar__pager {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
}

.bench-bar__position {
    margin: 0;
    font-family: var(--font-mono);
    white-space: nowrap;
}

.bench-bar__steps {
    display: flex;
    gap: var(--space-xs);
}

/* The width of an icon button, so a missing link keeps the row steady. */
.bench-bar__gap {
    width: var(--control-height-md);
}
</style>
