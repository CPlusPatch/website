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
