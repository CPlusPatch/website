<script lang="ts">
import Icon from "@cpluspatch/ui/svelte/icon.svelte";
import Badge from "@cpluspatch/ui/svelte/ui/badge.svelte";
import Button from "@cpluspatch/ui/svelte/ui/button.svelte";
import {
    type Backdrop,
    type BenchGroup,
    liveSource,
    type Pick,
    pickPath,
    TAG_HINTS,
    valuesOf,
} from "./bench.ts";
import BenchControls from "./bench-controls.svelte";
import BenchSettings from "./bench-settings.svelte";
import type { ControlValues } from "./controls.ts";
import type { Tag } from "./story.ts";

/** The bench's inspector: the component, then whatever is on the stage. */
type Props = {
    description?: string;
    sources: string[];
    /** Whether the component lives in this site, not the library. */
    site: boolean;
    tags: Tag[];
    group: BenchGroup;
    current: Pick;
    /** Whether JS has run, which the controls and settings need. */
    mounted: boolean;
    backdrop: Backdrop;
    outline: boolean;
    /** The controls' values after a pick. */
    oncontrols: (values: ControlValues) => void;
    onstage: (backdrop: Backdrop) => void;
    onoutline: (outline: boolean) => void;
};

const {
    description,
    sources,
    site,
    tags,
    group,
    current,
    mounted,
    backdrop,
    outline,
    oncontrols,
    onstage,
    onoutline,
}: Props = $props();

const story = $derived(group.stories.find((s) => s.name === current.story));
const values = $derived(story ? valuesOf(story, current.query) : {});
const source = $derived(story && liveSource(story, values));
const count = $derived(
    `${group.stories.length} ${group.stories.length === 1 ? "story" : "stories"}`,
);
// The component's own tags are already shown above.
const storyTags = $derived(story?.tags.filter((t) => !tags.includes(t)) ?? []);
</script>

{#snippet tagBadges(
    list: Tag[],
)}
    {#each list as tag (tag)}
        <Badge
            variant="outline"
            tone="secondary"
            size="sm"
            title={TAG_HINTS[tag]}
        >
            {tag}
        </Badge>
    {/each}
{/snippet}

{#snippet openAlone()}
    <Button
        href={pickPath(current, story)}
        variant="outline"
        tone="secondary"
        size="sm"
    >
        Open alone
        <Icon name="lucide:maximize" aria-hidden="true" />
    </Button>
{/snippet}

<div class="bench-inspector">
    <section class="bench-inspector__section">
        {#if description}
            <p class="bench-inspector__description">{description}</p>
        {/if}
        <p class="bench-inspector__meta text-meta">
            {#each sources as source (source)}
                <!-- biome-ignore format: whitespace in the path is significant -->
                <code>{#each source.split("/") as part, i}{#if i > 0}/<wbr />{/if}{part}{/each}</code>
            {/each}
            {#if site}
                <Badge variant="outline" tone="secondary" size="sm"
                    >site only</Badge
                >
            {/if}
            {@render tagBadges(tags)}
        </p>
    </section>

    <section class="bench-inspector__section">
        {#if story}
            <h2 class="bench-inspector__heading">{group.title}</h2>
            <p class="bench-inspector__meta text-meta">
                <code>{story.name}</code>
                {@render tagBadges(storyTags)}
            </p>
            {#if mounted}
                <BenchControls
                    controls={story.controls}
                    {values}
                    onchange={oncontrols}
                />
            {/if}
            <!-- Above the source, which can run long. -->
            {@render openAlone()}
            <pre class="bench-inspector__source"><code>{source}</code></pre>
        {:else}
            <h2 class="bench-inspector__heading">{group.title}</h2>
            <p class="bench-inspector__meta text-meta">
                {count}
                {@render tagBadges(group.tags)}
            </p>
            {@render openAlone()}
        {/if}
    </section>

    {#if mounted}
        <section class="bench-inspector__section">
            <h2 class="bench-inspector__heading">Stage settings</h2>
            <BenchSettings stage={backdrop} {outline} {onstage} {onoutline} />
        </section>
    {/if}
</div>

<style>
.bench-inspector {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    min-width: 0;
    font-size: var(--font-size-sm);

    p {
        margin: 0;
    }
}

.bench-inspector__section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
    min-width: 0;
    max-width: 100%;

    & + & {
        padding-top: var(--space-md);
        border-top: var(--border-width) solid var(--border-color);
    }
}

.bench-inspector__description {
    color: var(--color-text-muted);
}

.bench-inspector__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);

    code {
        overflow-wrap: break-word;
    }
}

.bench-inspector__heading {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    overflow-wrap: anywhere;
}

.bench-inspector__source {
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    padding: var(--space-sm);
    overflow: auto;
    font-size: var(--font-size-xs);
    line-height: 1.5;
    background-color: var(--color-surface);
    border: var(--border-width) solid var(--border-color);
    border-radius: var(--radius);
    white-space: pre-wrap;
    overflow-wrap: anywhere;

    code {
        font-size: inherit;
    }
}
</style>
