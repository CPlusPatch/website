# Themes and colours

All colours are CSS variables, so a theme is basically a stylesheet that overrides them. Themes support both light and dark mode.

To use a theme, set `data-theme` on the `<html>` element (e.g. `data-theme="nord"`). You can also try them out in the gallery from the Display menu.

## Which colour to use

`--color-primary`, `--color-secondary` and the other role colours have enough contrast to be used for text. They also work as backgrounds, with `--color-on-accent` for the text on top.

The `-accent` variants (`--color-primary-accent` etc.) are only meant for borders, shadows and other decoration. Don't use them for text.

## Editing the colours

The default and Ocean themes are generated from `src/styles/themes/palette.config.ts`. After changing it, run `deno run theme` to update the stylesheets. It also prints a contrast report.

Don't edit the generated colours by hand, CI fails if they don't match the config.

## Adding a theme

Copy one of the existing files in `src/styles/themes/` (`nord.css` is a good starting point), then import it in `src/styles/index.css` and add it to the `THEMES` list in `src/gallery/display-settings.astro` so it shows up in the gallery. If you'd rather have the colours generated, add it to `themes` in `palette.config.ts` instead.

Text should have at least 4.5:1 contrast with the background, and input borders at least 3:1.
