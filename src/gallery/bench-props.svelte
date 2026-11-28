<script lang="ts">
import Icon from "@cpluspatch/ui/svelte/icon.svelte";
import Button from "@cpluspatch/ui/svelte/ui/button.svelte";
import {
    type BenchGroup,
    type BenchStory,
    fixedProps,
    previewOf,
} from "./bench.ts";
import BenchControls from "./bench-controls.svelte";
import BenchTags from "./bench-tags.svelte";
import type { ControlValues } from "./controls.ts";

/**
 * The inspector's Props tab: a story's controls, with a note on the props
 * the story sets that the controls don't reach. With no story picked it
 * says what the group has and where the controls are.
 */
type Props = {
    group: BenchGroup;
    /** The story on stage, if one is. */
    story?: BenchStory;
    /** The story's control values. */
    values: ControlValues;
    /** Whether JS has run, which the controls need. */
    mounted: boolean;
    /** Where the group's stories open alone, shown when no story is on stage. */
    href?: string;
    /** The controls' values after a pick. */
    onchange: (values: ControlValues) => void;
};

const { group, story, values, mounted, href, onchange }: Props = $props();

const count = $derived(
    `${group.stories.length} ${group.stories.length === 1 ? "story" : "stories"}`,
);
const fixed = $derived(story ? fixedProps(story) : []);
// "a", "a and b", "a, b and c": en-GB has no Oxford comma.
const LIST = new Intl.ListFormat("en-GB", {
    style: "long",
    type: "conjunction",
});
// The full stop is a part too, since whitespace in the template would put a space before it.
const parts = $derived([
    ...LIST.formatToParts(fixed),
    { type: "literal", value: "." },
]);
</script>

<div class="bench-props">
    {#if !story}
        <p class="bench-props__meta text-meta">
            {count}
            <BenchTags tags={group.tags} />
        </p>
        <p class="bench-props__note">
            Controls appear when one story is on stage.
        </p>
        {#if href}
            <div>
                <Button {href} variant="outline" tone="secondary" size="sm">
                    Open alone
                    <Icon name="lucide:maximize" aria-hidden="true" />
                </Button>
            </div>
        {/if}
    {:else if story.controls.length === 0}
        <p class="bench-props__note">
            The <code>{story.name}</code> story has no controls.
        </p>
    {:else}
        {#if mounted}
            <BenchControls
                controls={story.controls}
                {values}
                preview={previewOf(story, values)}
                {onchange}
            />
        {/if}
        {#if fixed.length > 0}
            <p class="bench-props__note bench-props__note--small">
                The story fixes
                {#each parts as part, i (i)}
                    {#if part.type === "element"}
                        <code>{part.value}</code>
                    {:else}
                        {part.value}
                    {/if}
                {/each}
            </p>
        {/if}
    {/if}
</div>

<style>
.bench-props {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    min-width: 0;

    p {
        margin: 0;
    }
}

.bench-props__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
}

.bench-props__note {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);

    code {
        overflow-wrap: anywhere;
    }
}

.bench-props__note--small {
    font-size: var(--font-size-xs);
}
</style>
