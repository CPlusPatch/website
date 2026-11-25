import type { Burn, ElementsResult } from "@cpluspatch/orbit";
import type { Command, Document, System } from "@cpluspatch/sim";
import { previewBurn } from "../burning.ts";
import type { World } from "../world.ts";

/** The world's document and compiled system as reactive fields. */
export class DocumentStore {
    doc: Document;
    system: System;

    #world: World;
    #off: () => void;

    constructor(world: World) {
        this.#world = world;
        this.doc = $state.raw(world.doc);
        this.system = $state.raw(world.system);

        this.#off = world.on((event) => {
            if (
                event.type === "scenario" ||
                event.type === "bodies" ||
                event.type === "body"
            ) {
                this.doc = world.doc;
                this.system = world.system;
            }
        });
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
        return this.#world.dispatch(cmd);
    }

    /** The orbit body `id` would have after burning `dv` at `t`. Changes nothing. */
    previewBurn(id: string, t: number, dv: Burn): ElementsResult {
        return previewBurn(this.doc.scenario, this.system, id, t, dv);
    }

    /** Stops following the world. */
    destroy(): void {
        this.#off();
    }
}
