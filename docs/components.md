# Adding a component

Small, standalone things go in `src/components/ui/`. Bigger components built out of those go in `blocks/`, and page-level stuff like the navbar goes in `sections/`. If a component ends up with several files, give it its own folder, like this one:

```
blocks/message/
├── message.astro               the main component
├── message-bubble.astro        smaller parts it's built from
├── message-group.astro
├── interactive-message.astro   a bigger component built on it
└── dialogue.ts                 that component's script logic
```

The easiest way to get the style right is to copy a similar component and go from there. A few things to keep in mind:

- Use the CSS variables from `src/styles/` instead of hardcoding sizes, fonts or colours. That way it works with every theme.
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
