<script lang="ts">
import Icon from "@cpluspatch/ui/svelte/icon.svelte";
import Badge from "@cpluspatch/ui/svelte/ui/badge.svelte";
import { TAG_HINTS } from "./bench.ts";
import type { Tag } from "./story.ts";

/**
 * What the component is, folded away until asked for: its description, the
 * files it comes from and the tags of the component and the story. The
 * summary names the component and its first file.
 */
type Props = {
    /** The component's title. */
    title: string;
    description?: string;
    sources: string[];
    /** Whether the component lives in this site, not the library. */
    site: boolean;
    tags: Tag[];
    /** The story's own tags, without the component's. */
    storyTags: Tag[];
};

const { title, description, sources, site, tags, storyTags }: Props = $props();

const file = $derived(sources[0]?.split("/").pop());
const allTags = $derived([...tags, ...storyTags]);
</script>

<details class="bench-about">
    <summary>
        <span class="bench-about__heading">
            <Icon
                name="lucide:chevron-right"
                class="bench-about__chevron"
                aria-hidden="true"
            />
            About {title}
        </span>
        {#if file}
            <code class="bench-about__file text-meta">{file}</code>
        {/if}
    </summary>
    <div class="bench-about__body">
        {#if description}
            <p class="bench-about__description">{description}</p>
        {/if}
        <p class="bench-about__meta text-meta">
            {#each sources as source (source)}
                <!-- biome-ignore format: whitespace in the path is significant -->
                <code>{#each source.split("/") as part, i}{#if i > 0}/<wbr />{/if}{part}{/each}</code>
            {/each}
            {#if site}
                <Badge variant="outline" tone="secondary" size="sm"
                    >site only</Badge
                >
            {/if}
        </p>
        {#if allTags.length > 0}
            <ul class="bench-about__tags">
                {#each allTags as tag (tag)}
                    <li>
                        <Badge variant="outline" tone="secondary" size="sm"
                            >{tag}</Badge
                        >
                        <span class="bench-about__hint">{TAG_HINTS[tag]}</span>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</details>

<style>
.bench-about {
    min-width: 0;

    summary {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-sm);
        font-weight: 600;
        cursor: pointer;
    }

    :global(.bench-about__chevron) {
        flex-shrink: 0;
        transition: rotate var(--transition);
    }

    &[open] :global(.bench-about__chevron) {
        rotate: 90deg;
    }
}

.bench-about__heading {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    overflow-wrap: anywhere;
}

.bench-about__file {
    flex-shrink: 0;
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bench-about__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding-top: var(--space-sm);

    p {
        margin: 0;
    }
}

.bench-about__description {
    color: var(--color-text-muted);
}

.bench-about__tags {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;

    li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs) var(--space-sm);
    }
}

.bench-about__hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

.bench-about__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);

    code {
        overflow-wrap: break-word;
    }
}
</style>
