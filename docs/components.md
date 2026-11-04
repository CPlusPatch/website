# Adding a component

Components that could serve any site live in the library, `packages/ui/src/astro/`, and are imported as `@cpluspatch/ui/astro/<path>`. Small, standalone things go in `ui/`. Bigger components built out of those go in `blocks/`, and page-level stuff like the navbar goes in `sections/`. Anything tied to this site (its content, its data, its media) stays in `src/components/`: the sections of one particular page, filled with that page's content, go in `page/`, and their content lives in `src/data/`. If a component ends up with several files, give it its own folder, like this one:

```
astro/blocks/message/
├── message.astro               the main component
├── message-bubble.astro        smaller parts it's built from
├── message-group.astro
├── message-typing.astro
└── interactive-message.astro   a bigger component built on it
```

A library component must not import from the site's `src/`. It talks to the site through props and slots, as below.

## What the Astro components assume

The `astro/` folder is the only part of the library that imports `astro` or `astro-icon` (both optional peer dependencies); the rest is plain TypeScript and CSS. Three things that used to be Astro-only are now contracts you can fill from any framework:

- **Icons.** `astro/icon.astro` draws a built-in set of Lucide icons from `src/icons.ts` as inline `<svg>`. Any other name (`logos:github-icon`) falls through to `astro-icon`. A component that needs an icon takes it as a prop or a slot, and uses `<Icon>`; never import `astro-icon` directly. Adding a built-in icon means adding its markup to `ICONS`; a test fails if a component uses a `lucide:` name that isn't there.
- **Images.** Props accept `ImageMetadata` (an imported file, optimised by `astro:assets`) or a plain `ImageSource` (a URL, or `{ src, width, height, srcset? }`, used as given; the component's own `alt` prop still names it). `astro/image.astro` picks between them, and `imageAttributes`, `imageUrl` and `imageRatio` in `lib/image.ts` do the same for other frameworks.
- **Highlighted code.** `blocks/code.astro` renders whatever HTML it is given in its default slot, so any highlighter will do. With an empty slot it falls back to Astro's `<Code>` (Shiki), themed by the `--code-*` variables from `lib/code-theme.ts`. Without JS it still shows the code; the copy button appears with it.

The stylesheet is not imported by the components: the site imports `@cpluspatch/ui/components.css` once, globally (see `src/styles/index.css`).

## Slots

A component's slots are part of its contract. Check one that may be empty with `Astro.slots.render("name")` and `.trim()`, not `Astro.slots.has`, which is true even when the slot holds nothing. List each named slot in the component's doc comment. The footer, for example, takes `copyright`, `tagline` and `socials` as props and two slots, `branding` and `friends`; the site fills them with its own badges and links (`src/components/page/footer.astro`) so the library carries none of its content.

The easiest way to get the style right is to copy a similar component and go from there. A few things to keep in mind:

- A component's CSS lives in `packages/ui/src/components/<name>.css`, not in the `.astro` file: plain CSS inside `@layer ui.components`, with every selector starting from the component's own BEM class (`.button--outline`, `.dropdown__panel`). Add it to `packages/ui/src/components.css`, after any component it styles the parts of.
- Script belongs to the library, not the `.astro` file: a behaviour in `packages/ui/src/behaviours/<name>.ts`, written with `behaviour(selector, setup)` (see `behaviour.ts`). It binds one root element, is safe to call twice, registers every listener on the `signal` it is given, and returns a cleanup. Its JSDoc names the root selector and the `data-*` hooks the markup must render. The component's `<script>` just imports it and calls `initFoos()`, and `initAll()` in `behaviours/index.ts` covers it. Anything the site must supply (the terminal's commands, the dialogue actions) is an option, never an import: the library's Terminal ships no script, and the site's wrapper (`src/components/blocks/terminal/terminal.astro`) binds it with its own `run`.
- Anything about the markup that isn't plain HTML goes in `packages/ui/src/components/<name>.ts` as a pure function the `.astro` file calls: the class list (`buttonClasses({ variant, tone })`), the variant types, and small decisions like `isAnchor(as, href)` or `initials(name)`. These return the same classes any framework wrapper must render, and are unit-tested without a DOM.
- Use the CSS variables from `packages/ui/src/styles/` instead of hardcoding sizes, fonts or colours. That way it works with every theme.
- If it needs an accent colour, add a `tone` prop and the matching `tone-*` class, then use `var(--tone)` in the CSS.
- It should still work with JavaScript disabled. If a control only works with JS, keep it hidden until the script runs.
- Turn off animations under `prefers-reduced-motion: reduce`.

## Gallery stories

To show up in the gallery, a component needs a story file in `src/gallery/stories/`. For example:

```ts
import Badge from "@cpluspatch/ui/astro/ui/badge.astro";
import { type StoryGroup, story } from "../story.ts";

export const badges: StoryGroup[] = [
    {
        id: "badge",
        title: "Badges",
        category: "primitives",
        source: "packages/ui/src/astro/ui/badge.astro",
        stories: [
            story("default", Badge, {}, { slot: "New" }),
            story("outline", Badge, { variant: "outline" }, { slot: "New" }),
        ],
    },
];
```

Add it to the list in `src/gallery/stories/index.ts` too. You don't need a story for every combination of props, just the states that are worth looking at.

Before committing, run `deno run check` and see how it looks in the gallery. The Display menu there lets you switch themes, light/dark mode and the preview width.
