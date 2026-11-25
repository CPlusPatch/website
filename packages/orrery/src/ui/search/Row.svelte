<script lang="ts">
import { colorOf, roleOf, styleOf } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import { marked } from "../../search.ts";
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

const parent = $derived(
    bodies.find((candidate) => candidate.id === body.parent),
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
    body.parent !== null && system(bodies, body.id).length > 0,
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
        style:color={colorOf(body, parent)}
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
