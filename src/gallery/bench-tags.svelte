<script lang="ts">
import Badge from "@cpluspatch/ui/svelte/ui/badge.svelte";
import { TAG_HINTS } from "./bench.ts";
import type { Tag } from "./story.ts";

/** A badge for each tag, with what it means as the hint. */
type Props = {
    tags: Tag[];
};

const { tags }: Props = $props();
</script>

{#each tags as tag (tag)}
    <Badge variant="outline" tone="secondary" size="sm" title={TAG_HINTS[tag]}>
        {tag}
    </Badge>
{/each}
