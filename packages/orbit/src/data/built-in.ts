import type { Scenario } from "../scenario.ts";
import { eridani, gargantua, kerbol, tauCeti } from "./fiction.ts";
import { solarSystem } from "./solar-system.ts";

/** The scenarios that ship with the app, the solar system first. */
export const builtInScenarios: readonly Scenario[] = [
    solarSystem,
    gargantua,
    tauCeti,
    eridani,
    kerbol,
];
