<script lang="ts" setup>
/**
 * Key-value pair of command and its output
 * Order of the commands is important as it will be used to display the output in the terminal
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { Entry, SubmitDetail } from "../../lib/terminal.ts";

const {
    entries,
    cwd = "~",
    interactive = false,
} = defineProps<{
    entries: Entry[];
    cwd?: string;
    interactive?: boolean;
}>();

const root = ref<HTMLElement>();
// Render mirror only. Props are frozen after hydration, so replaced via 'terminal:set'
const shown = ref<Entry[]>([...entries]);

const prompt = computed(() => `guest@cpluspatch.com:${cwd}$ `);
const cssPrompt = computed(() => `'${prompt.value}'`); // Needs to be quoted before being passed to CSS

const onSet = (e: Event) => {
    shown.value = [...(e as CustomEvent<Entry[]>).detail];
    nextTick(() => {
        if (root.value) root.value.scrollTop = root.value.scrollHeight;
    });
};
onMounted(() => root.value?.addEventListener("terminal:set", onSet));
onBeforeUnmount(() => root.value?.removeEventListener("terminal:set", onSet));

const submit = (e: KeyboardEvent) => {
    if (e.isComposing) return;

    const field = e.target as HTMLInputElement;
    const command = field.value.trim();
    if (!command) return;

    field.value = "";
    root.value?.dispatchEvent(
        new CustomEvent<SubmitDetail>("terminal:submit", {
            detail: {
                command,
                // Plain copies; avoids handing Vue reactive proxies to outside code
                entries: shown.value.map((entry) => ({ ...entry })),
            },
            bubbles: true,
        }),
    );
};
</script>

<template>
    <div ref="root" class="terminal panel">
        <div v-for="(entry, i) in shown" :key="i" class="terminal__pair">
            <div class="terminal__command">{{ entry.command }}</div>
            <div class="terminal__output">{{ entry.output }}</div>
        </div>
        <div class="terminal__input">
            <span class="terminal__prompt">{{ prompt }}</span>
            <input
                :disabled="!interactive"
                type="text"
                class="terminal__input-field"
                @keydown.enter="submit"
            >
        </div>
    </div>
</template>

<style scoped>
/*
 * Surface, border and top rule come from .panel in utilities.css. No .lift:
 * the terminal is something you type into, so it shouldn't jump on hover.
 */
.terminal {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    width: 100%;
    max-height: 24rem;
    overflow-y: auto;
    padding: var(--space-md);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    line-height: 1.6;
    transition: border-color var(--transition);

    /* The input has no outline of its own, so the whole frame shows focus. */
    &:focus-within {
        border-color: var(--color-primary);
    }

    .terminal__pair {
        display: flex;
        flex-direction: column;
    }

    .terminal__command {
        color: var(--color-text);
        overflow-wrap: anywhere;

        &::before {
            content: v-bind(cssPrompt);
            color: var(--color-primary);
        }
    }

    .terminal__output {
        color: var(--color-text-muted);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }

    .terminal__input {
        display: flex;
        align-items: baseline;
        gap: 1ch;
    }

    .terminal__prompt {
        flex: none;
        color: var(--color-primary);
    }

    .terminal__input-field {
        flex: 1;
        min-width: 0;
        padding: 0;
        font: inherit;
        color: var(--color-text);
        caret-color: var(--color-primary);
        background: transparent;
        border: none;

        &:focus-visible {
            outline: none;
        }
    }
}
</style>
