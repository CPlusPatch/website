# Design philosophy

A few ideas that most decisions in this codebase come back to.

## Keep it simple

Less code means less to break and less to read. Before adding a dependency, an abstraction or an option, check whether a few lines would do the job, and remove things once nothing uses them.

Where the browser already does something, use that. The accordion is a `<details>` element, the dropdown is a native popover, and layouts are plain CSS. There's no UI framework running in the browser: Astro renders everything to static HTML at build time. The CSS and behaviours don't depend on Astro either; the `.astro` files in `packages/ui/src/astro/` are thin markup over them, so the same components can be written for other frameworks.

## Small, separate pieces

Each component should do one thing and be easy to combine with others. The media card is a card with a header image, and a message is a bubble with an avatar and a name.

When a component grows, split it. It gets its own folder once it has several parts, and any JavaScript logic goes in a `.ts` file next to it, or, for a component in the library, in `packages/ui/src/behaviours/` (like `carousel/track.ts`). Code that doesn't depend on the site at all, like the color generator, goes in its own package under `packages/`.

## CSS variables are the source of truth

Colors, spacing, font sizes, corner radius and animation timing are all CSS variables, defined in `packages/ui/src/styles/`. Components use those variables instead of their own values, which is what lets a theme or a style restyle the whole site by overriding them.

The default colors are generated from one config file, so they can't drift apart or lose contrast. See [Themes, styles and colors](themes.md).

## JavaScript is optional

Pages should work without JavaScript. Scripts add to things that already work: the code block shows its code without JS, and only gets a copy button with it. A control that can't work without JS stays hidden until the script runs. Heavy code, like the physics behind the gravity gun, is only loaded once someone uses it.

## Accessible by default

Everything should work with a keyboard and a screen reader, respect reduced motion, and hold up in high contrast mode. Color is never the only way something is shown, and every theme keeps text readable against its background (the generated ones are checked automatically).

## Testing

Logic that can be tested on its own, like color math, has unit tests. Components are still tested by looking at them: the gallery's stories cover the states that matter, and they double as documentation. The gallery is also checked in a browser: every story is run with JavaScript off, through axe, at narrow widths, with reduced motion and with the keyboard, and checked for errors. Those tests check that something is true of a story rather than compare it with a saved picture, so there's nothing to update when a component changes on purpose. The generated themes' contrast is checked automatically, and CI runs all of it on every push.
