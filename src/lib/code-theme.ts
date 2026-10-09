import { createCssVariablesTheme } from "shiki/core";

/**
 * The Shiki theme for <Code>: every colour a CSS variable (--code-*), each
 * defaulting to a palette token, so highlighted code follows light, dark and
 * every theme rather than baking in a fixed scheme. Override any --code-*
 * variable on an ancestor to recolour; the names are Shiki's own (see
 * https://shiki.style/guide/theme-colors#css-variables-theme).
 */
export const codeTheme = createCssVariablesTheme({
    name: "website",
    variablePrefix: "--code-",
    variableDefaults: {
        foreground: "var(--color-text)",
        background: "var(--color-bg-alt)",
        "token-comment": "var(--color-text-muted)",
        "token-punctuation": "var(--color-text-muted)",
        "token-keyword": "var(--color-primary)",
        "token-link": "var(--color-primary)",
        "token-string": "var(--color-success)",
        "token-string-expression": "var(--color-success)",
        "token-inserted": "var(--color-success)",
        "token-constant": "var(--color-warning)",
        "token-changed": "var(--color-warning)",
        "token-function": "var(--color-secondary)",
        "token-parameter": "var(--color-text)",
        "token-deleted": "var(--color-destructive)",
        // Terminal output, onto the palette's tones.
        "ansi-black": "var(--color-text-muted)",
        "ansi-red": "var(--color-destructive)",
        "ansi-green": "var(--color-success)",
        "ansi-yellow": "var(--color-warning)",
        "ansi-blue": "var(--color-primary)",
        "ansi-magenta": "var(--color-secondary)",
        "ansi-cyan": "var(--color-secondary)",
        "ansi-white": "var(--color-text)",
        "ansi-bright-black": "var(--color-text-muted)",
        "ansi-bright-red": "var(--color-destructive)",
        "ansi-bright-green": "var(--color-success)",
        "ansi-bright-yellow": "var(--color-warning)",
        "ansi-bright-blue": "var(--color-primary)",
        "ansi-bright-magenta": "var(--color-secondary)",
        "ansi-bright-cyan": "var(--color-secondary)",
        "ansi-bright-white": "var(--color-text)",
    },
});
