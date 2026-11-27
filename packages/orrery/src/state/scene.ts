import { PRESETS } from "@cpluspatch/catalog";
import type { Burn, Elements, ElementsResult, State } from "@cpluspatch/orbit";
import type { Clock, SceneEvent } from "@cpluspatch/render";
import {
    apply,
    type Body,
    type Command,
    compile,
    type Document,
    type Scenario,
    type Snapshot,
    type System,
    sortByDepth,
    statesAt,
    subtreeIds,
} from "@cpluspatch/sim";
import { previewBurn } from "../burning.ts";

/** A document to restore, and what the edit that left it was. */
export type HistoryEntry = { doc: Document; label: string };

const HISTORY_LIMIT = 100;

/** The bodies of `doc` by id. */
const bodiesOf = (doc: Document): Map<string, Body> =>
    new Map(doc.scenario.bodies.map((body) => [body.id, body]));

// `apply` validates, which rebuilds every body and event, so a reference check alone would flag them all.
const same = (a: unknown, b: unknown): boolean =>
    a === b || JSON.stringify(a) === JSON.stringify(b);

/** Whether `a` and `b` have the same events for body `id`. */
const sameEvents = (a: Document, b: Document, id: string): boolean => {
    const mine = a.timeline.filter((event) => event.bodyId === id);
    const theirs = b.timeline.filter((event) => event.bodyId === id);

    return (
        mine.length === theirs.length &&
        mine.every((event, i) => same(event, theirs[i]))
    );
};

/** What an edit is called in the history and the live region, from the edited body's name. */
const HISTORY_LABELS = {
    "add-body": (name: string) => `adding ${name}`,
    "remove-body": (name: string) => `removing ${name}`,
    "update-body": (name: string) => `the edit to ${name}`,
    "set-orbit": (name: string) => `the orbit edit on ${name}`,
    "schedule-burn": (name: string) => `the burn on ${name}`,
    "remove-burn": (name: string) => `removing the burn on ${name}`,
    "remove-set-orbit": (name: string) => `removing the orbit edit on ${name}`,
};

/** The state a `Scene` reads and writes. The stores hold it as `$state`. */
export type Held = {
    doc: Document;
    /** Documents before each edit, oldest first. Replaced, never changed. */
    past: readonly HistoryEntry[];
    /** Documents that undo left, the next redo last. Replaced, never changed. */
    future: readonly HistoryEntry[];
    focused: string;
    selected: string | null;
    /** How many scenarios have been loaded. A body edit replaces `doc` too, but doesn't count. */
    loads: number;
    /** The ids of the bodies absent at the clock's time. Replaced, never changed. */
    absent: readonly string[];
};

/** What left when the clock passed the end of a lifetime. */
export type Departure = {
    /** The ids that left: the focused body first, then the selected one if different. */
    gone: string[];
    /** The id that took the focus, or `null` if the focus stayed. */
    focused: string | null;
    deselected: boolean;
};

const NONE: readonly string[] = [];

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
    #present: {
        doc: Document;
        absent: readonly string[];
        bodies: Body[];
    } | null = null;
    #system: { doc: Document; system: System } | null = null;
    #states: { doc: Document; t: number; states: Map<string, State> } | null =
        null;

    constructor(
        doc: Document,
        clock: Clock,
        hold: (initial: Held) => Held = (initial) => initial,
    ) {
        const root = doc.scenario.bodies.find(
            (body) => body.orbit === undefined,
        );
        if (!root) throw new Error("The scenario has no root body.");

        this.clock = clock;
        this.#held = hold({
            doc,
            past: [],
            future: [],
            focused: root.id,
            selected: null,
            loads: 0,
            absent: NONE,
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

    get canUndo(): boolean {
        return this.#held.past.length > 0;
    }

    get canRedo(): boolean {
        return this.#held.future.length > 0;
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

    /** The bodies present at the clock's time, as of the last `settlePresence`. */
    get presentBodies(): Body[] {
        const doc = this.#held.doc;
        const absent = this.#held.absent;

        if (this.#present?.doc !== doc || this.#present.absent !== absent) {
            const gone = new Set(absent);

            this.#present = {
                doc,
                absent,
                bodies: doc.scenario.bodies.filter(
                    (body) => !gone.has(body.id),
                ),
            };
        }

        return this.#present.bodies;
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

    /**
     * Records which bodies are absent at the clock's time. Moves the focus to the nearest present
     * ancestor and clears the selection if they're absent. Returns what left, or `null` if nothing did.
     */
    settlePresence(): Departure | null {
        const bodies = this.#held.doc.scenario.bodies;

        // Most scenarios have no lifetimes, and this runs every frame.
        if (!bodies.some((body) => body.lifetime !== undefined)) {
            if (this.#held.absent.length > 0) this.#held.absent = NONE;

            return null;
        }

        const system = this.system;
        const t = this.clock.t;
        const absent = bodies
            .filter((body) => !system.presentAt(body.id, t))
            .map((body) => body.id);
        const old = this.#held.absent;
        if (
            absent.length !== old.length ||
            absent.some((id, i) => id !== old[i])
        ) {
            this.#held.absent = absent;
        }

        const gone = new Set(absent);
        const from = this.#held.focused;
        const was = this.#held.selected;
        let refocus: string | null = null;
        if (gone.has(from)) {
            const parents = new Map(
                bodies.map((body) => [body.id, body.orbit?.parent]),
            );
            let id = parents.get(from);
            // The root is never absent, so the walk ends.
            while (id !== undefined && gone.has(id)) id = parents.get(id);

            refocus = id ?? from;
            this.#held.focused = refocus;
        }
        const deselect = was !== null && gone.has(was);
        if (deselect) this.#held.selected = null;

        if (refocus === null && !deselect) return null;

        this.#settle(() => {}, refocus, deselect);

        return {
            gone: [
                ...(refocus !== null ? [from] : []),
                ...(deselect && was !== null && was !== from ? [was] : []),
            ],
            focused: refocus,
            deselected: deselect,
        };
    }

    /** Replaces the whole document and sets the clock to `t`. */
    load(doc: Document, t: number): void {
        const root = doc.scenario.bodies.find(
            (body) => body.orbit === undefined,
        );
        if (!root) throw new Error("The scenario has no root body.");

        this.#dispatch({ type: "load", doc });
        this.#held.past = [];
        this.#held.future = [];
        this.#held.loads += 1;
        this.#held.selected = null;
        this.#held.focused = root.id;
        this.clock.set(t);
        this.#emit({ type: "scenario" });
    }

    /** Adds `body` to the scenario, or throws why it can't. Keeps the focus and selection. */
    addBody(body: Body): void {
        this.#dispatch(
            { type: "add-body", body },
            HISTORY_LABELS["add-body"](body.name),
        );
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

        this.#dispatch(
            { type: "remove-body", id },
            HISTORY_LABELS["remove-body"](body.name),
        );

        const parent = body.orbit.parent;
        const refocus = gone.has(this.#held.focused);
        const deselect =
            this.#held.selected !== null && gone.has(this.#held.selected);
        if (refocus) this.#held.focused = parent;
        if (deselect) this.#held.selected = null;

        this.#settle(
            () => this.#emit({ type: "bodies", added: [], removed }),
            refocus ? parent : null,
            deselect,
        );
    }

    /** Restores the document before the last edit. Returns what the edit was, or `null` if there's none. */
    undo(): string | null {
        return this.#travel("past", "future");
    }

    /** Applies the edit the last undo took back. Returns what it was, or `null` if there's none. */
    redo(): string | null {
        return this.#travel("future", "past");
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
                    | "remove-body"
                    | "remove-event";
            }
        >,
    ): { ok: true } | { ok: false; errors: string[] } {
        const doc = this.#held.doc;
        const result = apply(doc, cmd, PRESETS);
        if (!result.ok) return { ok: false, errors: result.errors };

        if (cmd.type === "remove-event") {
            // The command succeeded, so the event exists.
            const event = doc.timeline.find((e) => e.id === cmd.id);
            if (!event) throw new Error(`"${cmd.id}" has no event.`);

            const name =
                doc.scenario.bodies.find((body) => body.id === event.bodyId)
                    ?.name ?? event.bodyId;
            const label =
                event.type === "burn"
                    ? HISTORY_LABELS["remove-burn"](name)
                    : HISTORY_LABELS["remove-set-orbit"](name);
            this.#record(label);
            this.#commit(result.doc);
            this.#emit({ type: "body", id: event.bodyId });

            return { ok: true };
        }

        // Not committed here: `removeBody` also moves the focus and selection.
        if (cmd.type === "remove-body") {
            this.removeBody(cmd.id);

            return { ok: true };
        }

        const id =
            cmd.type === "add-body"
                ? cmd.body.id
                : cmd.type === "update-body"
                  ? cmd.id
                  : cmd.bodyId;
        const name =
            cmd.type === "add-body"
                ? cmd.body.name
                : (doc.scenario.bodies.find((body) => body.id === id)?.name ??
                  id);
        this.#record(HISTORY_LABELS[cmd.type](name));
        this.#commit(result.doc);
        if (cmd.type === "add-body") {
            this.#emit({ type: "bodies", added: [id], removed: [] });

            return { ok: true };
        }

        this.#emit({ type: "body", id });

        return { ok: true };
    }

    /** Applies `cmd`, or throws why it can't. Records `label` in the history when given. */
    #dispatch(cmd: Command, label?: string): void {
        const result = apply(this.#held.doc, cmd, PRESETS);
        if (!result.ok) throw new Error(result.errors.join(" "));

        if (label !== undefined) this.#record(label);
        this.#commit(result.doc);
    }

    #record(label: string): void {
        const past = [...this.#held.past, { doc: this.#held.doc, label }];

        this.#held.past = past.slice(-HISTORY_LIMIT);
        this.#held.future = [];
    }

    /** Moves the last entry of `from` to `to`, with the current document, and restores the entry's. */
    #travel(from: "past" | "future", to: "past" | "future"): string | null {
        const entry = this.#held[from].at(-1);
        if (!entry) return null;

        this.#held[from] = this.#held[from].slice(0, -1);
        this.#held[to] = [
            ...this.#held[to],
            { doc: this.#held.doc, label: entry.label },
        ];
        this.#restore(entry.doc);

        // A view that failed to draw it loaded the last good document instead, and cleared the history.
        return this.#held.doc === entry.doc ? entry.label : null;
    }

    /** Swaps in `next` and emits what differs. A gone focus or selection moves like it does on a remove. */
    #restore(next: Document): void {
        const prev = this.#held.doc;
        const before = bodiesOf(prev);
        const after = bodiesOf(next);

        const removed = [...before.keys()].filter((id) => !after.has(id));
        // Parents first, as the view's `patch` needs.
        const added = sortByDepth(next.scenario)
            .map((body) => body.id)
            .filter((id) => !before.has(id));
        const changed = [...after]
            .filter(([id, body]) => {
                const old = before.get(id);

                return (
                    old !== undefined &&
                    (!same(old, body) || !sameEvents(prev, next, id))
                );
            })
            .map(([id]) => id);

        let refocus: string | null = null;
        if (!after.has(this.#held.focused)) {
            let id = before.get(this.#held.focused)?.orbit?.parent;
            while (id !== undefined && !after.has(id)) {
                id = before.get(id)?.orbit?.parent;
            }

            const root = next.scenario.bodies.find(
                (body) => body.orbit === undefined,
            );
            refocus = id ?? root?.id ?? this.#held.focused;
        }
        const deselect =
            this.#held.selected !== null && !after.has(this.#held.selected);

        this.#commit(next);
        if (refocus !== null) this.#held.focused = refocus;
        if (deselect) this.#held.selected = null;

        this.#settle(
            () => {
                if (added.length > 0 || removed.length > 0) {
                    this.#emit({ type: "bodies", added, removed });
                }
                for (const id of changed) this.#emit({ type: "body", id });
            },
            refocus,
            deselect,
        );
    }

    /** Runs `emit`, then announces the focus moved to `refocus` and a cleared selection. */
    #settle(emit: () => void, refocus: string | null, deselect: boolean): void {
        try {
            emit();
        } finally {
            // A view that fails to draw restores the old scenario and its focus, which this mustn't undo.
            try {
                if (refocus !== null && this.#held.focused === refocus) {
                    this.#emit({ type: "focus", id: refocus });
                }
            } finally {
                if (deselect && this.#held.selected === null) {
                    this.#emit({ type: "selection", id: null });
                }
            }
        }
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
