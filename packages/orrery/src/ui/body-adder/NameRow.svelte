<script lang="ts">
import { NAME_MAX } from "./fields.ts";

type Props = {
    /** The text the field starts with. */
    value: string;
    /** The message under the field, `null` for none. `undefined` before it's first checked. */
    error: string | null | undefined;
    /** Called when the text changes. */
    onInput: () => void;
    input?: HTMLInputElement;
};

let { value, error, onInput, input = $bindable() }: Props = $props();
</script>

<div class="orrery__form-row">
    <label for="orrery-add-name">Name</label>
    <div class="orrery__stepper orrery__stepper--text">
        <input
            type="text"
            name="name"
            maxlength={NAME_MAX}
            autocomplete="off"
            spellcheck="false"
            id="orrery-add-name"
            aria-describedby="orrery-add-name-error"
            aria-invalid={error === undefined ? undefined : error !== null}
            value={value.slice(0, NAME_MAX)}
            bind:this={input}
            oninput={onInput}
        >
    </div>
    <p
        class="orrery__stepper-error"
        id="orrery-add-name-error"
        hidden={error == null}
    >
        {error ?? ""}
    </p>
</div>
