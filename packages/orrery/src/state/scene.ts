import { PRESETS } from "@cpluspatch/catalog";
import type { Burn, Elements, ElementsResult, State } from "@cpluspatch/orbit";
import type { Clock, SceneEvent } from "@cpluspatch/render";
import {
    apply,
    type Body,
    type Command,
    compile,
    type Document,
    documentOf,
    type Scenario,
    type Snapshot,
    type System,
    sortByDepth,
    statesAt,
    subtreeIds,
    type TimelineEvent,
} from "@cpluspatch/sim";
import { previewBurn } from "../burning.ts";

/** The state a `Scene` reads and writes. The stores hold it as `$state`. */
export type Held = {
    doc: Document;
    focused: string;
    selected: string | null;
    /** How many scenarios have been loaded. A body edit replaces `doc` too, but doesn't count. */
    loads: number;
};

/**
 * The scenario, the clock, what's focused and what's selected.
 * Plain TypeScript, so Deno can test it. The stores give it reactive fields through `hold`.
 */
export class Scene {
    readonly clock: Clock;

    #held: Held;
    #listeners = new Set<(e: SceneEvent) => void>();
    // Each cache remembers the doc it was built from, so a doc swap invalidates it.
    #order: { doc: Document; bodies: Body[] } | null = null;
    #system: { doc: Document; system: System } | null = null;
    #states: { doc: Document; t: number; states: Map<string, State> } | null =
        null;

    constructor(
        scenario: Scenario,
        clock: Clock,
        hold: (initial: Held) => Held = (initial) => initial,
    ) {
        const root = scenario.bodies.find((body) => body.orbit === undefined);
        if (!root) throw new Error("The scenario has no root body.");

        this.clock = clock;
        this.#held = hold({
            doc: documentOf(scenario),
            focused: root.id,
            selected: null,
            loads: 0,
        });
    }

    get focused(): string {
        return this.#held.focused;
    }

    get selected(): string | null {
        return this.#held.selected;
    }

    /** How many scenarios have been loaded. */
    get loads(): number {
        return this.#held.loads;
    }

    /** The scenario with its command history. */
    get doc(): Document {
        return this.#held.doc;
    }

    /** The bodies and their orbits. */
    get scenario(): Scenario {
        return this.#held.doc.scenario;
    }

    /** The bodies with every parent before its children. */
    get order(): Body[] {
        const doc = this.#held.doc;

        if (this.#order?.doc !== doc) {
            this.#order = { doc, bodies: sortByDepth(doc.scenario) };
        }

        return this.#order.bodies;
    }

    /** Calls `fn` on every change. Returns a function that stops it. */
    on(fn: (e: SceneEvent) => void): () => void {
        this.#listeners.add(fn);

        return () => {
            this.#listeners.delete(fn);
        };
    }

    /** The scenario compiled for evaluation. Compiled on first use and again after a change. */
    get system(): System {
        const doc = this.#held.doc;

        if (this.#system?.doc !== doc) {
            this.#system = { doc, system: compile(doc, PRESETS) };
        }

        return this.#system.system;
    }

    /** Every body at the clock's time. */
    snapshot(): Snapshot {
        return this.system.snapshot(this.clock.t);
    }

    /** The state of every body at the clock's time. */
    states(): Map<string, State> {
        const doc = this.#held.doc;
        const t = this.clock.t;

        if (this.#states?.doc !== doc || this.#states.t !== t) {
            this.#states = { doc, t, states: statesAt(this.system, t) };
        }

        return this.#states.states;
    }

    focus(id: string): void {
        this.#check(id);

        this.#held.focused = id;
        this.#emit({ type: "focus", id });
    }

    select(id: string | null): void {
        if (id !== null) this.#check(id);

        this.#held.selected = id;
        this.#emit({ type: "selection", id });
    }

    setClock(change: { t?: number; rate?: number; paused?: boolean }): void {
        if (change.t !== undefined) this.clock.set(change.t);
        if (change.rate !== undefined) this.clock.rate = change.rate;
        if (change.paused !== undefined) this.clock.paused = change.paused;

        this.#emit({ type: "clock" });
    }

    /** Replaces the whole scenario and its `timeline` and sets the clock to `t`. */
    load(scenario: Scenario, t: number, timeline: TimelineEvent[] = []): void {
        const root = scenario.bodies.find((body) => body.orbit === undefined);
        if (!root) throw new Error("The scenario has no root body.");

        this.#dispatch({ type: "load", doc: { scenario, timeline } });
        this.#held.loads += 1;
        this.#held.selected = null;
        this.#held.focused = root.id;
        this.clock.set(t);
        this.#emit({ type: "scenario" });
    }

    /** Adds `body` to the scenario, or throws why it can't. Keeps the focus and selection. */
    addBody(body: Body): void {
        this.#dispatch({ type: "add-body", body });
        this.#emit({ type: "bodies", added: [body.id], removed: [] });
    }

    /** Removes body `id` and every body that orbits it. */
    removeBody(id: string): void {
        this.#check(id);

        const body = this.scenario.bodies.find(
            (candidate) => candidate.id === id,
        );
        if (!body?.orbit) throw new Error(`"${id}" is the root.`);

        const removed = subtreeIds(this.scenario, id);
        const gone = new Set(removed);

        this.#dispatch({ type: "remove-body", id });

        const refocus = gone.has(this.#held.focused);
        const deselect =
            this.#held.selected !== null && gone.has(this.#held.selected);
        if (refocus) this.#held.focused = body.orbit.parent;
        if (deselect) this.#held.selected = null;

        try {
            this.#emit({ type: "bodies", added: [], removed });
        } finally {
            // A view that fails to draw restores the old scenario and its focus, which this mustn't undo.
            const parent = body.orbit.parent;
            try {
                if (refocus && this.#held.focused === parent) {
                    this.#emit({ type: "focus", id: parent });
                }
            } finally {
                if (deselect && this.#held.selected === null) {
                    this.#emit({ type: "selection", id: null });
                }
            }
        }
    }

    /** Puts body `id` on a Kepler orbit of `el` from now on. Its perturbations keep acting. */
    setElements(id: string, el: Elements): void {
        const result = this.dispatch({
            type: "set-orbit",
            bodyId: id,
            t: this.clock.t,
            elements: el,
        });
        if (!result.ok) throw new Error(result.errors.join(" "));
    }

    /** The orbit body `id` would have after burning `dv` now. Changes nothing. */
    previewBurn(id: string, dv: Burn): ElementsResult {
        return previewBurn(this.scenario, this.system, id, this.clock.t, dv);
    }

    /** Burns `dv` on body `id` now as a timeline event, or says why it can't and changes nothing. */
    burn(
        id: string,
        dv: Burn,
    ): { ok: true } | { ok: false; reason: "escape" | "degenerate" } {
        const result = this.previewBurn(id, dv);
        if (!result.ok) return result;

        const done = this.dispatch({
            type: "schedule-burn",
            bodyId: id,
            t: this.clock.t,
            dv,
        });
        if (!done.ok) throw new Error(done.errors.join(" "));

        return { ok: true };
    }

    /** Runs a command on one body and tells listeners. A rejected command changes nothing. */
    dispatch(
        cmd: Extract<
            Command,
            {
                type:
                    | "set-orbit"
                    | "schedule-burn"
                    | "update-body"
                    | "add-body"
                    | "remove-body";
            }
        >,
    ): { ok: true } | { ok: false; errors: string[] } {
        const result = apply(this.#held.doc, cmd, PRESETS);
        if (!result.ok) return { ok: false, errors: result.errors };

        // Not committed here: `removeBody` also moves the focus and selection.
        if (cmd.type === "remove-body") {
            this.removeBody(cmd.id);

            return { ok: true };
        }

        this.#commit(result.doc);
        if (cmd.type === "add-body") {
            this.#emit({ type: "bodies", added: [cmd.body.id], removed: [] });

            return { ok: true };
        }

        this.#emit({
            type: "body",
            id: cmd.type === "update-body" ? cmd.id : cmd.bodyId,
        });

        return { ok: true };
    }

    #dispatch(cmd: Command): void {
        const result = apply(this.#held.doc, cmd, PRESETS);
        if (!result.ok) throw new Error(result.errors.join(" "));

        this.#commit(result.doc);
    }

    #commit(doc: Document): void {
        this.#held.doc = doc;
    }

    #check(id: string): void {
        if (!this.scenario.bodies.some((body) => body.id === id)) {
            throw new Error(`There is no body "${id}".`);
        }
    }

    #emit(event: SceneEvent): void {
        const errors: unknown[] = [];

        // One failing listener mustn't leave the others out of date.
        for (const fn of this.#listeners) {
            try {
                fn(event);
            } catch (error) {
                errors.push(error);
            }
        }

        if (errors.length === 1) throw errors[0];
        if (errors.length > 1)
            throw new AggregateError(errors, "Listeners threw.");
    }
}
