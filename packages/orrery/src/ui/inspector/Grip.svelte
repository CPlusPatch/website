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
