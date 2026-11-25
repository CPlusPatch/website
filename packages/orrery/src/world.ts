import type {
    Burn,
    Elements,
    ElementsResult,
    State,
    Vec3,
} from "@cpluspatch/orbit";
import type { Clock } from "@cpluspatch/render";
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
    subtreeIds,
} from "@cpluspatch/sim";
import { previewBurn } from "./burning.ts";
import type { ViewState } from "./view-state.ts";

/** What a listener of a `World` is told about. */
export type WorldEvent =
    | { type: "focus"; id: string }
    | { type: "selection"; id: string | null }
    | { type: "clock" }
    | { type: "body"; id: string }
    /** Bodies were added or removed (ids). A removal lists the whole subtree. */
    | { type: "bodies"; added: string[]; removed: string[] }
    | { type: "scenario" };

/** The scenario, the clock, what's focused and what's selected. */
export class World {
    readonly view: ViewState;

    #doc: Document;
    #order: Body[];
    #listeners = new Set<(e: WorldEvent) => void>();
    #cache: { t: number; states: Map<string, State> } | null = null;
    #system: System | null = null;

    constructor(scenario: Scenario, clock: Clock) {
        const root = scenario.bodies.find((body) => body.parent === null);
        if (!root) throw new Error("The scenario has no root body.");

        this.view = { focused: root.id, selected: null, clock };
        this.#doc = documentOf(scenario);
        this.#order = sortByDepth(scenario);
    }

    get clock(): Clock {
        return this.view.clock;
    }

    get focused(): string {
        return this.view.focused;
    }

    get selected(): string | null {
        return this.view.selected;
    }

    /** The scenario with its command history. */
    get doc(): Document {
        return this.#doc;
    }

    /** The bodies and their orbits. */
    get scenario(): Scenario {
        return this.#doc.scenario;
    }

    /** The bodies with every parent before its children. */
    get order(): Body[] {
        return this.#order;
    }

    /** Calls `fn` on every change. Returns a function that stops it. */
    on(fn: (e: WorldEvent) => void): () => void {
        this.#listeners.add(fn);

        return () => {
            this.#listeners.delete(fn);
        };
    }

    /** The scenario compiled for evaluation. Compiled on first use and again after a change. */
    get system(): System {
        this.#system ??= compile(this.#doc);

        return this.#system;
    }

    /** Every body at the clock's time. */
    snapshot(): Snapshot {
        return this.system.snapshot(this.clock.t);
    }

    /** The state of every body at the clock's time. */
    states(): Map<string, State> {
        const t = this.clock.t;

        if (this.#cache?.t !== t) {
            const { r, v } = this.snapshot();
            const states = new Map<string, State>();

            const at = (data: Float64Array, i: number): Vec3 => {
                const [x = 0, y = 0, z = 0] = data.subarray(3 * i, 3 * i + 3);

                return { x, y, z };
            };

            for (const [id, i] of this.system.index) {
                states.set(id, { r: at(r, i), v: at(v, i) });
            }

            this.#cache = { t, states };
        }

        return this.#cache.states;
    }

    focus(id: string): void {
        this.#check(id);

        this.view.focused = id;
        this.#emit({ type: "focus", id });
    }

    select(id: string | null): void {
        if (id !== null) this.#check(id);

        this.view.selected = id;
        this.#emit({ type: "selection", id });
    }

    setClock(change: { t?: number; rate?: number; paused?: boolean }): void {
        if (change.t !== undefined) this.clock.set(change.t);
        if (change.rate !== undefined) this.clock.rate = change.rate;
        if (change.paused !== undefined) this.clock.paused = change.paused;

        this.#emit({ type: "clock" });
    }

    /** Replaces the whole scenario and sets the clock to `t`. */
    load(scenario: Scenario, t: number): void {
        const root = scenario.bodies.find((body) => body.parent === null);
        if (!root) throw new Error("The scenario has no root body.");

        this.#dispatch({ type: "load", doc: documentOf(scenario) });
        this.view.selected = null;
        this.view.focused = root.id;
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
        if (!body?.parent) throw new Error(`"${id}" is the root.`);

        const removed = subtreeIds(this.scenario, id);
        const gone = new Set(removed);

        this.#dispatch({ type: "remove-body", id });

        const refocus = gone.has(this.view.focused);
        const deselect =
            this.view.selected !== null && gone.has(this.view.selected);
        if (refocus) this.view.focused = body.parent;
        if (deselect) this.view.selected = null;

        try {
            this.#emit({ type: "bodies", added: [], removed });
        } finally {
            // A view that fails to draw restores the old scenario and its focus, which this mustn't undo.
            const parent = body.parent;
            try {
                if (refocus && this.view.focused === parent) {
                    this.#emit({ type: "focus", id: parent });
                }
            } finally {
                if (deselect && this.view.selected === null) {
                    this.#emit({ type: "selection", id: null });
                }
            }
        }
    }

    /** Replaces the orbit of body `id` with a fixed Kepler orbit, dropping any precession. */
    setElements(id: string, el: Elements): void {
        const result = this.dispatch({
            type: "set-orbit",
            bodyId: id,
            t: this.view.clock.t,
            elements: el,
        });
        if (!result.ok) throw new Error(result.errors.join(" "));
    }

    /** The orbit body `id` would have after burning `dv` now. Changes nothing. */
    previewBurn(id: string, dv: Burn): ElementsResult {
        return previewBurn(this.scenario, this.system, id, this.clock.t, dv);
    }

    /** Burns `dv` on body `id` now, or says why it can't and changes nothing. */
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
            { type: "set-orbit" | "schedule-burn" | "update-body" }
        >,
    ): { ok: true } | { ok: false; errors: string[] } {
        const result = apply(this.#doc, cmd);
        if (!result.ok) return { ok: false, errors: result.errors };

        this.#commit(result.doc);
        this.#emit({
            type: "body",
            id: cmd.type === "update-body" ? cmd.id : cmd.bodyId,
        });

        return { ok: true };
    }

    #dispatch(cmd: Command): void {
        const result = apply(this.#doc, cmd);
        if (!result.ok) throw new Error(result.errors.join(" "));

        this.#commit(result.doc);
    }

    #commit(doc: Document): void {
        this.#doc = doc;
        this.#order = sortByDepth(doc.scenario);
        this.#cache = null;
        this.#system = null;
    }

    #check(id: string): void {
        if (!this.scenario.bodies.some((body) => body.id === id)) {
            throw new Error(`There is no body "${id}".`);
        }
    }

    #emit(event: WorldEvent): void {
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
