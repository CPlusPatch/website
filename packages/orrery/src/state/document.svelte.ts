import type { Burn, ElementsResult } from "@cpluspatch/orbit";
import { colorOf } from "@cpluspatch/render";
import type { Body, Command, Document, System } from "@cpluspatch/sim";
import { previewBurn } from "../burning.ts";
import type { Scene } from "./scene.ts";

/** The scene's document and compiled system, readable in effects and `$derived`. */
export class DocumentStore {
    #scene: Scene;

    constructor(scene: Scene) {
        this.#scene = scene;
    }

    get doc(): Document {
        return this.#scene.doc;
    }

    get system(): System {
        return this.#scene.system;
    }

    /** How many scenarios have been loaded. A body edit replaces `doc` too, but doesn't count. */
    get loads(): number {
        return this.#scene.loads;
    }

    get canUndo(): boolean {
        return this.#scene.canUndo;
    }

    get canRedo(): boolean {
        return this.#scene.canRedo;
    }

    /** The colour of `body`, read from the system's bodies, which have their presets filled in. */
    colorOf(body: Body, parent: Body | undefined): string {
        const system = this.system;
        const expanded = (b: Body): Body =>
            system.index.has(b.id) ? system.body(b.id) : b;

        return colorOf(expanded(body), parent && expanded(parent));
    }

    /** Runs a command on one body. A rejected command changes nothing. */
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
        return this.#scene.dispatch(cmd);
    }

    /** The orbit body `id` would have after burning `dv` at `t`. Changes nothing. */
    previewBurn(id: string, t: number, dv: Burn): ElementsResult {
        return previewBurn(this.doc.scenario, this.system, id, t, dv);
    }

    /** Restores the document before the last edit. Returns what the edit was, or `null` if there's none. */
    undo(): string | null {
        return this.#scene.undo();
    }

    /** Applies the edit the last undo took back. Returns what it was, or `null` if there's none. */
    redo(): string | null {
        return this.#scene.redo();
    }

    /** Replaces the whole document and sets the clock to `t`. */
    load(doc: Document, t: number): void {
        this.#scene.load(doc, t);
    }
}
