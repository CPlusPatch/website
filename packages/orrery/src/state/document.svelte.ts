import type { Burn, ElementsResult } from "@cpluspatch/orbit";
import type { Command, Document, Scenario, System } from "@cpluspatch/sim";
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
                    | "remove-body";
            }
        >,
    ): { ok: true } | { ok: false; errors: string[] } {
        return this.#scene.dispatch(cmd);
    }

    /** The orbit body `id` would have after burning `dv` at `t`. Changes nothing. */
    previewBurn(id: string, t: number, dv: Burn): ElementsResult {
        return previewBurn(this.doc.scenario, this.system, id, t, dv);
    }

    /** Replaces the whole scenario and sets the clock to `t`. */
    load(scenario: Scenario, t: number): void {
        this.#scene.load(scenario, t);
    }
}
