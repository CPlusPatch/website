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
