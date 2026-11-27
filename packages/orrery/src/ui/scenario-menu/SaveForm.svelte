<script lang="ts">
import { classes } from "./buttons.ts";

type Props = {
    /** What's wrong with the name, if anything. */
    error: string | null;
    /** Saves under `name`. Returns true when it saved. */
    onSave: (name: string) => boolean;
};

const { error, onSave }: Props = $props();

let input: HTMLInputElement | undefined;
let name = $state("");

/** Moves focus to the name field. */
export const focus = (): void => input?.focus();
</script>

<form
    class="orrery__form-row"
    novalidate
    onsubmit={(event) => {
        event.preventDefault();
        if (onSave(name.trim())) name = "";
    }}
>
    <label for="orrery-scenario-name">Save the current view as</label>
    <div class="orrery__stepper">
        <input
            bind:this={input}
            bind:value={name}
            id="orrery-scenario-name"
            type="text"
            autocomplete="off"
            placeholder="Name"
            aria-describedby="orrery-scenario-error"
            aria-invalid={error !== null}
        >
        <button type="submit" class={classes("solid")}>Save</button>
    </div>
    <p
        class="orrery__stepper-error"
        id="orrery-scenario-error"
        hidden={error === null}
    >
        {error ?? ""}
    </p>
</form>

<style>
/* The stepper class is doubled in this file to outrank the shared rules in forms.css. */

/* The text fields here are left-aligned, unlike the number steppers. */
.orrery__stepper.orrery__stepper input {
    text-align: start;
    font: 500 var(--orrery-size-md) var(--orrery-font-ui);

    &::placeholder {
        color: var(--orrery-dim);
    }
}

/* On a phone the buttons are taller than the field, so it grows with them. */
.orrery__stepper.orrery__stepper {
    block-size: auto;
    min-block-size: var(--orrery-control-lg);
}

/* The same width, so the Save and Copy rows line up. */
.orrery__stepper.orrery__stepper > :global(.button) {
    block-size: auto;
    min-inline-size: var(--scenarios-button-size);
    border-width: 0 0 0 1px;
    border-color: var(--orrery-frame);
}
</style>
