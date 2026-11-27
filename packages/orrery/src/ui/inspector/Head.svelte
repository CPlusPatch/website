<script lang="ts">
import { styleOf } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { getDocument, getView } from "../../state/context.ts";
import { bodyMarker } from "../body-marker.ts";
import { lifetimeText } from "./lifetime.ts";
import type { Mode } from "./mode.ts";

type Props = {
    body: Body | undefined;
    parent: Body | undefined;
    mode: Mode;
    /** Leaves the Add body form. */
    cancel: () => void;
};

const { body, parent, mode, cancel }: Props = $props();

const documents = getDocument();
const view = getView();

let close: HTMLButtonElement | undefined;

const adding = $derived(mode === "add");
const lifetime = $derived(body ? lifetimeText(body.lifetime) : null);
const title = $derived(
    adding
        ? "Add a body"
        : mode === "card"
          ? (body?.name ?? "")
          : `${mode === "edit" ? "Edit" : "Burn"} ${body?.name ?? ""}`,
);

/** Moves the focus to the close button. */
export const focusClose = () => {
    close?.focus();
};

// A native listener, as the shortcut that clears the selection would see a delegated one too late.
const cancelOnEscape: Attachment<HTMLElement> = (node) =>
    on(node, "keydown", (event) => {
        if (event.key !== "Escape" || mode !== "add") return;

        // The form's Esc doesn't reach the head.
        event.preventDefault();
        cancel();
    });
</script>

<div class="orrery__inspector-head orrery__inspector-head--ruled">
    <div class="orrery__inspector-titles">
        <h2 id="orrery-orbit-title" class="orrery__inspector-title">
            <span
                class="orrery__orbit-marker"
                hidden={adding}
                style:color={body ? documents.colorOf(body, parent) : undefined}
                >{@html body ? bodyMarker(body) : ""}</span
            ><span>{title}</span>
        </h2>
        <!-- Under the title, so the form heads keep the kind and parent in view too. -->
        <p class="orrery__orbit-meta" hidden={mode !== "card"}>
            {#if body && !adding}
                {`${styleOf(body).label} `}
                {#if parent}
                    around
                    <!-- Keyed, so following it re-renders the link and the focus moves on. -->
                    {#key body.id}
                        <button
                            type="button"
                            class="orrery__orbit-link"
                            onclick={() => view.select(parent.id)}
                        >
                            {parent.name}
                        </button>
                    {/key}
                {:else}
                    at the centre
                {/if}
            {/if}
        </p>
        {#if mode === "card" && body && lifetime}
            <p class="orrery__orbit-lifetime">{lifetime}</p>
        {/if}
    </div>
    <button
        type="button"
        class={buttonClasses({
            variant: "ghost",
            tone: "neutral",
            size: "icon-sm",
        }).join(" ")}
        aria-label={adding ? "Cancel" : "Clear selection"}
        bind:this={close}
        onclick={() => {
            if (mode === "add") cancel();
            else view.select(null);
        }}
        {@attach cancelOnEscape}
    >
        {@html iconSvg("x")}
    </button>
</div>

<style>
/* The body inspector's head: a rule under it, as the headline and the scroll area follow. */
.orrery__inspector-head--ruled {
    border-block-end: 1px solid var(--orrery-rule);
}

.orrery__orbit-lifetime {
    margin: 0 0 calc(var(--space-md) - var(--space-xs) / 2);
    color: var(--orrery-muted);
    font-size: var(--orrery-size-sm);
    font-variant-numeric: tabular-nums;
}

.orrery__inspector-titles {
    flex: 1;
    min-inline-size: 0;

    .orrery__orbit-meta,
    .orrery__orbit-lifetime {
        margin: 0;
    }
}

/* The marker and the name share a line, so the marker needs no offset. */
.orrery__inspector-title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: 0;
    overflow-wrap: anywhere;
    font: 600 var(--orrery-size-lg) / 1.75rem var(--orrery-font-ui);
    letter-spacing: 0.02em;

    .orrery__orbit-marker {
        margin-block-start: 0;
    }
}

.orrery__orbit-link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--orrery-text);
    font: inherit;
    text-decoration: underline 1px var(--orrery-frame);
    text-underline-offset: 3px;
    cursor: pointer;

    @media (hover: hover) {
        &:hover {
            text-decoration-color: var(--orrery-text);
        }
    }
}

@media (max-width: 720px) {
    /* Touch targets. The hit areas of small controls reach past their boxes. */
    .orrery__inspector-head--ruled :global(.button--size-icon-sm) {
        /* Paints above the parent link's hit area. */
        position: relative;
        inline-size: var(--control-height-md);
        block-size: var(--control-height-md);
    }

    .orrery__orbit-link {
        position: relative;

        &::before {
            content: "";
            position: absolute;
            inset: 50% auto auto 50%;
            inline-size: var(--control-height-md);
            block-size: var(--control-height-md);
            transform: translate(-50%, -50%);
        }
    }
}
</style>
