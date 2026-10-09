# Design philosophy

A few ideas that most decisions in this codebase come back to.

## Keep it simple

Less code means less to break and less to read. Before adding a dependency, an abstraction or an option, check whether a few lines would do the job, and remove things once nothing uses them.

Where the browser already does something, use that. The accordion is a `<details>` element, the dropdown is a native popover, and layouts are plain CSS. There's no UI framework running in the browser: Astro renders everything to static HTML at build time.

## Small, separate pieces

Each component should do one thing and be easy to combine with others. The media card is a card with a header image, and a message is a bubble with an avatar and a name.

When a component grows, split it. It gets its own folder once it has several parts, and any JavaScript logic goes in a `.ts` file next to it (like `carousel/track.ts`). Code that doesn't depend on the site at all, like the colour generator, goes in its own package under `packages/`.

## CSS variables are the source of truth

Colours, spacing, font sizes, corner radius and animation timing are all CSS variables, defined in `src/styles/`. Components use those variables instead of their own values, which is what lets a theme restyle the whole site by overriding them.

The default colours are generated from one config file, so they can't drift apart or lose contrast. See [Themes and colours](themes.md).

## JavaScript is optional

Pages should work without JavaScript. Scripts add to things that already work: the code block shows its code without JS, and only gets a copy button with it. A control that can't work without JS stays hidden until the script runs. Heavy code, like the physics behind the gravity gun, is only loaded once someone uses it.

## Accessible by default

Everything should work with a keyboard and a screen reader, respect reduced motion, and hold up in high contrast mode. Colour is never the only way something is shown, and every theme keeps text readable against its background (the generated ones are checked automatically).

## Testing

Logic that can be tested on its own, like colour maths, has unit tests. Components are tested by looking at them: the gallery's stories cover the states that matter, and they double as documentation. The generated themes' contrast is checked automatically, and CI runs all of it on every push.
