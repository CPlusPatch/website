<script lang="ts">
import Icon from "@cpluspatch/ui/svelte/icon.svelte";
import Button from "@cpluspatch/ui/svelte/ui/button.svelte";
import { onDestroy } from "svelte";

/**
 * A story's source as markup, with a button that copies it. The button
 * shows a check for a moment, and a live region beside it says what
 * happened in words, including when the copy fails.
 */
type Props = {
    source: string;
};

const { source }: Props = $props();

const COPIED_MS = 1500;
// A failure tells the reader what to do instead, so it stays long enough to read.
const FAILED_MS = 5000;
const COPIED = "Copied";

let status = $state("");
let failed = $state(false);
let timer: ReturnType<typeof setTimeout> | undefined;

const copy = async () => {
    clearTimeout(timer);
    try {
        await navigator.clipboard.writeText(source);
        status = COPIED;
        failed = false;
    } catch {
        // Writing needs a secure page and, in some browsers, a permission.
        status = "Couldn't copy. Select the code instead.";
        failed = true;
    }
    timer = setTimeout(
        () => {
            status = "";
            failed = false;
        },
        failed ? FAILED_MS : COPIED_MS,
    );
};

onDestroy(() => clearTimeout(timer));
</script>

<div class="bench-code">
    <div class="bench-code__header">
        <span class="bench-code__label text-meta">Code</span>
        <div class="bench-code__actions">
            <span
                class="bench-code__status"
                class:bench-code__status--failed={failed}
                role="status"
                >{status}</span
            >
            <Button
                size="icon-sm"
                variant="ghost"
                tone="secondary"
                aria-label="Copy code"
                onclick={copy}
            >
                <Icon
                    name={status === COPIED ? "lucide:check" : "lucide:copy"}
                    aria-hidden="true"
                />
            </Button>
        </div>
    </div>
    <pre class="bench-code__source"><code>{source}</code></pre>
</div>

<style>
.bench-code {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    width: 100%;
    min-width: 0;
}

.bench-code__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.bench-code__actions {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    min-width: 0;
}

.bench-code__status {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-align: end;
}

.bench-code__status--failed {
    color: var(--color-destructive);
}

.bench-code__label {
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.bench-code__source {
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    padding: var(--space-sm);
    overflow: auto;
    font-size: var(--font-size-xs);
    line-height: 1.5;
    background-color: var(--color-surface);
    border: var(--border-width) solid var(--border-color);
    border-radius: var(--radius);
    white-space: pre-wrap;
    overflow-wrap: anywhere;

    code {
        font-size: inherit;
    }
}
</style>
