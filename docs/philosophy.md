# Design philosophy

## Keep it simple

Before adding a dependency, an abstraction or an option, check whether a few lines would do. Remove code once nothing uses it.

Use what the browser already has: the accordion is a `<details>`, the dropdown is a native popover, and layouts are plain CSS. Astro renders every page to static HTML. The CSS and behaviours don't depend on Astro, so the `.astro` files are thin markup that other frameworks can repeat.

## Small, separate pieces

Each component does one thing. A media card is a card with a header image, and a message is a bubble with an avatar and a name. Split a component when it grows. Code that doesn't depend on the site, like the color generator, gets its own package under `packages/`.

## CSS variables decide the look

Colors, spacing, font sizes, radius and timing are CSS variables in `packages/ui/src/styles/`. Components use them instead of their own values, so a theme or style can restyle everything. See [Themes, styles and colors](themes.md).

## JavaScript is optional

Every page works without JavaScript, and scripts only add to it. The code block shows its code without JS and gets a copy button with it. Heavy code, like the gravity gun's physics, loads only when someone uses it.

## Accessible by default

Everything works with a keyboard and a screen reader, respects reduced motion and holds up in high contrast mode. Color is never the only signal.

## Tests check properties, not pictures

Gallery tests check that something holds for every story (no errors, passes axe, no overflow), so a deliberate visual change needs no baseline update. `deno run gallery:diff` shows the visual changes for review instead. See [Development workflow](workflow.md).
