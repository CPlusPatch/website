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

## Temporary exceptions

These break the rules above until a later step of the rewrite removes them.

| Exception                                                                                       | Removed when                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `sim` keeps the closed model list (`models.ts`) and rotation tables keyed by model name         | Rotation and appearance become body data         |
| Kerbol's tidally locked rotations are literals in `sim/src/rotation-models.ts`; a catalog test checks them against the scenario | Rotation becomes body data |
| The satellite snapshot build script and `assets/satellites.bin` live in `orrery`; the catalogue decoder and swarm are in `sim` | Satellite clouds are propagated in `sim` |
| `render`'s `SceneSource` calls `select` and `focus` on the world                                | The Svelte shell replaces the `World` bridge     |
