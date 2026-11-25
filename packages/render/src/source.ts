import type { State } from "@cpluspatch/orbit";
import type { Body, Scenario, Snapshot, System } from "@cpluspatch/sim";
import type { Clock } from "./clock.ts";

/** What a `SceneSource` tells its listeners. The view reads the first three; `World` sends all. */
export type SceneEvent =
    | { type: "focus"; id: string }
    | { type: "selection"; id: string | null }
    | { type: "body"; id: string }
    | { type: "clock" }
    | { type: "bodies"; added: string[]; removed: string[] }
    | { type: "scenario" };

/** The scenario, clock, focus and selection that the view draws. Orrery's `World` fits it. */
export type SceneSource = {
    readonly scenario: Scenario;
    /** The bodies with every parent before its children. */
    readonly order: Body[];
    readonly system: System;
    readonly clock: Clock;
    readonly focused: string;
    readonly selected: string | null;
    snapshot(): Snapshot;
    /** The state of every body at the clock's time. */
    states(): Map<string, State>;
    // Temporary: the view picks and focuses through the source until the Svelte shell (step 17).
    select(id: string | null): void;
    focus(id: string): void;
    /** Calls `fn` on every change. Returns a function that stops it. */
    on(fn: (event: SceneEvent) => void): () => void;
};
