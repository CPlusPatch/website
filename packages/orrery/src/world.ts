import type { Body, Elements, Scenario, State } from "@cpluspatch/orbit";
import { sortByDepth, worldStates } from "@cpluspatch/orbit";
import type { Clock } from "./clock.ts";

/** What a listener of a `World` is told about. */
export type WorldEvent =
    | { type: "focus"; id: string }
    | { type: "selection"; id: string | null }
    | { type: "clock" }
    | { type: "body"; id: string };

/** The scenario, the clock, what's focused and what's selected. */
export class World {
    readonly clock: Clock;
    focused: string;
    selected: string | null = null;

    #scenario: Scenario;
    #order: Body[];
    #listeners = new Set<(e: WorldEvent) => void>();
    #cache: { t: number; states: Map<string, State> } | null = null;

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

    /** The state of every body at the clock's time. */
    states(): Map<string, State> {
        const t = this.clock.t;

        if (this.#cache?.t !== t) {
            this.#cache = {
                t,
                states: worldStates(this.scenario, this.order, t),
            };
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

    /** Replaces the orbit of body `id`. */
    setElements(id: string, el: Elements): void {
        const body = this.#scenario.bodies.find(
            (candidate) => candidate.id === id,
        );
        if (!body) throw new Error(`There is no body "${id}".`);
        if (body.parent === null)
            throw new Error(`"${id}" has no parent to orbit.`);

        this.#scenario = {
            ...this.#scenario,
            bodies: this.#scenario.bodies.map((candidate) =>
                candidate === body ? { ...body, elements: el } : candidate,
            ),
        };
        this.#order = sortByDepth(this.#scenario);
        this.#cache = null;
        this.#emit({ type: "body", id });
    }

    #check(id: string): void {
        if (!this.scenario.bodies.some((body) => body.id === id)) {
            throw new Error(`There is no body "${id}".`);
        }
    }

    #emit(event: WorldEvent): void {
        for (const fn of this.#listeners) fn(event);
    }
}
