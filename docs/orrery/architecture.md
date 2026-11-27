# Orrery architecture

The orbit viewer at `/orbits` is split into packages that only import downward. The simulation is a function of data, and the renderer reads what the simulation outputs.

## Packages

```text
orrery  →  render   →  sim  →  orbit
orrery  →  catalog  →  sim
```

| Package               | Owns                                                                                                                                            | Must not import                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `@cpluspatch/orbit`   | Vectors, frames, time, constants, conic math, anomaly solvers, burns                                                                            | `sim`, `catalog`, `render`, `orrery`, `three`, `svelte` |
| `@cpluspatch/sim`     | Scenario schema and validation, commands and the reducer, `compile` and snapshots, perturbations, readouts, the satellite swarm, grip drag math | `catalog`, `render`, `orrery`, `three`, `svelte`        |
| `@cpluspatch/catalog` | Built-in scenarios and their data tables, the satellite snapshot and `loadSatellites`                                                           | `render`, `orrery`, `three`, `svelte`                   |
| `@cpluspatch/render`  | The three.js scene, camera, picking, labels, theme colours, and the text and DOM helpers the UI shares                                          | `orrery`, `catalog`, `svelte`                           |
| `@cpluspatch/orrery`  | The page: panels, audio, shortcuts                                                                                                              | nothing; it's the root                                  |

Test files in `sim` and `render` may import `catalog`, since they use the built-in scenarios as fixtures. Runtime code may not. `.svelte` files and `svelte` imports belong in `orrery` only.

`sim` stores a body's `appearance` without reading it. `render` validates it with `validateAppearance`, and `orrery/src/persistence.ts` passes that validator when it loads untrusted scenarios.

`packages/boundaries.test.ts` enforces this table. It scans `src/` and `scripts/` of each package, including `new URL(…, import.meta.url)` asset paths.

`render` sets `orrery__*` class names on the labels and grips it draws, and their styles are in `orrery/src/styles/scene.css`.

Bodies carry free-form `tags`, and nothing branches on one outside `render/src/tags.ts`. Its `TAG_STYLES` table maps a tag to its look and behaviour, and `styleOf(body)` returns the style of the body's first tag that has an entry.

What a body draws comes from its `appearance`: the sphere's layers in `render/src/layers/index.ts`, and the mesh in `render/src/meshes/index.ts`. Nothing branches on a preset name for it. The fields:

| Field        | Shape                               | Draws                                                  |
| ------------ | ----------------------------------- | ------------------------------------------------------ |
| `color`      | hex string                          | The flat colour                                        |
| `map`        | map key                             | The surface map                                        |
| `glow`       | boolean                             | The star material and corona, with no tone mapping     |
| `atmosphere` | `{ top, day, twilight, rim, haze }` | The atmosphere shell, `top` in km                      |
| `clouds`     | `{ map }`                           | A cloud shell                                          |
| `nightSide`  | `{ map }`                           | City lights on the night side                          |
| `rings`      | `{ map, inner, outer }`             | A ring strip, `inner` and `outer` in m from the centre |
| `mesh`       | `{ type, …params }`                 | A model in place of the sphere                         |
| `satellites` | `"orbitClass"`                      | Colours the spacecraft orbiting it by orbit class      |

An unknown mesh type draws the plain sphere. A `bus` without a `size` is scaled to the body's radius, and every other mesh is drawn at true size.

A body's appearance is its tag's default (`TagStyle.appearance`), then its preset's fields, then its own. Each later one wins per field. A map key that `render` has no map for draws nothing.

A layer returns an `Extra` (shader patches, `load`, `update`, `dispose`), not an `Object3D`. Extras patch the sphere's own shader and load their maps when the sphere is first shown, so a plain object can't hold them.

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

## Schema

A version 3 body has `id`, `name`, `tags`, `mass` (`mu` and `radius`) and an optional `orbit` (`parent` and `elements`). It can also have `appearance`, `preset`, `rotation`, `gravity` and `perturbations`. A scenario can list `clouds`, each a `{ id, host, source }` set of small bodies drawn around the body `host`. Their positions aren't in `Snapshot`. `prepareCloud` returns a `Cloud`, and its `positionsAt(t, shown, out)` writes only the shown particles. The catalogue loads after `compile`. `orrery` passes `render` a loader for it, `loadSatellites` from `catalog`.

`validateScenario` reads versions 1, 2 and 3 and always returns version 3. A legacy field becomes this:

| Legacy field        | Version 3                                             |
| ------------------- | ----------------------------------------------------- |
| `kind`, `role`      | `tags`                                                |
| `mu`, `radius`      | `mass.mu`, `mass.radius`                              |
| `precession`        | A `secular` entry in `perturbations`                  |
| `color`             | `appearance.color`                                    |
| `hasSatellites`     | One cloud, `satellites`, on the Earth body            |
| `model` (version 2) | `preset`                                              |
| Nothing (version 1) | `preset` is the body's `id`, and Earth gets the cloud |

A `preset` is any slug. A slug that matches no preset makes a plain body, so a file from a newer catalog still loads. The only names `sim` knows are `"earth"` and `"moon"`, in the version 1 and 2 migration. `names.test.ts` checks that no other body or preset name appears in its source. [Rotation](#rotation) covers what a preset fills in.

## Rotation

A body's `rotation` is data. `sim/src/rotation/index.ts` is the registry, keyed by `Rotation["type"]`, and each kind supplies its orientation, spin rate and validation. `sim` knows no body names.

| Type      | Units                                                   | Used for                |
| --------- | ------------------------------------------------------- | ----------------------- |
| `uniform` | SI: a fixed ecliptic pole, `w0` in rad, `rate` in rad/s | The Kerbol bodies       |
| `iau`     | Degrees, Julian centuries and days, as in NAIF          | The solar system bodies |

`iau` records keep NAIF's units, so the tables in `catalog/src/presets/` can be checked against `pck00011.tpc`. Everything else in `sim` is SI.

A preset in `catalog/src/presets/` fills a body's missing `rotation` and `gravity`, and merges its `appearance` into the body's by key. `compile(doc, presets)` and `expandPresets` do it, and a field set on the body wins. The document keeps bodies as written, so `render` and the UI read colour from `System.body(id)`, which has the preset filled in.

## Gravity and perturbations

A body's `gravity` is `{ j2, radius }`, the J2 coefficient and the reference radius in metres. The `GRAVITY` table in `catalog/src/presets/gravity.ts` gives it to Earth, Mars, the Moon and Jupiter.

A perturbation turns an orbit's node and periapsis at a steady rate. `sim/src/perturb/` resolves each one to a `Precession` (a pole and two rates):

| Type      | Rates                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| `secular` | Stored on the perturbation, with its pole                                                                          |
| `j2`      | Computed from the parent's `mu`, `gravity` and `rotation`. The pole is the parent's spin axis at the orbit's epoch |

`compile` resolves every body's precessions once. `System.precessions(id)` returns them, and `System.elementsAt(id, t)` applies them. A `j2` perturbation on a parent without gravity or rotation drifts by nothing. `validateScenario` reports it as an error when it's given `presets`, which `apply` and `persistence.ts` pass.

The built-in scenarios still store `secular` rates. The satellite swarm takes its host's `mu`, `radius`, `rotation` and `gravity` from the caller. The radius and rotation set the orbit classes: LEO is measured from the radius, and GEO is where the period equals the host's spin. The swarm reads its elements relative to the host's equator at the catalogue epoch and precesses about the host's pole. For Earth that's the IAU pole, about 0.15° off the J2000 one.
