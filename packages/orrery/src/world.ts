import type {
    Body,
    Burn,
    Elements,
    ElementsResult,
    Scenario,
    State,
} from "@cpluspatch/orbit";
import {
    applyBurn,
    sortByDepth,
    validateScenario,
    worldStates,
} from "@cpluspatch/orbit";
import { subtreeIds } from "./adding.ts";
import type { Clock } from "./clock.ts";

/** What a listener of a `World` is told about. */
export type WorldEvent =
    | { type: "focus"; id: string }
    | { type: "selection"; id: string | null }
    | { type: "clock" }
    | { type: "body"; id: string }
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

    /** Replaces the whole scenario and sets the clock to `t`. */
    load(scenario: Scenario, t: number): void {
        const root = scenario.bodies.find((body) => body.parent === null);
        if (!root) throw new Error("The scenario has no root body.");

        this.#scenario = scenario;
        this.#order = sortByDepth(scenario);
        this.#cache = null;
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
        this.#emit({ type: "scenario" });
    }

    /** Removes body `id` and every body that orbits it. */
    removeBody(id: string): void {
        this.#check(id);

        const body = this.#scenario.bodies.find(
            (candidate) => candidate.id === id,
        );
        if (!body?.parent) throw new Error(`"${id}" is the root.`);

        const gone = new Set(subtreeIds(this.#scenario, id));

        this.#replace({
            ...this.#scenario,
            bodies: this.#scenario.bodies.filter(
                (candidate) => !gone.has(candidate.id),
            ),
        });
        if (gone.has(this.focused)) this.focused = body.parent;
        if (this.selected !== null && gone.has(this.selected)) {
            this.selected = null;
        }
        this.#emit({ type: "scenario" });
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

    /** The orbit body `id` would have after burning `dv` now. Changes nothing. */
    previewBurn(id: string, dv: Burn): ElementsResult {
        const body = this.#scenario.bodies.find(
            (candidate) => candidate.id === id,
        );
        const parent = this.#scenario.bodies.find(
            (candidate) => candidate.id === body?.parent,
        );
        if (!body) throw new Error(`There is no body "${id}".`);
        if (!body.elements || !parent)
            throw new Error(`"${id}" has no orbit to burn on.`);

        return applyBurn(body.elements, parent.mu + body.mu, this.clock.t, dv);
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
