import type {
    Body,
    Burn,
    Elements,
    ElementsResult,
    Scenario,
    Snapshot,
    State,
    System,
    Vec3,
} from "@cpluspatch/orbit";
import {
    applyBurn,
    compile,
    elementsAt,
    sortByDepth,
    validateScenario,
} from "@cpluspatch/orbit";
import { subtreeIds } from "./adding.ts";
import type { Clock } from "./clock.ts";

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
    readonly clock: Clock;
    focused: string;
    selected: string | null = null;

    #scenario: Scenario;
    #order: Body[];
    #listeners = new Set<(e: WorldEvent) => void>();
    #cache: { t: number; states: Map<string, State> } | null = null;
    #system: System | null = null;

    constructor(scenario: Scenario, clock: Clock) {
        const root = scenario.bodies.find((body) => body.parent === null);
        if (!root) throw new Error("The scenario has no root body.");

        this.clock = clock;
        this.#scenario = scenario;
        this.#order = sortByDepth(scenario);
        this.focused = root.id;
    }

    /** The bodies and their orbits. */
    get scenario(): Scenario {
        return this.#scenario;
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
        this.#system ??= compile(this.scenario);

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

        this.focused = id;
        this.#emit({ type: "focus", id });
    }

    select(id: string | null): void {
        if (id !== null) this.#check(id);

        this.selected = id;
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

        this.#scenario = scenario;
        this.#order = sortByDepth(scenario);
        this.#cache = null;
        this.#system = null;
        this.selected = null;
        this.focused = root.id;
        this.clock.set(t);
        this.#emit({ type: "scenario" });
    }

    /** Adds `body` to the scenario, or throws why it can't. Keeps the focus and selection. */
    addBody(body: Body): void {
        const result = validateScenario({
            ...this.#scenario,
            bodies: [...this.#scenario.bodies, body],
        });
        if (!result.ok) throw new Error(result.errors.join(" "));

        this.#replace(result.scenario);
        this.#emit({ type: "bodies", added: [body.id], removed: [] });
    }

    /** Removes body `id` and every body that orbits it. */
    removeBody(id: string): void {
        this.#check(id);

        const body = this.#scenario.bodies.find(
            (candidate) => candidate.id === id,
        );
        if (!body?.parent) throw new Error(`"${id}" is the root.`);

        const removed = subtreeIds(this.#scenario, id);
        const gone = new Set(removed);

        this.#replace({
            ...this.#scenario,
            bodies: this.#scenario.bodies.filter(
                (candidate) => !gone.has(candidate.id),
            ),
        });

        const refocus = gone.has(this.focused);
        const deselect = this.selected !== null && gone.has(this.selected);
        if (refocus) this.focused = body.parent;
        if (deselect) this.selected = null;

        try {
            this.#emit({ type: "bodies", added: [], removed });
        } finally {
            // A view that fails to draw restores the old scenario and its focus, which this mustn't undo.
            const parent = body.parent;
            try {
                if (refocus && this.focused === parent) {
                    this.#emit({ type: "focus", id: parent });
                }
            } finally {
                if (deselect && this.selected === null) {
                    this.#emit({ type: "selection", id: null });
                }
            }
        }
    }

    /** Replaces the orbit of body `id` with a fixed Kepler orbit, dropping any precession. */
    setElements(id: string, el: Elements): void {
        const body = this.#scenario.bodies.find(
            (candidate) => candidate.id === id,
        );
        if (!body) throw new Error(`There is no body "${id}".`);
        if (body.parent === null)
            throw new Error(`"${id}" has no parent to orbit.`);

        this.#replace({
            ...this.#scenario,
            bodies: this.#scenario.bodies.map((candidate) => {
                if (candidate !== body) return candidate;

                const { precession: _dropped, ...fixed } = body;

                return { ...fixed, elements: el };
            }),
        });
        this.#emit({ type: "body", id });
    }

    /** The orbit body `id` would have after burning `dv` now. Changes nothing. */
    previewBurn(id: string, dv: Burn): ElementsResult {
        const body = this.#scenario.bodies.find(
            (candidate) => candidate.id === id,
        );
        if (!body) throw new Error(`There is no body "${id}".`);
        if (body.parent === null)
            throw new Error(`"${id}" has no orbit to burn on.`);
        const parent = this.#scenario.bodies.find(
            (candidate) => candidate.id === body.parent,
        );
        if (!parent) throw new Error(`There is no body "${body.parent}".`);

        return applyBurn(
            elementsAt(body, this.clock.t),
            parent.mu + body.mu,
            this.clock.t,
            dv,
        );
    }

    /** Burns `dv` on body `id` now, or says why it can't and changes nothing. */
    burn(
        id: string,
        dv: Burn,
    ): { ok: true } | { ok: false; reason: "escape" | "degenerate" } {
        const result = this.previewBurn(id, dv);
        if (!result.ok) return result;

        this.setElements(id, result.elements);

        return { ok: true };
    }

    #replace(scenario: Scenario): void {
        this.#scenario = scenario;
        this.#order = sortByDepth(scenario);
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
