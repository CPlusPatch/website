<script lang="ts">
import { presetOf, RATES, rateText } from "@cpluspatch/render";
import { iconSvg } from "@cpluspatch/ui";
import { flushSync, onMount } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { cue } from "../../audio/cues.ts";
import { getView } from "../../state/context.ts";
import { menuTarget } from "./rate-menu.ts";

// The fastest rate is at the top.
const MENU_ROWS = RATES.map((preset, k) => ({ preset, k })).toReversed();

const view = getView();

let rateButton: HTMLButtonElement | undefined;
const rateItems: (HTMLButtonElement | undefined)[] = $state([]);

let menuOpen = $state(false);

const openRateMenu = () => {
    // A hidden item can't take focus.
    flushSync(() => {
        menuOpen = true;
    });
    rateItems[presetOf(view.clock.rate)]?.focus();
};

const closeRateMenu = (refocus: boolean) => {
    if (!menuOpen) return;

    menuOpen = false;
    if (refocus) rateButton?.focus();
};

const pickRate = (preset: number) => {
    const next = view.clock.rate < 0 ? -preset : preset;
    if (next !== view.clock.rate) cue("rate");
    view.setClock({ rate: next });
    closeRateMenu(true);
};

const menuItems = () => rateItems.toReversed();

// Native listeners, as the shortcuts handler on the document would see a delegated one too late.
const rateButtonKeys: Attachment<HTMLElement> = (node) =>
    on(node, "keydown", (event) => {
        if (event.key === "Escape" && menuOpen) {
            // Otherwise the shortcut clears the selection and the menu stays.
            event.preventDefault();
            event.stopPropagation();
            closeRateMenu(true);

            return;
        }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

        event.preventDefault();
        if (menuOpen) menuItems()[0]?.focus();
        else openRateMenu();
    });

const rateMenuKeys: Attachment<HTMLElement> = (node) =>
    on(node, "keydown", (event) => {
        const items = menuItems();
        const k =
            event.target instanceof HTMLButtonElement
                ? items.indexOf(event.target)
                : -1;
        const to = menuTarget(event.key, k, items.length);

        if (to !== undefined) {
            event.preventDefault();
            items[to]?.focus();
        } else if (event.key === "Escape") {
            event.preventDefault();
            closeRateMenu(true);
        } else if (event.key === "Tab") {
            closeRateMenu(true);
        } else if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        // Space and Esc must not also reach the shortcuts.
        event.stopPropagation();
    });

onMount(() =>
    on(document, "pointerdown", (event) => {
        const target = event.target;
        if (
            target instanceof Element &&
            target.closest(".orrery__rate-menu, .orrery__rate")
        ) {
            return;
        }

        closeRateMenu(false);
    }),
);
</script>

<div class="orrery__rate-wrap">
    <button
        type="button"
        class="orrery__rate"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls="orrery-rate-menu"
        bind:this={rateButton}
        onclick={() => (menuOpen ? closeRateMenu(true) : openRateMenu())}
        {@attach rateButtonKeys}
    >
        <!-- biome-ignore format: Whitespace between the label and the icon is rendered. -->
        <span class="orrery__rate-label">{rateText(view.clock.rate)}</span>{@html iconSvg(
            "chevron-down",
        )}
    </button>
    <div
        id="orrery-rate-menu"
        class="orrery__rate-menu"
        role="menu"
        aria-label="Time warp"
        hidden={!menuOpen}
        {@attach rateMenuKeys}
    >
        {#each MENU_ROWS as { preset, k } (k)}
            <button
                type="button"
                class="orrery__rate-item"
                role="menuitemradio"
                tabindex="-1"
                aria-checked={k === presetOf(view.clock.rate)}
                bind:this={rateItems[k]}
                onclick={() => pickRate(preset)}
            >
                {@html iconSvg("check")}
                <span>{rateText(preset)}</span>
            </button>
        {/each}
    </div>
</div>

<style>
.orrery__rate {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    /* The width stays the same whatever the label says. */
    min-inline-size: 7.75rem;
    block-size: var(--orrery-clock-control);
    padding: 0 0.625rem;
    border: 1px solid var(--orrery-control-frame);
    border-radius: 0;
    background-color: var(--orrery-panel-raised);
    color: var(--orrery-text);
    font: 500 var(--orrery-size-sm) var(--orrery-font-data);
    white-space: nowrap;
    cursor: pointer;

    /* Over the neighbour whose border it overlaps. */
    &:focus-visible {
        position: relative;
        z-index: 3;
        outline: 2px solid var(--orrery-text);
        outline-offset: 2px;
    }

    @media (hover: hover) {
        &:hover {
            background-color: var(--orrery-panel-hover);
        }
    }

    &[aria-expanded="true"] {
        border-color: var(--orrery-muted);
        background-color: var(--orrery-panel-hover);
    }

    /* The icon is raw HTML. */
    :global(svg) {
        flex: none;
        inline-size: 12px;
        block-size: 12px;
        color: var(--orrery-muted);
    }
}

/* TimeBar sets the reverse class on the clock. */
:global(.orrery__clock--reverse) .orrery__rate {
    border-color: var(--orrery-hold);
}

:global(.orrery__clock--reverse) .orrery__rate-label {
    color: var(--orrery-hold);
}

.orrery__rate-menu {
    position: absolute;
    z-index: 4;
    inset-inline-start: 0;
    inset-block-end: calc(100% + 6px);
    min-inline-size: 170px;
    padding: 4px 0;
    border: 1px solid var(--orrery-frame);
    background-color: var(--orrery-panel-solid);
}

/* The sound menu renders its items with this class too, so it's global. */
:global(.orrery__rate-item) {
    display: grid;
    grid-template-columns: 12px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    inline-size: 100%;
    block-size: var(--orrery-control-lg);
    padding: 0 var(--orrery-pad);
    border: 0;
    background: none;
    color: var(--orrery-text);
    font: 500 var(--orrery-size-sm) var(--orrery-font-data);
    text-align: start;
    cursor: pointer;

    :global(svg) {
        inline-size: 12px;
        block-size: 12px;
        visibility: hidden;
    }

    &[aria-checked="true"] :global(svg) {
        visibility: visible;
    }

    @media (hover: hover) {
        &:hover {
            background-color: var(--orrery-panel-raised);
        }
    }

    &:focus-visible {
        background-color: var(--orrery-panel-raised);
    }

    &:focus-visible {
        outline: 1px solid var(--orrery-muted);
        outline-offset: -1px;
    }
}

@media (max-width: 720px) {
    .orrery__rate {
        min-inline-size: 7rem;
        padding: 0 0.5rem;
    }

    :global(.orrery__rate-item) {
        block-size: var(--control-height-md);
    }
}

.orrery__rate-wrap {
    position: relative;
    margin-inline-start: -1px;
}

@media (forced-colors: active) {
    .orrery__rate {
        border-color: ButtonText;
    }
}
</style>
