import type { Document, System } from "@cpluspatch/sim";
import type { World } from "../world.ts";

/** The world's document and compiled system as reactive fields. */
export class DocumentStore {
    doc: Document;
    system: System;

    #off: () => void;

    constructor(world: World) {
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

    /** Stops following the world. */
    destroy(): void {
        this.#off();
    }
}
