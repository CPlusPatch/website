# Themes, styles and colors

A theme is a stylesheet that overrides the color variables, in light and dark. It sets color only: corners, borders, motion and fonts come from the style, so any theme goes with any style.

Set `data-theme="nord"` on `<html>`, and `data-scheme="light"` or `"dark"` to force a mode. Visitors pick both from the Display menu or with `theme <name>` in the terminal.

## Which color to use

| Variable                                  | Use for                                              |
| ----------------------------------------- | ---------------------------------------------------- |
| `--color-primary`, `--color-secondary`, … | Text, or backgrounds with `--color-on-accent` on top |
| `--color-primary-accent`, …               | Borders, shadows and decoration, never text          |

## Editing the colors

The default and Ocean themes are generated from `packages/ui/src/styles/themes/palette.config.ts`. After changing it, run `deno run theme`, which also prints a contrast report. Don't edit the generated colors by hand: CI fails if they don't match the config.

## Adding a theme

Copy a file in `packages/ui/src/styles/themes/` (`nord.css` is a good start), import it in `packages/ui/src/styles/themes.css` and add it to `THEMES` in `packages/ui/src/styles/themes/index.ts` so it shows up in the Display menu. Keep its first block's selectors in the same form as the others: the `[data-theme-preview]` one is what colors its swatch in the menu. If you'd rather have the colors generated, add it to `themes` in `palette.config.ts` instead.

Text should have at least 4.5:1 contrast with the background, and input borders at least 3:1.

## Styles

A style sets `--radius`, `--border-width`, `--transition` and the fonts (`--font-base`, `--font-mono`, `--font-display`, with `--weight-display` and `--display-scale` for titles in a wider face). Poster, the default, is `tokens.css` itself; Soft, Print and Mono are in `packages/ui/src/styles/styles/`. Set one with `data-style` on `<html>`, or from the Display menu's Style row. The Radius, Spacing and Font size overrides still win over a style.

To add one, copy a file there, import it in `packages/ui/src/styles/styles.css` and add it to `STYLES` in `packages/ui/src/styles/styles/index.ts`. Register any font it names in `astro.config.mjs` and render it in `head.astro` without preload, so it only downloads while the style is on. Repeat the reduced-motion opt-out if it sets `--transition`.
