/**
 * The colours of highlighted code, as Shiki's CSS-variables theme takes them:
 * every one a CSS variable (--code-*), each defaulting to a palette token, so
 * highlighted code follows light, dark and every theme rather than baking in
 * a fixed scheme. Override any --code-* variable on an ancestor to recolour;
 * the names are Shiki's own (see
 * https://shiki.style/guide/theme-colors#css-variables-theme).
 *
 * Plain data, so any adapter can build the theme with its own Shiki:
 *
 *   createCssVariablesTheme({
 *       name: "website",
 *       variablePrefix: CODE_VARIABLE_PREFIX,
 *       variableDefaults: CODE_VARIABLE_DEFAULTS,
 *   });
 */
export const CODE_VARIABLE_PREFIX = "--code-";

export const CODE_VARIABLE_DEFAULTS: Record<string, string> = {
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
};
