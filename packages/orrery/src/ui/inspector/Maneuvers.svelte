<script lang="ts">
import { PRESETS } from "@cpluspatch/catalog";
import { dateText } from "@cpluspatch/render";
import { iconSvg } from "@cpluspatch/ui";
import { tick } from "svelte";
import { getAnnouncer, getDocument, getView } from "../../state/context.ts";
import Warning from "../Warning.svelte";
import {
    firstUpcoming,
    maneuverRows,
    rejectedRemove,
    removedMessage,
    removeLabel,
} from "./maneuvers.ts";

type Props = {
    /** The body whose events the section lists. */
    id: string;
    /** The clock in seconds since J2000, as of the card's last refresh. */
    now: number;
    /** Called after the last event is removed, as the section is gone then. */
    onEmptied: () => void;
};

const { id, now, onEmptied }: Props = $props();

const documents = getDocument();
const view = getView();
const announce = getAnnouncer();

let list = $state<HTMLElement>();
let error = $state("");

const rows = $derived(maneuverRows(documents.doc.timeline, id, now));
const clockIndex = $derived(firstUpcoming(rows));

// An error is about the document it was raised against.
$effect(() => {
    void documents.doc;

    error = "";
});

const remove = async (index: number) => {
    const row = rows[index];
    if (!row) return;

    const result = documents.dispatch({ type: "remove-event", id: row.id });
    if (!result.ok) {
        error =
            rejectedRemove(documents.doc, row.id, PRESETS) ??
            result.errors.join(" ");
        // The warning sits under the list, often below the card's scrolled view.
        await tick();
        list?.parentElement
            ?.querySelector(".orrery__warning")
            ?.scrollIntoView({ block: "nearest" });

        return;
    }

    announce(removedMessage(row));

    // Only the removed row's button had focus, so it would drop to <body>.
    await tick();
    if (rows.length === 0) {
        onEmptied();

        return;
    }

    const buttons = list?.querySelectorAll<HTMLElement>(
        ".orrery__maneuver-remove",
    );
    // The rows after the removed one have shifted up to its index.
    (buttons?.[index] ?? buttons?.[index - 1])?.focus();
};
</script>

{#snippet clockRule()}
    <li class="orrery__maneuver-clock" aria-hidden="true">
        <span class="orrery__maneuver-bar"></span>
        <span class="orrery__maneuver-tag">Now {dateText(now)}</span>
    </li>
{/snippet}

{#if rows.length > 0}
    <section class="orrery__maneuvers">
        <h3>Maneuvers</h3>
        <ol class="orrery__maneuver-list" bind:this={list}>
            {#each rows as row, index (row.id)}
                {#if index === clockIndex}
                    {@render clockRule()}
                {/if}
                <li
                    class="orrery__maneuver"
                    data-past={row.past ? "" : undefined}
                >
                    <span class="orrery__maneuver-node">
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                            {#if row.kind === "burn"}
                                <circle data-shape cx="6" cy="6" r="5" />
                            {:else}
                                <path data-shape d="M6 .5 11.5 6 6 11.5.5 6Z" />
                            {/if}
                        </svg>
                        <span class="visually-hidden">
                            {row.past ? "Past" : "Upcoming"}
                        </span>
                    </span>
                    <div>
                        <div class="orrery__maneuver-line">
                            <button
                                type="button"
                                class="orrery__maneuver-when"
                                aria-label="Jump clock to {row.when}"
                                onclick={() =>
                                    view.setClock({ t: row.t, paused: true })}
                            >
                                {row.when}
                            </button>
                            <button
                                type="button"
                                class="orrery__maneuver-remove"
                                aria-label={removeLabel(row)}
                                onclick={() => remove(index)}
                            >
                                {@html iconSvg("x")}
                            </button>
                        </div>
                        <div class="orrery__maneuver-detail">
                            <span class="orrery__maneuver-what">
                                {#if row.kind === "burn"}
                                    Burn
                                    <span class="orrery__maneuver-dv"
                                        >Δv {row.amount} {row.unit}</span
                                    >
                                {:else}
                                    {row.what}
                                {/if}
                            </span>
                            <span class="orrery__maneuver-ago">{row.ago}</span>
                        </div>
                    </div>
                </li>
            {/each}
            {#if clockIndex === rows.length}
                {@render clockRule()}
            {/if}
        </ol>
        <Warning text={error} hidden={error === ""} />
    </section>
{/if}
