# Adding a component

Small, standalone things go in `src/components/ui/`. Bigger components built out of those go in `blocks/`, and page-level stuff like the navbar goes in `sections/`. The sections of one particular page, filled with that page's content, go in `page/`; their content lives in `src/data/`, and anything in them that could be reused elsewhere belongs in one of the other folders instead. If a component ends up with several files, give it its own folder, like this one:

```
blocks/message/
├── message.astro               the main component
├── message-bubble.astro        smaller parts it's built from
├── message-group.astro
├── message-typing.astro
└── interactive-message.astro   a bigger component built on it
```

The easiest way to get the style right is to copy a similar component and go from there. A few things to keep in mind:

- A component's CSS lives in `packages/ui/src/components/<name>.css`, not in the `.astro` file: plain CSS inside `@layer ui.components`, with every selector starting from the component's own BEM class (`.button--outline`, `.dropdown__panel`). Add it to `packages/ui/src/components.css`, after any component it styles the parts of.
- Script belongs to the library, not the `.astro` file: a behaviour in `packages/ui/src/behaviours/<name>.ts`, written with `behaviour(selector, setup)` (see `behaviour.ts`). It binds one root element, is safe to call twice, registers every listener on the `signal` it is given, and returns a cleanup. Its JSDoc names the root selector and the `data-*` hooks the markup must render. The component's `<script>` just imports it and calls `initFoos()`, and `initAll()` in `behaviours/index.ts` covers it. Anything the site must supply (the terminal's commands, the dialogue actions) is an option, never an import.
- Anything about the markup that isn't plain HTML goes in `packages/ui/src/components/<name>.ts` as a pure function the `.astro` file calls: the class list (`buttonClasses({ variant, tone })`), the variant types, and small decisions like `isAnchor(as, href)` or `initials(name)`. These return the same classes any framework wrapper must render, and are unit-tested without a DOM.
- Use the CSS variables from `packages/ui/src/styles/` instead of hardcoding sizes, fonts or colours. That way it works with every theme.
- If it needs an accent colour, add a `tone` prop and the matching `tone-*` class, then use `var(--tone)` in the CSS.
- It should still work with JavaScript disabled. If a control only works with JS, keep it hidden until the script runs.
- Turn off animations under `prefers-reduced-motion: reduce`.

## Gallery stories

To show up in the gallery, a component needs a story file in `src/gallery/stories/`. For example:

```ts
import Badge from "../../components/ui/badge.astro";
import { type StoryGroup, story } from "../story.ts";

export const badges: StoryGroup[] = [
    {
        id: "badge",
        title: "Badges",
        category: "primitives",
        source: "ui/badge.astro",
        stories: [
            story("default", Badge, {}, { slot: "New" }),
            story("outline", Badge, { variant: "outline" }, { slot: "New" }),
        ],
    },
];
```

Add it to the list in `src/gallery/stories/index.ts` too. You don't need a story for every combination of props, just the states that are worth looking at.

Before committing, run `deno run check` and see how it looks in the gallery. The Display menu there lets you switch themes, light/dark mode and the preview width.
