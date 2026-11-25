# Orrery architecture

The orbit viewer at `/orbits` is split into packages that only import downward. The simulation is a function of data, and the renderer reads what the simulation outputs.

## Packages

```text
orrery  →  catalog  →  sim  →  orbit
```

| Package               | Owns                                                                               | Must not import                         |
| --------------------- | ---------------------------------------------------------------------------------- | --------------------------------------- |
| `@cpluspatch/orbit`   | Vectors, frames, time, constants, conic math, anomaly solvers, burns               | anything else in the repo               |
| `@cpluspatch/sim`     | Scenario schema and validation, commands and the reducer, `compile` and snapshots  | `catalog`, `orrery`, `three`, the DOM   |
| `@cpluspatch/catalog` | Built-in scenarios and their data tables                                           | `orrery`, `three`                       |
| `@cpluspatch/orrery`  | The page: scene, panels, audio, shortcuts                                          | nothing; it's the root                  |

Test files in `sim` may import `catalog`, since they use the built-in scenarios as fixtures. Runtime code may not.

## Temporary exceptions

These break the rules above until a later step of the rewrite removes them.

| Exception                                                                                       | Removed when                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `sim` keeps the closed model list (`models.ts`) and rotation tables keyed by model name         | Rotation and appearance become body data         |
| Kerbol's tidally locked rotations are literals in `sim/src/rotation-models.ts`; a catalog test checks them against the scenario | Rotation becomes body data |
| The satellite catalogue (`catalogue.ts`, `assets/satellites.bin` and its build scripts) lives in `orrery` | Satellite clouds are propagated in `sim`  |
