<script lang="ts">
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import type { Snippet } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";

type Props = {
    /** The form's id, which the Apply button in the foot submits. */
    id: string;
    /** Puts the fields two to a row. */
    pairs?: boolean;
    /** The element the Cancel and Apply row moves to, as its last child. */
    footTarget: HTMLElement;
    applyDisabled?: boolean;
    /** Called on Apply, or Enter in a field. */
    onApply: () => void;
    /** Called on Cancel and Esc. */
    onCancel: () => void;
    children: Snippet;
};

const {
    id,
    pairs = false,
    footTarget,
    applyDisabled = false,
    onApply,
    onCancel,
    children,
}: Props = $props();

// Native listeners, as the shortcuts handler on the document would see a delegated one too late.
const cancelOnEscape = (node: HTMLElement) =>
    on(node, "keydown", (event) => {
        if (event.key !== "Escape") return;

        // The shortcut that clears the selection skips a handled key.
        event.preventDefault();
        event.stopPropagation();
        onCancel();
    });

const pin: Attachment<HTMLElement> = (node) => {
    footTarget.append(node);
    const off = cancelOnEscape(node);

    return () => {
        off();
        node.remove();
    };
};
</script>

<form
    class={["orrery__form", pairs && "orrery__form--pairs"]}
    novalidate
    aria-labelledby="orrery-orbit-title"
    {id}
    onsubmit={(event) => {
        event.preventDefault();
        onApply();
    }}
    {@attach cancelOnEscape}
>
    {@render children()}
    <div
        class="orrery__inspector-foot orrery__inspector-foot--form"
        {@attach pin}
    >
        <button
            type="button"
            class={buttonClasses({ variant: "outline", tone: "neutral" }).join(
                " ",
            )}
            onclick={onCancel}
        >
            Cancel
        </button><button
            type="submit"
            class={buttonClasses().join(" ")}
            form={id}
            disabled={applyDisabled}
        >
            Apply
        </button>
    </div>
</form>
