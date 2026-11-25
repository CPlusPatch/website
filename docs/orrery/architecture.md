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

`packages/boundaries.test.ts` enforces this table. It scans `src/` and `scripts/` of each package, including `new URL(…, import.meta.url)` asset paths.

`render` sets `orrery__*` class names on the labels and grips it draws, and their styles are in `orrery/src/styles/scene.css`.

## State

The Orrery's state lives in `$state` fields in `src/state/`. Components read and write it through two stores:

| Store           | Reads                                                    | Writes                              |
| --------------- | -------------------------------------------------------- | ----------------------------------- |
| `DocumentStore` | The scenario document, the system and the load count     | `dispatch` and `load`               |
| `ViewState`     | The focused and selected body ids, and the clock's flags | `setFocus`, `select` and `setClock` |

`Scene` (`state/scene.ts`) is the logic. It validates ids, applies commands, moves the focus and selection when a body is removed, and emits events. The `render` view, the session and the screen reader announcements listen to those events.

The `Scene` has no state of its own. It reads and writes a `Held` object (document, focus, selection, load count). `createStores()` gives it a `ReactiveHeld` (`state/held.svelte.ts`), whose fields are `$state`. A read in an effect or `$derived` tracks the field, and a write to a field updates every reader. The document uses `$state.raw`, since it's replaced as a whole and never edited.

Deno can't run `.svelte.ts` files. The logic and its tests stay in plain `.ts`, and only the thin holder and stores are rune modules.

The clock isn't held. `render` ticks it every frame, so `ViewState.clock` copies its flags from the scene's `clock` and `scenario` events, and `now()` reads its time. Components update in Svelte's next microtask, so code that reads their DOM right after a scene call sees the old DOM.

`mount()` gets the stores through `storeContext()`, and components read them with `getDocument()` and `getView()`. Today only the focus crumbs (`ui/Crumbs.svelte`) are a component. They're mounted into the vanilla shell in `index.ts`.

## Temporary exceptions

These break the rules above until a later step of the rewrite removes them.

| Exception                                                                                       | Removed when                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `sim` keeps the closed model list (`models.ts`) and rotation tables keyed by model name         | Rotation and appearance become body data         |
| Kerbol's tidally locked rotations are literals in `sim/src/rotation-models.ts`; a catalog test checks them against the scenario | Rotation becomes body data |
| The satellite snapshot build script and `assets/satellites.bin` live in `orrery`; the catalogue decoder and swarm are in `sim` | Satellite clouds are propagated in `sim` |
| `render`'s `SceneSource` calls `select` and `focus` on the `Scene`                              | The clock and `createRenderer` step (17c)        |
