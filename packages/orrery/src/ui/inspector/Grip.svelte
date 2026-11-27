<script lang="ts">
import { sheetAfterDrag } from "../sheet.ts";

type Props = {
    /** Whether the sheet shows all readouts. */
    open: boolean;
    hidden: boolean;
    /** The card, to tell whether the focus is inside it. */
    card: HTMLElement | undefined;
};

let { open = $bindable(), hidden, card }: Props = $props();

let grip: HTMLButtonElement | undefined;
let pressedAt: number | null = null;

const setSheet = (next: boolean) => {
    open = next;

    // The actions are about to be hidden, which would drop the focus.
    const held = document.activeElement?.closest(
        ".orrery__orbit-meta, .orrery__inspector-body, .orrery__inspector-foot",
    );
    if (!next && held && card?.contains(held)) grip?.focus();
};

const dragEnd = (event: PointerEvent) => {
    if (pressedAt === null) return;

    const dy = event.clientY - pressedAt;
    pressedAt = null;
    setSheet(sheetAfterDrag(dy, open));
};
</script>

<button
    type="button"
    class="orrery__orbit-grip"
    aria-label="All readouts"
    aria-expanded={open}
    {hidden}
    bind:this={grip}
    onpointerdown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return;

        pressedAt = event.clientY;
        grip?.setPointerCapture(event.pointerId);
    }}
    onpointerup={dragEnd}
    onpointercancel={() => {
        pressedAt = null;
    }}
    onclick={(event) => {
        // A pointer tap is handled on pointerup, so only a keyboard click gets here.
        if (event.detail === 0) setSheet(!open);
    }}
></button>

<style>
/* The handle that opens and closes the card on a phone. */
.orrery__orbit-grip {
    display: none;
}

@media (max-width: 720px) {
    .orrery__orbit-grip {
        display: grid;
        flex: none;
        align-content: center;
        block-size: var(--control-height-md);
        padding: 0;
        border: 0;
        background: none;
        cursor: grab;
        touch-action: none;

        &[hidden] {
            display: none;
        }

        &::before {
            content: "";
            display: block;
            inline-size: 40px;
            block-size: 4px;
            margin: 0 auto;
            background: var(--orrery-frame);
        }

        @media (hover: hover) {
            &:hover::before {
                background: var(--orrery-muted);
            }
        }

        &:focus-visible {
            outline-offset: -2px;
        }

        &:not([hidden]) + :global(.orrery__inspector-head) {
            padding-block-start: 0;
        }
    }
}
</style>
