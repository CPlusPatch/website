import type { Document } from "@cpluspatch/sim";
import type { Held } from "./scene.ts";

/** The `Held` fields of a `Scene` as `$state`. Read by components and effects. */
export class ReactiveHeld implements Held {
    doc: Document;
    focused: string;
    selected: string | null;
    loads: number;

    constructor(initial: Held) {
        // Raw: a document is replaced as a whole and never edited, so it needs no proxy.
        this.doc = $state.raw(initial.doc);
        this.focused = $state(initial.focused);
        this.selected = $state(initial.selected);
        this.loads = $state(initial.loads);
    }
}
