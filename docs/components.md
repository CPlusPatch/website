# Adding a component

## Where it goes

| Folder                         | What goes there                                                  |
| ------------------------------ | ---------------------------------------------------------------- |
| `packages/ui/src/astro/ui/`       | Small standalone components                                      |
| `packages/ui/src/astro/blocks/`   | Bigger components built from those                               |
| `packages/ui/src/astro/sections/` | Page-level parts, like the navbar                                |
| `src/components/`              | Anything tied to this site: its content, data or media           |
| `src/components/page/`         | Sections of one page. Their content lives in `src/data/`         |

Library components are imported as `@cpluspatch/ui/astro/<path>`, and must not import from the site's `src/`. They get what the site supplies through props and slots.

A component with several files gets its own folder:

```text
astro/blocks/message/
├── message.astro               the main component
├── message-bubble.astro        parts it's built from
├── message-group.astro
├── message-typing.astro
└── interactive-message.astro   a bigger component built on it
```

## Files

Copy a similar component and start from there. Each part has its own file:

| File                                         | Contents                                                              |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `packages/ui/src/components/<name>.css`      | Plain CSS in `@layer ui.components`, every selector under the component's BEM class |
| `packages/ui/src/components/<name>.ts`       | Pure functions the markup calls: class lists (`buttonClasses`), variant types, small decisions like `isAnchor` |
| `packages/ui/src/behaviours/<name>.ts`       | The script, written with `behaviour(selector, setup)`                 |
| `packages/ui/src/astro/.../<name>.astro`     | Thin markup over the above                                            |

Add the CSS to `packages/ui/src/components.css`, after any component it styles the parts of. The site imports that stylesheet once (`src/styles/index.css`), so components don't import it.

A behaviour binds one root element, is safe to call twice, registers its listeners on the `signal` it's given and returns a cleanup. Its JSDoc names the root selector and the `data-*` hooks the markup renders. Add it to `initAll()` in `behaviours/index.ts`. Anything the site supplies, like the terminal's commands, is an option and never an import.

Rules every component follows:

- Use the variables from `packages/ui/src/styles/` for sizes, fonts and colors, so it works in every theme.
- For an accent color, take a `tone` prop, add the `tone-*` class and use `var(--tone)`.
- It works without JavaScript. A control that needs JS stays hidden until the script runs.
- Animations stop under `prefers-reduced-motion: reduce`.

## Icons, images and code

Only `astro/` imports `astro` or `astro-icon`. These three have plain contracts so other frameworks can fill them:

| Need            | How                                                                                    |
| --------------- | -------------------------------------------------------------------------------------- |
| Icon            | `<Icon>` from `astro/icon.astro`. `lucide:` names come from `ICONS` in `packages/ui/src/icons.ts`, other names fall through to `astro-icon`. A test fails on a `lucide:` name that isn't in `ICONS`. |
| Image           | Props take `ImageMetadata` or an `ImageSource` (a URL or `{ src, width, height, srcset? }`). `astro/image.astro` picks between them; `lib/image.ts` has the same logic for other frameworks. |
| Highlighted code | `blocks/code.astro` renders the HTML in its slot. With an empty slot it uses Astro's `<Code>` (Shiki), themed from `lib/code-theme.ts`. |

## Slots

List each named slot in the component's doc comment. Check whether one is empty with `Astro.slots.render("name")` and `.trim()`: `Astro.slots.has` is true even for an empty slot.

## Gallery stories

Every component needs a story file in `src/gallery/stories/`, listed in `src/gallery/stories/index.ts`:

```ts
import Badge from "@cpluspatch/ui/astro/ui/badge.astro";
import { type StoryGroup, story } from "../story.ts";

export const badges: StoryGroup[] = [
    {
        id: "badge",
        title: "Badges",
        category: "primitives",
        stories: [
            story("default", Badge, {}, { slot: "New" }),
            story("outline", Badge, { variant: "outline" }, { slot: "New" }),
        ],
    },
];
```

Add a story for each state worth looking at, not each combination of props. The build fails on a story name that isn't lowercase words joined by hyphens, or isn't unique in its group.

- Put the group's own component in its first story: the gallery reads the group's source file from it.
- To let the bench change a story's props live, add `controls` and a Svelte `port` (a name in `PORTS`, `src/gallery/ports.ts`). Each key of `controls` has a kind:
    - a list of strings to choose from: `variant: VARIANTS`
    - a list with a widget that draws it, `{ values: TONES, widget: "swatches" }`. `swatches` draws a colour swatch per tone, so every value must be a tone. `preview` draws a tile per value, with the story's component in that value. `sizes` draws a tile per value with a box that shrinks down the list, so list the biggest first.
    - `"boolean"`, for a boolean prop that the story sets
    - `"text"`, for a string prop that the story sets
    - `slot: "text"` and `icon: "icon"` for the story's label and icon. Icons are the ones in `packages/ui/src/icons.ts`.

  The story's own props, `slot` and `icon` are the defaults. The bench renders the story at `/gallery/play/<group-id>/<story>/` and puts the values in its query, like `?variant=ghost&tone=destructive`. The story's page under `/gallery/story/` shows the defaults only.
- Tag a story that keeps moving on its own (autoplay, a count-up) as `animated`, and one that fetches data as `live`. The tests let only `animated` stories keep moving, and never compare `live` ones as pictures.
- Each group gets a page at `/gallery/<group-id>/`. To put several groups on one page, list them together in `src/gallery/components.ts`.

Each story also has a bare page at `/gallery/story/<group-id>/<story>/`, and each group at `/gallery/story/<group-id>/`. Tests load these. They take `?theme=`, `?style=`, `?scheme=light|dark` and `?width=` (`tablet`, `phone`, `tiny` or rem) without changing the saved Display settings. `/gallery/manifest.json` lists every story.

To check a change, see [Development workflow](workflow.md).
