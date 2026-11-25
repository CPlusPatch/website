# Orrery architecture

The orbit viewer at `/orbits` is split into packages that only import downward. The simulation is a function of data, and the renderer reads what the simulation outputs.

## Packages

```text
orrery  →  render   →  sim  →  orbit
orrery  →  catalog  →  sim
```

| Package               | Owns                                                                                                                             | Must not import                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `@cpluspatch/orbit`   | Vectors, frames, time, constants, conic math, anomaly solvers, burns                                                             | `sim`, `catalog`, `render`, `orrery`, `three`, `svelte` |
| `@cpluspatch/sim`     | Scenario schema and validation, commands and the reducer, `compile` and snapshots, readouts, the satellite swarm, grip drag math | `catalog`, `render`, `orrery`, `three`, `svelte`        |
| `@cpluspatch/catalog` | Built-in scenarios and their data tables                                                                                         | `render`, `orrery`, `three`, `svelte`                   |
| `@cpluspatch/render`  | The three.js scene, camera, picking, labels, theme colours, and the text and DOM helpers the UI shares                           | `orrery`, `catalog`, `svelte`                           |
| `@cpluspatch/orrery`  | The page: panels, audio, shortcuts                                                                                               | nothing; it's the root                                  |

Test files in `sim` and `render` may import `catalog`, since they use the built-in scenarios as fixtures. Runtime code may not. `.svelte` files and `svelte` imports belong in `orrery` only.

`sim` stores a body's `appearance` without reading it. `render` validates it with `validateAppearance`, and `orrery/src/persistence.ts` passes that validator when it loads untrusted scenarios.

`packages/boundaries.test.ts` enforces this table. It scans `src/` and `scripts/` of each package, including `new URL(…, import.meta.url)` asset paths.

`render` sets `orrery__*` class names on the labels and grips it draws, and their styles are in `orrery/src/styles/scene.css`.

Bodies carry free-form `tags`, and nothing branches on one outside `render/src/tags.ts`. Its `TAG_STYLES` table maps a tag to its look and behaviour, and `styleOf(body)` returns the style of the body's first tag that has an entry.

## State

The Orrery's state lives in `$state` fields in `src/state/`. Components read and write it through two stores:

| Store           | Reads                                                    | Writes                              |
| --------------- | -------------------------------------------------------- | ----------------------------------- |
| `DocumentStore` | The scenario document, the system and the load count     | `dispatch` and `load`               |
| `ViewState`     | The focused and selected body ids, and the clock's flags | `setFocus`, `select` and `setClock` |

`Scene` (`state/scene.ts`) is the logic. It validates ids, applies commands, moves the focus and selection when a body is removed, and emits events. The `render` view, the session and the screen reader announcements listen to those events.

The `Scene` has no state of its own. It reads and writes a `Held` object (document, focus, selection, load count). `createStores()` gives it a `ReactiveHeld` (`state/held.svelte.ts`), whose fields are `$state`. A read in an effect or `$derived` tracks the field, and a write to a field updates every reader. The document uses `$state.raw`, since it's replaced as a whole and never edited.

Deno can't run `.svelte.ts` files. The logic and its tests stay in plain `.ts`, and only the thin holder and stores are rune modules.

The clock isn't held. It ticks in one `requestAnimationFrame` loop in `Shell.svelte`, and the `render` loop only reads it. So `ViewState.clock` copies its flags from the scene's `clock` and `scenario` events, and `now()` reads its time. Components update in Svelte's next microtask, so code that reads their DOM right after a scene call sees the old DOM.

`ui/Shell.svelte` makes the stores and passes them down with `setStores()`. Components read them with `getDocument()` and `getView()`.

## Shell

`orbits.astro` renders the loading state and `<Orrery client:only="svelte" />` inside `.orrery`. The components:

| Component         | Does                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `Orrery.svelte`   | Opens the scenario from the share link or the saved copy, then renders `Shell`. Owns the live region. |
| `Shell.svelte`    | Makes the stores, session, shortcuts and sound, and renders the four panels                           |
| `Viewport.svelte` | Holds the canvas and the `render` view, or the WebGL alert                                            |

`Viewport.build()` is a method, not reactive, because the session's `rebuild` must throw when a scenario can't be drawn. The components that read the view (the inspector, the satellite card, the HUD) sit in `{#key view}`, so a rebuild makes them again.

When Orrery's startup throws, it replaces the loading text with an error. When its chunk won't download, Astro fires `astro:hydration-error` on the island, and the page script shows the same text.

## Rotation

A body's `rotation` is data. `sim/src/rotation/index.ts` is the registry, keyed by `Rotation["type"]`, and each kind supplies its orientation, spin rate and validation. `sim` knows no body names.

| Type      | Units                                                  | Used for                |
| --------- | ------------------------------------------------------ | ----------------------- |
| `uniform` | SI: a fixed ecliptic pole, `w0` in rad, `rate` in rad/s | The Kerbol bodies       |
| `iau`     | Degrees, Julian centuries and days, as in NAIF         | The solar system bodies |

`iau` records keep NAIF's units, so the tables in `catalog/src/presets/` can be checked against `pck00011.tpc`. Everything else in `sim` is SI.

A preset in `catalog/src/presets/` fills a body's missing `rotation`. `compile(doc, presets)` and `expandPresets` do it, and a field set on the body wins. The document keeps bodies as written.

## Temporary exceptions

These break the rules above until a later step of the rewrite removes them.

| Exception                                                                                       | Removed when                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `sim` keeps the closed model list (`models.ts`)                                                 | Appearance becomes body data                     |
| `TagStyle.corona` makes `render` draw a star's emissive material and corona sprite from a tag | Star appearance becomes body data |
| `TagStyle.craftMesh` makes `render` pick the spacecraft mesh from a tag | Spacecraft models become body data |
| The satellite snapshot build script and `assets/satellites.bin` live in `orrery`; the catalogue decoder and swarm are in `sim` | Satellite clouds are propagated in `sim` |
