# @cpluspatch/ui

The components from my website, as a library. They're plain CSS, native HTML (`<details>`, `popover`, radio buttons) and a bit of DOM script. They still work with JavaScript turned off. You can see them all in the [gallery](https://cpluspatch.com/gallery/).

It isn't published anywhere yet. For now it's a workspace package of this repo, and I haven't tried it from a packed tarball in another project, so setup elsewhere is untested.

Only Astro has components so far. For anything else you can use the CSS, the class builders and the behaviours with your own markup.

Licensed under the [LGPL-3.0-only](COPYING.LESSER), with the [GPL](COPYING) it builds on.

## What's in it

| Import | What |
|---|---|
| `@cpluspatch/ui/styles.css` | Reset, tokens, themes, typography |
| `@cpluspatch/ui/components.css` | The CSS of every component (or `components/<name>.css` for one) |
| `@cpluspatch/ui` | Class builders, types and helpers. Safe on the server |
| `@cpluspatch/ui/behaviours/<name>.ts` | The scripts, as `initX(root)` functions |
| `@cpluspatch/ui/lib/<name>.ts` | Smaller helpers (`theme-init.ts`, `image.ts`, ...) |
| `@cpluspatch/ui/astro/<path>` | Astro components, in `ui/`, `blocks/` and `sections/` |

It ships source as written (`.ts`, `.astro`, `.css`), so you need a bundler like Astro or Vite.

## CSS

```css
@import "@cpluspatch/ui/styles.css";
@import "@cpluspatch/ui/components.css";
```

Everything is in a cascade layer, in this order:

```
ui.preflight, ui.tokens, ui.themes, ui.base, ui.components, ui.utilities
```

Your own unlayered CSS always wins over the library's, so overriding something is just writing a rule.

`styles.css` includes a global reset. To skip it, import the other files in `styles/` (`tokens.css`, `themes.css`, `typography.css`, ...) yourself.

## Themes

Everything is a CSS variable, and a theme is a stylesheet that overrides them. Set `data-theme="nord"` on `<html>`, and `data-scheme="light"` or `"dark"` to force a mode. `THEMES` in `styles/themes/index.ts` lists them all.

The theme picker is a group of radio buttons, and the CSS reads the checked one with `:has()`, so switching works without JS. With JS the choice is saved to `localStorage`. To apply it before the first paint, inline `themeInitScript` in the `<head>`:

```astro
---
import { themeInitScript } from "@cpluspatch/ui/lib/theme-init.ts";
---
<script is:inline set:html={themeInitScript}></script>
```

In other frameworks, inline the same string however you normally would.

### Fonts

The library doesn't load any fonts. It uses `--font-inter` and `--font-jetbrains-mono` if you define them (the Ocean theme uses `--font-nunito` and `--font-fira-code`), and falls back to system fonts if not. You can also set `--font-base` and `--font-mono` directly.

## Behaviours

A behaviour is a function that attaches to markup that already exists, whoever rendered it:

```ts
import { initDropdown, initDropdowns } from "@cpluspatch/ui/behaviours/dropdown.ts";

const stop = initDropdown(element); // one element, returns a cleanup
const stopAll = initDropdowns(document); // everything inside a scope
```

Binding the same element twice does nothing, and the cleanup removes all listeners and timers, so it's safe to call on every render and on unmount. The top of each file says which selector and `data-*` attributes it expects. Nothing runs on import, so call them once the DOM exists.

`initAll()` from `@cpluspatch/ui/behaviours` binds everything, but it pulls every behaviour into the page, so import the ones you use instead. The terminal isn't part of it: its commands are up to the page, so you bind it yourself with `initTerminals(document, { run })`.

## Writing the markup yourself

Class names are BEM (`.button--outline`, `.dropdown__panel`), and the styling lives entirely in them. The class builders return the right list:

```ts
import { buttonClasses } from "@cpluspatch/ui";

buttonClasses({ variant: "outline", tone: "secondary" });
// ["button", "lift", "button--outline", "tone-secondary", "button--size-default"]
```

For the rest of the markup, read the Astro component. They're short, and the comment at the top lists the props and slots.

Three things the Astro components take from outside:

- **Icons.** The icons a component draws itself (a dropdown's chevron, say) are a built-in set of 22 Lucide icons, in `ICONS` and `iconSvg()`. Icons you choose are an `icon="lucide:name"` prop, and any name outside the built-in set goes to `astro-icon`.
- **Images.** Props take a URL or `{ src, width, height, srcset? }`. The Astro components also take an imported `ImageMetadata` and optimise it with `astro:assets`.
- **Code.** `blocks/code.astro` shows whatever HTML is in its slot, so any highlighter works. With an empty slot it uses Astro's `<Code>` (Shiki).

## Astro

`astro` (7 or newer), `astro-icon` and `shiki` are optional peer dependencies. The components don't import the CSS, so import `components.css` once, globally. Each component loads its own script, so a page only gets the ones it uses.

```astro
---
import Button from "@cpluspatch/ui/astro/ui/button.astro";
---
<Button href="/about" variant="outline">About</Button>
```

## Browser support

Current browsers. The CSS uses nesting, `@layer`, `:has()`, container queries, `popover` and `@property`, and doesn't downlevel any of it. If you need older ones, run it through lightningcss with your own targets, like this site does.

A few things are only an improvement where supported. Dropdown panels sit under their button with anchor positioning, and are centred on screen without it. Textareas grow with their content through `field-sizing`, and without it they stay at `rows` lines.

## Without JavaScript

On server-rendered or static pages, disclosures, the theme picker, dropdowns, corner windows, toggles, segmented controls and form fields all work with scripting off. Controls that need JS stay hidden until it runs. An app that builds its DOM in the browser doesn't get this, since there's no markup before the script.

Animations turn off under `prefers-reduced-motion`, and moving content like the marquee can be paused.

## Contributing

[docs/components.md](../../docs/components.md) explains how a component is put together.
